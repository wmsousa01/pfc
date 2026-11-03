import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { MODELOS } from "./modelos";
import { CAMPANHAS_DO_PLANO, PECAS, pautaParaIA, pecaPorCodigo, type Peca } from "./plano";
import { CTAS, OBJETIVOS, abrirStream, bytesDe, type Analise, type Criativo, type Enquadramento, type Estrategia, type Fonte } from "./store";

const FILES = "https://generativelanguage.googleapis.com";

/** Imagem vai inline; vídeo passa do limite inline e vai pela File API. */
const INLINE_MAX = 15 * 1024 * 1024;

function key(): string {
  const k = process.env.GOOGLE_AI_API_KEY;
  if (!k) throw new Error("GOOGLE_AI_API_KEY não configurada.");
  return k;
}

/** Pedaço enviado por vez: o vídeo inteiro na memória derrubava a função (OOM). */
const PEDACO = 16 * 1024 * 1024;

/**
 * Upload resumível para a File API do Gemini, em pedaços lidos do stream (a
 * memória fica em ~2 pedaços, qualquer que seja o tamanho do vídeo), e espera
 * o arquivo ficar ACTIVE (vídeo leva de segundos a ~1 min para processar). O
 * arquivo some sozinho em 48 h.
 */
async function subirArquivo(fonte: Fonte, nome: string): Promise<{ uri: string; mime: string }> {
  const start = await fetch(`${FILES}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      ...(fonte.tamanho ? { "X-Goog-Upload-Header-Content-Length": String(fonte.tamanho) } : {}),
      "X-Goog-Upload-Header-Content-Type": fonte.mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: nome.slice(0, 100) } }),
    cache: "no-store",
  });
  const url = start.headers.get("x-goog-upload-url");
  if (!start.ok || !url) throw new Error(`Gemini Files ${start.status}: não abriu o upload.`);
  // Pedaço que não é o último precisa ser múltiplo da granularidade (8 MB, em geral).
  const gran = Number(start.headers.get("x-goog-upload-chunk-granularity")) || 8 * 1024 * 1024;
  const alvo = Math.max(gran, Math.floor(PEDACO / gran) * gran);

  let offset = 0;
  const enviar = async (parte: Buffer, fim: boolean) => {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Length": String(parte.length), "X-Goog-Upload-Offset": String(offset), "X-Goog-Upload-Command": fim ? "upload, finalize" : "upload" },
      body: new Uint8Array(parte),
      cache: "no-store",
    });
    offset += parte.length;
    if (!fim && !r.ok) throw new Error(`Gemini Files ${r.status}: o upload parou em ${(offset / 1e6).toFixed(0)} MB.`);
    return r;
  };

  const reader = fonte.stream.getReader();
  let pendente: Buffer[] = [];
  let tam = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    pendente.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
    tam += value.byteLength;
    if (tam >= alvo) {
      const tudo = Buffer.concat(pendente, tam);
      await enviar(tudo.subarray(0, alvo), false);
      pendente = [tudo.subarray(alvo)];
      tam -= alvo;
    }
  }
  const up = await enviar(Buffer.concat(pendente, tam), true);
  const json = await up.json().catch(() => ({}));
  if (!up.ok || !json.file?.name) throw new Error(`Gemini Files ${up.status}: ${json.error?.message ?? "upload falhou"}`);

  let file = json.file as { name: string; uri: string; state: string; mimeType: string };
  const ate = Date.now() + 150_000;
  while (file.state === "PROCESSING") {
    if (Date.now() > ate) throw new Error("O Gemini ainda está processando o vídeo. Tente analisar de novo em 1 minuto.");
    await new Promise((r) => setTimeout(r, 4000));
    const r = await fetch(`${FILES}/v1beta/${file.name}`, { headers: { "x-goog-api-key": key() }, cache: "no-store" });
    file = await r.json();
  }
  if (file.state !== "ACTIVE") throw new Error(`O Gemini não conseguiu ler o arquivo (${file.state}).`);
  return { uri: file.uri, mime: file.mimeType };
}

function contexto(e: Estrategia | null): string {
  if (!e) return "Sem estratégia definida: avalie como anúncio genérico do Fora da Caixa e marque 'alinhamento' pelo potencial.";
  return `ESTRATÉGIA DA CAMPANHA
- Nome: ${e.nome}
- Objetivo: ${OBJETIVOS[e.objetivo].label} (${OBJETIVOS[e.objetivo].detalhe})
- Plataformas: ${e.plataformas.join(", ")}
- Público: ${e.publico || "—"} (raio de ${e.geo_raio_km} km, ${e.idade_min}–${e.idade_max} anos)
- Oferta: ${e.oferta || "—"}
- Mensagem-chave: ${e.mensagem || "—"}
- Ângulos: ${e.angulos.join(" · ") || "—"}
- Botão: ${CTAS[e.cta] ?? e.cta} → ${e.link ?? "sem link"}
- KPI: ${e.kpi || "—"}`;
}

const CRIT = {
  type: "OBJECT",
  properties: { nota: { type: "INTEGER" }, comentario: { type: "STRING" } },
  required: ["nota", "comentario"],
};
const LISTA = { type: "ARRAY", items: { type: "STRING" } };

const NENHUMA = "NENHUMA";

/** Pauta do plano com o público e a mensagem de cada campanha, para o Gemini escolher a peça. */
function pauta(tipo: Criativo["tipo"]): string {
  const campanhas = (Object.keys(CAMPANHAS_DO_PLANO) as Peca["campanha"][])
    .map((k) => `- ${CAMPANHAS_DO_PLANO[k].codigo} · ${MODELOS[k].m.nome}: público ${MODELOS[k].m.publico} Mensagem: ${MODELOS[k].m.mensagem}`)
    .join("\n");
  return `PLANO DE CAMPANHAS (onde este criativo pode entrar)
${campanhas}

PEÇAS DA PAUTA (${tipo === "video" ? "vídeos" : "imagens"}):
${pautaParaIA(tipo)}`;
}

const enquadramentoSchema = (tipo: Criativo["tipo"]) => ({
  type: "OBJECT",
  properties: {
    peca: { type: "STRING", format: "enum", enum: [...PECAS.filter((p) => p.tipo === tipo).map((p) => p.codigo), NENHUMA] },
    confianca: { type: "INTEGER" },
    motivo: { type: "STRING" },
  },
  required: ["peca", "confianca", "motivo"],
});

const PEDIDO_ENQUADRAMENTO = `Diga também em qual peça da pauta o criativo melhor se enquadra ("enquadramento"): o código da peça, ou ${NENHUMA} se ele não cumpre nenhuma.
Decida pelo conteúdo (o que é dito e mostrado, para quem fala, qual a chamada), não pelo nome do arquivo. "confianca" de 0 a 100; "motivo" em uma frase, citando o que no criativo decidiu.`;

/** Só aceita código que existe na pauta e é do mesmo tipo do criativo. */
function validarEnquadramento(raw: { peca?: string; confianca?: number; motivo?: string } | undefined, tipo: Criativo["tipo"]): Enquadramento | undefined {
  if (!raw) return undefined;
  const p = pecaPorCodigo(raw.peca);
  return {
    peca: p && p.tipo === tipo ? p.codigo : null,
    confianca: Math.max(0, Math.min(100, Math.round(Number(raw.confianca) || 0))),
    motivo: String(raw.motivo ?? "").slice(0, 300),
  };
}

/**
 * Análise de um criativo como anúncio pago: nota por critério, problemas,
 * sugestões concretas e uma copy pronta para o anúncio. Com a estratégia, o
 * critério "alinhamento" mede se a peça serve àquela campanha.
 */
export async function analisarCriativo(c: Criativo, e: Estrategia | null): Promise<Analise> {
  let media;
  if (c.tipo === "video") {
    // Vídeo vai do Drive/Contenta/Storage direto para o Gemini, sem passar inteiro pela memória.
    const f = await subirArquivo(await abrirStream(c), c.nome);
    media = { fileData: { mimeType: f.mime, fileUri: f.uri } };
  } else {
    const { buf, mime } = await bytesDe(c, 50 * 1024 * 1024);
    media =
      buf.length <= INLINE_MAX
        ? { inlineData: { mimeType: mime, data: buf.toString("base64") } }
        : await subirArquivo({ stream: new Blob([new Uint8Array(buf)]).stream(), tamanho: buf.length, mime }, c.nome).then((f) => ({
            fileData: { mimeType: f.mime, fileUri: f.uri },
          }));
  }

  const prompt = `Você é estrategista de mídia paga (Meta Ads e Google/YouTube Ads) e analisa criativos para o "Fora da Caixa", podcast e mídia local de Mogi Guaçu (SP).
O Fora da Caixa vende "mídia local com métrica" (QR + landing + relatório) para pequenos comerciantes que só conhecem rádio, TV e carro de som. Nunca ataque o rádio/TV na copy.

${contexto(e)}

CRIATIVO: ${c.tipo === "video" ? "vídeo" : "imagem"} "${c.nome}"${c.formato ? `, formato ${c.formato}` : ""}${c.duracao_s ? `, ${c.duracao_s}s` : ""}.

Avalie como ANÚNCIO PAGO, com notas de 0 a 100 e comentário curto e específico (cite o segundo do vídeo ou a parte da imagem):
- gancho: os primeiros 3 segundos (ou o primeiro olhar na imagem) param o scroll?
- clareza: dá para entender a mensagem sem som e em 5 segundos? Tem legenda?
- ritmo: cortes, duração e retenção (para imagem: hierarquia visual e quantidade de texto)
- cta: existe chamada clara para a ação da estratégia?
- formato: proporção, área segura (texto fora das bordas onde a interface da rede cobre), legibilidade no celular
- alinhamento: serve ao objetivo, ao público e à oferta da estratégia?
A "nota" geral NÃO é a média: é a chance de esta peça bater o KPI.
Liste pontos fortes, problemas, sugestões de edição concretas (o que cortar, mover, escrever), riscos de reprovação nas políticas de anúncio (alegações, antes/depois, texto enganoso) e os posicionamentos onde ela rende mais (ex.: Reels, Stories, Feed, YouTube Shorts, In-stream).
Escreva também uma copy para o anúncio: headline de até 40 caracteres e texto principal de até 300 caracteres, em português do Brasil, com as palavras do comerciante (sem jargão de marketing), sem emojis em excesso.

${pauta(c.tipo)}

${PEDIDO_ENQUADRAMENTO}`;

  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [media, { text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          nota: { type: "INTEGER" },
          resumo: { type: "STRING" },
          gancho: CRIT,
          clareza: CRIT,
          ritmo: CRIT,
          cta: CRIT,
          formato: CRIT,
          alinhamento: CRIT,
          pontos_fortes: LISTA,
          problemas: LISTA,
          sugestoes: LISTA,
          riscos_politica: LISTA,
          posicionamentos: LISTA,
          copy: {
            type: "OBJECT",
            properties: { headline: { type: "STRING" }, texto: { type: "STRING" } },
            required: ["headline", "texto"],
          },
          enquadramento: enquadramentoSchema(c.tipo),
        },
        required: ["nota", "resumo", "gancho", "clareza", "ritmo", "cta", "formato", "alinhamento", "pontos_fortes", "problemas", "sugestoes", "riscos_politica", "posicionamentos", "copy", "enquadramento"],
      },
    },
  });
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`O Gemini não devolveu a análise (${json.candidates?.[0]?.finishReason ?? "sem resposta"}).`);
  const a = JSON.parse(text) as Analise;
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
  a.nota = clamp(a.nota);
  for (const k of ["gancho", "clareza", "ritmo", "cta", "formato", "alinhamento"] as const) a[k].nota = clamp(a[k].nota);
  a.copy.headline = a.copy.headline.slice(0, 40);
  a.copy.texto = a.copy.texto.slice(0, 300);
  a.enquadramento = validarEnquadramento(a.enquadramento as Parameters<typeof validarEnquadramento>[0], c.tipo);
  return { ...a, ...(e ? { estrategia: e.nome } : {}), modelo: TEXT_MODEL };
}

/**
 * Enquadra na pauta um criativo já analisado, só pelo texto da análise (sem
 * mandar o vídeo de novo): segundos e centavos em vez de ~1 min por vídeo.
 */
export async function enquadrarPelaAnalise(c: Criativo): Promise<Enquadramento> {
  const a = c.analise;
  if (!a) throw new Error(`"${c.nome}" ainda não foi analisado.`);
  const prompt = `Você é estrategista de mídia paga do "Fora da Caixa", podcast e mídia local de Mogi Guaçu (SP).
Um criativo já foi assistido e analisado. Use a análise abaixo para decidir onde ele entra no plano.

CRIATIVO: ${c.tipo === "video" ? "vídeo" : "imagem"} "${c.nome}"${c.formato ? `, formato ${c.formato}` : ""}${c.duracao_s ? `, ${c.duracao_s}s` : ""}.
Resumo: ${a.resumo}
Gancho: ${a.gancho.comentario}
Chamada para ação: ${a.cta.comentario}
Pontos fortes: ${a.pontos_fortes.join(" · ")}
Problemas: ${a.problemas.join(" · ")}
Copy sugerida: ${a.copy.headline}. ${a.copy.texto}

${pauta(c.tipo)}

${PEDIDO_ENQUADRAMENTO}`;
  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: enquadramentoSchema(c.tipo) },
  });
  const enq = validarEnquadramento(JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"), c.tipo);
  if (!enq?.motivo) throw new Error(`O Gemini não enquadrou "${c.nome}".`);
  return enq;
}

/** Headline + texto para uma entrega, a partir da estratégia e do ângulo (sem olhar a peça). */
export async function sugerirCopy(e: Estrategia, angulo: string | null): Promise<{ headline: string; texto: string }> {
  const json = await generate(TEXT_MODEL, {
    contents: [
      {
        parts: [
          {
            text: `Escreva a copy de um anúncio na Meta para o Fora da Caixa (mídia local de Mogi Guaçu, SP).
${contexto(e)}
${angulo ? `Ângulo desta peça: ${angulo}` : ""}
Headline até 40 caracteres e texto principal até 300, em português do Brasil, com as palavras do comerciante, sem atacar rádio/TV, terminando com a ação do botão "${CTAS[e.cta] ?? e.cta}".`,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { headline: { type: "STRING" }, texto: { type: "STRING" } },
        required: ["headline", "texto"],
      },
    },
  });
  const r = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { headline?: string; texto?: string };
  if (!r.headline || !r.texto) throw new Error("O Gemini não devolveu a copy.");
  return { headline: r.headline.slice(0, 40), texto: r.texto.slice(0, 300) };
}
