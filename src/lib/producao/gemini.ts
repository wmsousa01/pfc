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
 * Headlines de duas linhas a partir da transcrição: linha 1 curta (gancho),
 * linha 2 a virada/pergunta. Mais o conceito central, que vai para o prompt
 * da imagem.
 */
export async function suggestHeadlines(
  title: string,
  transcript: string | null,
  count = 3
): Promise<{ conceito: string; options: Headline[] }> {
  const prompt = `Você cria headlines de thumbnail de YouTube para o podcast "Papo Fora da Caixa" (Mogi Guaçu, SP).
Título do corte: ${title}
Transcrição do corte (pode estar vazia ou com erros de reconhecimento):
"""${(transcript ?? "").slice(0, 12000)}"""

Gere ${count} headlines diferentes em português do Brasil, em MAIÚSCULAS, cada uma em duas linhas:
- l1: até 3 palavras, gancho (ex.: "VOCÊ ESQUECEU")
- l2: até 4 palavras, a virada ou pergunta (ex.: "POR QUE COMEÇOU?")
Regras: fiel ao que é dito no corte, provoca curiosidade, sem clickbait mentiroso, sem nomes de pessoas, sem emojis, ortografia e acentos perfeitos.
Também escreva "conceito": uma frase com a ideia central do corte.`;

  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          conceito: { type: "STRING" },
          options: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { l1: { type: "STRING" }, l2: { type: "STRING" } },
              required: ["l1", "l2"],
            },
          },
        },
        required: ["conceito", "options"],
      },
    },
  });
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const parsed = JSON.parse(text) as { conceito?: string; options?: Headline[] };
  const options = (parsed.options ?? [])
    .map((o) => ({ l1: o.l1.trim().toUpperCase(), l2: o.l2.trim().toUpperCase() }))
    .filter((o) => o.l1 && o.l2)
    .slice(0, count);
  if (options.length === 0) throw new Error("O Gemini não devolveu headline.");
  return { conceito: parsed.conceito?.trim() || title, options };
}

/** Gera a thumb 16:9 a partir do frame (+ logo). Devolve a imagem crua. */
export async function renderThumb(prompt: string, frame: Buffer, logo: Buffer | null): Promise<Buffer> {
  const parts: unknown[] = [
    { text: prompt },
    { inlineData: { mimeType: "image/jpeg", data: frame.toString("base64") } },
  ];
  if (logo) parts.push({ inlineData: { mimeType: "image/png", data: logo.toString("base64") } });

  const json = await generate(IMAGE_MODEL, {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "16:9", imageSize: "2K" },
    },
  });
  const img = (json.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData)?.inlineData;
  if (!img) {
    const reason = json.candidates?.[0]?.finishReason ?? json.promptFeedback?.blockReason ?? "sem imagem";
    throw new Error(`Gemini não gerou a imagem (${reason}).`);
  }
  return Buffer.from(img.data, "base64");
}
