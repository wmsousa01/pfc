import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { download } from "@/lib/producao/store";
import { blocosDoEspelho, remapearImagens } from "./espelho";
import { db, getEpisodio, logAgenda, updateEpisodio, type Materia, type Roteiro } from "./store";

/**
 * Roteiro que o apresentador escreveu (o PDF do Word/Docs, ou o texto colado)
 * vira o espelho: uma matéria por bloco, com o texto dele exatamente como
 * está. A IA só separa as partes — manchete, leitura, comentário, a piada
 * marcada com "::::: H", a pergunta para reflexão e o serviço — e não
 * resume nem reescreve: é o que o âncora vai ler no ar.
 */

const STR = { type: "STRING" } as const;

const PROMPT = `Este é o roteiro do PFC News, o telejornal do Papo Fora da Caixa, escrito pelo apresentador.
Separe o roteiro em matérias, na ordem do documento, para o espelho da transmissão (a equipe técnica acompanha o programa por ele).

Regras:
- COPIE o texto do apresentador exatamente como está: sem resumir, sem corrigir, sem reescrever, sem acrescentar nada. Mantenha as quebras de parágrafo com uma linha em branco entre eles.
- tipo: "abertura" para a fala de abertura do programa, "encerramento" para a despedida final, "materia" para cada notícia.
- Se a abertura e a primeira notícia estão no mesmo bloco do documento, são duas matérias: a abertura e a notícia.
- bloco: o rótulo de bloco do documento em que a matéria está (ex.: "BLOCO 1 — Abertura e panorama regional"), repetido em todas as matérias desse bloco até o próximo rótulo; vazio se o documento não tiver rótulo.
- titulo: o título da matéria no documento (ex.: "Mobilidade: a chegada da Rota Mogiana"); na abertura, "Abertura"; no encerramento, "Encerramento".
- manchete: o texto depois de MANCHETE, ou a frase de manchete logo abaixo do título quando não houver o rótulo.
- leitura: o texto depois de NOTÍCIA PARA LEITURA (na abertura e no encerramento, a fala inteira do apresentador).
- comentario: o texto depois de COMENTÁRIO DO APRESENTADOR, até a marca de humor.
- humor: o texto depois da marca com dois-pontos e H (ex.: ":::::: H" ou ":::::: HHHH"), sem a marca.
- reflexao: a pergunta depois de PERGUNTA PARA REFLEXÃO, mais a frase de introdução dos tópicos se houver.
- pontos: cada tópico da lista que vem depois da pergunta (sem o marcador), e por último a frase de conclusão depois da lista, se houver.
- servico: o texto depois de SERVIÇO AO TELESPECTADOR.
Parte que a matéria não tem fica vazia.`;

type Resposta = { materias?: Partial<Materia>[] };

const limpo = (v?: string | null) => (v ?? "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim() || null;

async function lerRoteiro(arquivo: { buf: Buffer; mime: string } | null, texto: string | null): Promise<Materia[]> {
  const parts = arquivo
    ? [{ inlineData: { mimeType: arquivo.mime, data: arquivo.buf.toString("base64") } }, { text: PROMPT }]
    : [{ text: `${PROMPT}\n\nROTEIRO:\n${texto}` }];
  const json = await generate(TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          materias: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                tipo: { type: "STRING", enum: ["abertura", "materia", "encerramento"] },
                bloco: STR,
                titulo: STR,
                manchete: STR,
                leitura: STR,
                comentario: STR,
                humor: STR,
                reflexao: STR,
                pontos: { type: "ARRAY", items: STR },
                servico: STR,
              },
              required: ["tipo", "titulo"],
            },
          },
        },
        required: ["materias"],
      },
    },
  });
  const cand = json.candidates?.[0];
  if (cand?.finishReason === "MAX_TOKENS") throw new Error("O roteiro é longo demais para ler de uma vez. Divida em duas partes.");
  const r = JSON.parse(cand?.content?.parts?.[0]?.text ?? "{}") as Resposta;
  const materias = (r.materias ?? [])
    .filter((m) => m.titulo?.trim())
    .map<Materia>((m) => ({
      tipo: m.tipo === "abertura" || m.tipo === "encerramento" ? m.tipo : "materia",
      bloco: limpo(m.bloco),
      titulo: m.titulo!.trim(),
      manchete: limpo(m.manchete),
      leitura: limpo(m.leitura),
      comentario: limpo(m.comentario),
      humor: limpo(m.humor),
      reflexao: limpo(m.reflexao),
      pontos: (m.pontos ?? []).map((p) => p.trim()).filter(Boolean),
      servico: limpo(m.servico),
    }));
  if (materias.length === 0) throw new Error("A IA não achou matérias no roteiro. Confira se é o documento certo.");
  return materias;
}

/**
 * Lê o roteiro de um PDF dos materiais do episódio ou de um texto colado e
 * põe no espelho. As imagens já distribuídas seguem a notícia para a
 * matéria nova; o bloco no ar volta para antes de começar.
 */
export async function importarRoteiro(
  epId: string,
  fonte: { materialId: string } | { texto: string },
  actor: string
): Promise<{ materias: number; fora: number }> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");

  let arquivo: { buf: Buffer; mime: string } | null = null;
  let nome: string | null = null;
  let texto: string | null = null;
  if ("materialId" in fonte) {
    const { data: m } = await db().from("agenda_materiais").select("*").eq("id", fonte.materialId).eq("episodio_id", ep.id).maybeSingle();
    if (!m) throw new Error("Material não encontrado.");
    if (m.mime !== "application/pdf") throw new Error("O roteiro precisa ser PDF (no Word ou Docs: Arquivo → Baixar/Salvar como PDF).");
    const buf = await download(m.path);
    if (!buf) throw new Error("Não deu para baixar o PDF do Storage.");
    // O Gemini aceita PDF direto até 20 MB por pedido.
    if (buf.length > 19 * 1024 * 1024) throw new Error("PDF acima de 19 MB. Exporte sem imagens ou cole o texto.");
    arquivo = { buf, mime: "application/pdf" };
    nome = m.nome as string;
  } else {
    texto = fonte.texto.trim();
    if (texto.length < 200) throw new Error("Cole o roteiro inteiro.");
  }

  const materias = await lerRoteiro(arquivo, texto);
  const roteiro: Roteiro = { arquivo: nome, importado_em: new Date().toISOString(), materias };
  const fora = await remapearImagens(ep.id, blocosDoEspelho(ep.briefing, ep.roteiro), blocosDoEspelho(ep.briefing, roteiro));
  await updateEpisodio(ep.id, { roteiro, espelho_atual: null, espelho_imagem: null });
  await logAgenda(ep.id, actor, "pôs o roteiro do apresentador no espelho", `${nome ?? "texto colado"}: ${materias.length} matérias`);
  return { materias: materias.length, fora };
}

/** Volta o espelho para a pauta da IA. */
export async function tirarRoteiro(epId: string, actor: string): Promise<void> {
  const ep = await getEpisodio(epId);
  if (!ep?.roteiro) return;
  await remapearImagens(ep.id, blocosDoEspelho(ep.briefing, ep.roteiro), blocosDoEspelho(ep.briefing, null));
  await updateEpisodio(ep.id, { roteiro: null, espelho_atual: null, espelho_imagem: null });
  await logAgenda(ep.id, actor, "tirou o roteiro do apresentador do espelho");
}
