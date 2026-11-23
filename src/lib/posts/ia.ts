import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { LIMITE_ITENS, type FormatoPost } from "./tipos";

/**
 * Transforma a ideia escrita pela equipe num post preenchido: escolhe o
 * modelo (arte única ou carrossel de texto), escreve os textos e sugere a
 * legenda. A IA só escreve: a arte continua sendo desenhada pelo modelo do
 * site, e a equipe revisa tudo antes de gerar.
 */

export type PostSugerido =
  | { tipo: "cartaz"; formato: FormatoPost; chapeu: string; titulo: string; mensagem: string; assinatura: string; legenda: string }
  | { tipo: "texto"; titulo: string; subtitulo: string; itens: { titulo: string; texto: string }[]; chamada: string; legenda: string };

const SEM_EMOJI = new RegExp("[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}]", "gu");
const arte = (t: unknown, max: number) => (typeof t === "string" ? t.replace(SEM_EMOJI, "").replace(/\s+/g, " ").trim().slice(0, max) : "");

export async function montarPost(ideia: string, quadro: string): Promise<PostSugerido> {
  const prompt = `Você monta posts estáticos de Instagram para o "Fora da Caixa", ecossistema de podcast e conteúdo regional de Mogi Guaçu (SP). Quadro do post: ${quadro}.

Ideia e proposta escritas pela equipe:
"""${ideia}"""

Escolha o modelo:
- "cartaz": uma arte só (data comemorativa, aviso de live, convidado, episódio novo, anúncio, frase).
- "texto": carrossel com capa e tópicos (dicas, lista, lições, bastidores, passo a passo).
Respeite o que a equipe pedir; na dúvida, uma ideia com vários pontos vira "texto".

Regras dos textos da arte:
- Português do Brasil, ortografia e acentos perfeitos, sem emoji, sem hashtag.
- Títulos curtos e fortes: cartaz até 6 palavras; capa do carrossel até 8; título de tópico até 6.
- Mensagem do cartaz: no máximo 2 frases curtas. Texto de cada tópico: até 3 frases curtas.
- chapeu: linha pequena acima do título (data, horário, "Convidado da semana"...), até 4 palavras; vazio se não fizer sentido.
- Carrossel: de 2 a ${LIMITE_ITENS} tópicos; chamada final curta (ex.: "Salve para ler depois").
- formato do cartaz: "9:16" se a equipe falar em story; "1:1" se pedir quadrado; senão "4:5".
- Nunca invente dado que não está na ideia: nome, número, data, horário, local ou preço. Sem o dado, escreva sem ele.

Legenda do Instagram: até 600 caracteres, tom próximo e local, pode ter emoji, termine com uma chamada para ação e 3 a 5 hashtags. A mesma regra vale na legenda: nada de nome, número, dia da semana, data ou fato que não esteja na ideia.`;

  const corpo = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      // Sem teto, o modelo às vezes entra em repetição e escreve até o limite: minutos de espera e JSON quebrado.
      maxOutputTokens: 4096,
      // Texto curto e com regras claras: pensar pouco basta e corta a espera pela metade.
      thinkingConfig: { thinkingLevel: "low" },
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          tipo: { type: "STRING", enum: ["cartaz", "texto"] },
          formato: { type: "STRING", enum: ["4:5", "1:1", "9:16"] },
          chapeu: { type: "STRING" },
          titulo: { type: "STRING" },
          mensagem: { type: "STRING" },
          assinatura: { type: "STRING" },
          subtitulo: { type: "STRING" },
          itens: {
            type: "ARRAY",
            maxItems: LIMITE_ITENS,
            items: { type: "OBJECT", properties: { titulo: { type: "STRING" }, texto: { type: "STRING" } }, required: ["titulo", "texto"] },
          },
          chamada: { type: "STRING" },
          legenda: { type: "STRING" },
        },
        required: ["tipo", "titulo", "legenda"],
      },
    },
  };

  // Resposta cortada ou quebrada costuma sair certa na segunda tentativa.
  let bruto: Record<string, unknown> | null = null;
  for (let tentativa = 0; tentativa < 2 && !bruto; tentativa++) {
    const json = await generate(TEXT_MODEL, corpo);
    try {
      bruto = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "") as Record<string, unknown>;
    } catch {
      bruto = null;
    }
  }
  if (!bruto) throw new Error("A IA não devolveu um post válido. Tente de novo.");
  const titulo = arte(bruto.titulo, 120);
  if (!titulo) throw new Error("A IA não devolveu um post. Tente descrever a ideia com mais detalhe.");
  const legenda = typeof bruto.legenda === "string" ? bruto.legenda.trim().slice(0, 2200) : "";

  if (bruto.tipo === "texto") {
    const itens = (Array.isArray(bruto.itens) ? bruto.itens : [])
      .slice(0, LIMITE_ITENS)
      .map((i: Record<string, unknown>) => ({ titulo: arte(i?.titulo, 100), texto: arte(i?.texto, 500) }))
      .filter((i) => i.titulo || i.texto);
    return { tipo: "texto", titulo, subtitulo: arte(bruto.subtitulo, 200), itens: itens.length ? itens : [{ titulo: "", texto: "" }], chamada: arte(bruto.chamada, 80), legenda };
  }
  const formato = (["4:5", "1:1", "9:16"] as FormatoPost[]).includes(bruto.formato as FormatoPost) ? (bruto.formato as FormatoPost) : "4:5";
  return { tipo: "cartaz", formato, chapeu: arte(bruto.chapeu, 60), titulo, mensagem: arte(bruto.mensagem, 300), assinatura: arte(bruto.assinatura, 60), legenda };
}
