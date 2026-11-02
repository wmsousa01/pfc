import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { CTAS, OBJETIVOS, bytesDe, type Analise, type Criativo, type Estrategia } from "./store";

const FILES = "https://generativelanguage.googleapis.com";

/** Imagem vai inline; vídeo passa do limite inline e vai pela File API. */
const INLINE_MAX = 15 * 1024 * 1024;

function key(): string {
  const k = process.env.GOOGLE_AI_API_KEY;
  if (!k) throw new Error("GOOGLE_AI_API_KEY não configurada.");
  return k;
}

/**
 * Upload resumível para a File API do Gemini e espera o arquivo ficar ACTIVE
 * (vídeo leva de segundos a ~1 min para processar). O arquivo some sozinho
 * em 48 h.
 */
async function subirArquivo(buf: Buffer, mime: string, nome: string): Promise<{ uri: string; mime: string }> {
  const start = await fetch(`${FILES}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": key(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(buf.length),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: nome.slice(0, 100) } }),
    cache: "no-store",
  });
  const url = start.headers.get("x-goog-upload-url");
  if (!start.ok || !url) throw new Error(`Gemini Files ${start.status}: não abriu o upload.`);

  const up = await fetch(url, {
    method: "POST",
    headers: { "Content-Length": String(buf.length), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    body: new Uint8Array(buf),
    cache: "no-store",
  });
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

/**
 * Análise de um criativo como anúncio pago: nota por critério, problemas,
 * sugestões concretas e uma copy pronta para o anúncio. Com a estratégia, o
 * critério "alinhamento" mede se a peça serve àquela campanha.
 */
export async function analisarCriativo(c: Criativo, e: Estrategia | null): Promise<Analise> {
  const { buf, mime } = await bytesDe(c);
  const media =
    buf.length <= INLINE_MAX && !mime.startsWith("video/")
      ? { inlineData: { mimeType: mime, data: buf.toString("base64") } }
      : await subirArquivo(buf, mime, c.nome).then((f) => ({ fileData: { mimeType: f.mime, fileUri: f.uri } }));

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
Escreva também uma copy para o anúncio: headline de até 40 caracteres e texto principal de até 300 caracteres, em português do Brasil, com as palavras do comerciante (sem jargão de marketing), sem emojis em excesso.`;

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
        },
        required: ["nota", "resumo", "gancho", "clareza", "ritmo", "cta", "formato", "alinhamento", "pontos_fortes", "problemas", "sugestoes", "riscos_politica", "posicionamentos", "copy"],
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
  return { ...a, ...(e ? { estrategia: e.nome } : {}), modelo: TEXT_MODEL };
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
