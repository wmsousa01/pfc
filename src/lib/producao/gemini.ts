import "server-only";
import type { Headline } from "./store";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Nano Banana Pro: o que melhor acerta acento e cedilha na headline. */
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";

function apiKey(): string {
  const k = process.env.GOOGLE_AI_API_KEY;
  if (!k) throw new Error("GOOGLE_AI_API_KEY não configurada.");
  return k;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

async function generate(model: string, body: unknown): Promise<any> {
  const res = await fetch(`${API}/${model}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${json.error?.message ?? "erro"}`);
  return json;
}

/**
 * Headlines a partir da transcrição, como nas thumbs da equipe: linha 1 curta
 * (gancho, menor), linha 2 o destaque na cor do quadro e, de preferência,
 * linha 3 que completa a frase.
 */
export async function suggestHeadlines(
  title: string,
  transcript: string | null,
  count = 3
): Promise<{ options: Headline[] }> {
  const prompt = `Você cria headlines de thumbnail de YouTube para o podcast "Papo Fora da Caixa" (Mogi Guaçu, SP).
Título do corte: ${title}
Transcrição do corte (pode estar vazia ou com erros de reconhecimento):
"""${(transcript ?? "").slice(0, 12000)}"""

Gere ${count} headlines diferentes em português do Brasil, em MAIÚSCULAS. Cada uma é uma frase só, quebrada em linhas:
- l1: até 4 palavras, o gancho, sai menor (ex.: "DISCIPLINA QUE TRANSFORMA")
- l2: até 2 palavras, o destaque, sai grande e colorido (ex.: "UMA PARCERIA")
- l3: até 2 palavras, completa a frase, sai grande (ex.: "DE CONFIANÇA"); deixe vazio só se a frase ficar melhor em duas linhas
Prefira três linhas; a l2 e a l3 têm que caber curtas porque saem enormes.
Regras: fiel ao que é dito no corte, provoca curiosidade, sem clickbait mentiroso, sem nomes de pessoas, sem emojis, ortografia e acentos perfeitos.`;

  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { l1: { type: "STRING" }, l2: { type: "STRING" }, l3: { type: "STRING" } },
              required: ["l1", "l2"],
            },
          },
        },
        required: ["options"],
      },
    },
  });
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as { options?: Headline[] };
  const options = (parsed.options ?? [])
    .map((o) => ({
      l1: o.l1.trim().toUpperCase(),
      l2: o.l2.trim().toUpperCase(),
      ...(o.l3?.trim() ? { l3: o.l3.trim().toUpperCase() } : {}),
    }))
    .filter((o) => o.l1 && o.l2)
    .slice(0, count);
  if (options.length === 0) throw new Error("O Gemini não devolveu headline.");
  return { options };
}

/**
 * Só o fundo da thumb: estúdio vazio, sem gente, texto nem logo. As pessoas
 * reais, a headline e o logo entram por cima, na composição — pedir ao
 * modelo para mantê-las fazia ele redesenhar os rostos.
 */
export async function renderPlate(prompt: string): Promise<Buffer> {
  const json = await generate(IMAGE_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize: "1K" },
    },
  });
  const img = (json.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData)?.inlineData;
  if (!img) {
    const reason = json.candidates?.[0]?.finishReason ?? json.promptFeedback?.blockReason ?? "sem imagem";
    throw new Error(`Gemini não gerou a imagem (${reason}).`);
  }
  return Buffer.from(img.data, "base64");
}

/**
 * Entre frames candidatos do mesmo corte, o melhor para a thumb: rostos de
 * frente ou três-quartos, olhos abertos, expressão viva, sem desfoque. Uma
 * chamada só, com todos os frames. Devolve o índice e o motivo.
 */
export async function pickBestFrame(frames: Buffer[]): Promise<{ index: number; reason: string }> {
  if (frames.length <= 1) return { index: 0, reason: "único frame disponível" };
  const parts: unknown[] = [
    {
      text: `Estes são ${frames.length} frames (numerados de 0 a ${frames.length - 1}, na ordem) do mesmo corte de podcast.
Escolha o melhor para virar thumbnail do YouTube: pessoas com o rosto visível (de frente ou três-quartos), olhos abertos, expressão viva ou emocional, sem desfoque de movimento, sem boca torta no meio de uma palavra.
Penalize olhos fechados, rosto de perfil ou virado para baixo, mão cobrindo o rosto e frames escuros.`,
    },
    ...frames.map((f) => ({ inlineData: { mimeType: "image/jpeg", data: f.toString("base64") } })),
  ];
  const json = await generate(TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: { index: { type: "INTEGER" }, reason: { type: "STRING" } },
        required: ["index", "reason"],
      },
    },
  });
  const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { index?: number; reason?: string };
  const index = Number.isInteger(parsed.index) && parsed.index! >= 0 && parsed.index! < frames.length ? parsed.index! : 0;
  return { index, reason: parsed.reason?.trim() || "" };
}
