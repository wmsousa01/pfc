import "server-only";
import type { Headline } from "./store";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

/** Nano Banana Pro: o que melhor acerta acento e cedilha na headline. */
export const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";

function apiKey(): string {
  const k = process.env.GOOGLE_AI_API_KEY;
  if (!k) throw new Error("GOOGLE_AI_API_KEY não configurada.");
  return k;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}

export async function generate(model: string, body: unknown): Promise<any> {
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
export async function renderPlate(prompt: string, aspectRatio: "16:9" | "9:16" = "16:9"): Promise<Buffer> {
  const json = await generate(IMAGE_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio, imageSize: "1K" },
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
 * A foto mostra uma pessoa de verdade, ou é logo, escudo, arte, produto?
 * Perfil de clube ou empresa vem com o escudo no lugar da foto, e o modelo de
 * imagem inventava um homem com a camisa do time. Na dúvida (erro), pessoa.
 */
export async function ehFotoDePessoa(img: Buffer, mime: string): Promise<boolean> {
  try {
    const json = await generate(TEXT_MODEL, {
      contents: [
        {
          parts: [
            { text: "Esta imagem é a FOTOGRAFIA de uma pessoa real com o rosto visível? Responda false se for logotipo, escudo, brasão, ilustração, texto, produto, fachada ou paisagem sem pessoa em destaque." },
            { inlineData: { mimeType: mime, data: img.toString("base64") } },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: { type: "OBJECT", properties: { pessoa: { type: "BOOLEAN" } }, required: ["pessoa"] },
      },
    });
    const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { pessoa?: boolean };
    return parsed.pessoa !== false;
  } catch {
    return true;
  }
}

/**
 * Confere a arte gerada contra as fotos: quantas pessoas aparecem e se alguém
 * foi inventado ou repetido (o modelo chegou a pôr o apresentador duas vezes,
 * uma delas com a camisa do clube convidado). `ok` false pede outra tentativa.
 * Na dúvida (erro), aprova — a conferência não pode travar a geração.
 */
export async function conferirPessoas(
  arte: Buffer,
  fotos: { nome: string; data: Buffer; mime: string }[],
  proibido: string | null
): Promise<{ ok: boolean; motivo: string }> {
  try {
    const parts: unknown[] = [
      {
        text: `A IMAGEM 1 é uma arte de divulgação. As seguintes são as fotos das ÚNICAS ${fotos.length} pessoas que podem aparecer nela: ${fotos.map((f, i) => `IMAGEM ${i + 2} = ${f.nome}`).join("; ")}.
Responda ok=false se a arte tiver: mais ou menos que ${fotos.length} ${fotos.length === 1 ? "pessoa" : "pessoas"}; a mesma pessoa duas vezes; alguém que não está nas fotos${proibido ? `; ${proibido}` : ""}. Primeiro conte em rostos quantos rostos humanos nítidos a arte tem (ignore silhuetas pequenas e escuras ao fundo); depois compare cada rosto com as fotos. Em motivo, diga o problema em poucas palavras.`,
      },
      { inlineData: { mimeType: "image/jpeg", data: arte.toString("base64") } },
      ...fotos.map((f) => ({ inlineData: { mimeType: f.mime, data: f.data.toString("base64") } })),
    ];
    const json = await generate(TEXT_MODEL, {
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { rostos: { type: "INTEGER" }, ok: { type: "BOOLEAN" }, motivo: { type: "STRING" } },
          required: ["rostos", "ok", "motivo"],
        },
      },
    });
    const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { rostos?: number; ok?: boolean; motivo?: string };
    const aMais = typeof parsed.rostos === "number" && parsed.rostos !== fotos.length;
    const motivo = parsed.motivo?.trim() || (aMais ? `${parsed.rostos} rostos na arte, esperados ${fotos.length}` : "");
    return { ok: parsed.ok !== false && !aMais, motivo };
  } catch {
    return { ok: true, motivo: "" };
  }
}

export type PessoaNoFrame = { box: [number, number, number, number]; apresentador: boolean };

/**
 * Onde está cada pessoa em primeiro plano no frame (caixas 0–1000, ymin,
 * xmin, ymax, xmax) e qual delas é o apresentador, comparando com as fotos
 * dele. Serve para recortar uma foto por pessoa: com o frame inteiro, o
 * modelo de imagem redesenha os rostos; com a foto de cada um, preserva.
 */
export async function detectPeople(frame: Buffer, apresentador: Buffer[]): Promise<PessoaNoFrame[]> {
  const parts: unknown[] = [
    {
      text: `A IMAGEM 1 é um frame de um episódio de podcast gravado num estabelecimento.${
        apresentador.length ? ` As imagens seguintes são fotos do APRESENTADOR do programa.` : ""
      }
Liste as pessoas em primeiro plano da IMAGEM 1 (ignore quem está ao fundo, desfocado ou cortado pela borda), com a caixa de cada uma do topo da cabeça até a cintura, em coordenadas 0–1000 [ymin, xmin, ymax, xmax], e diga se é o apresentador${apresentador.length ? " (compare com as fotos)" : " (sem fotos: false para todos)"}.`,
    },
    { inlineData: { mimeType: "image/jpeg", data: frame.toString("base64") } },
    ...apresentador.map((a) => ({ inlineData: { mimeType: "image/jpeg", data: a.toString("base64") } })),
  ];
  const json = await generate(TEXT_MODEL, {
    contents: [{ parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          pessoas: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { box: { type: "ARRAY", items: { type: "INTEGER" } }, apresentador: { type: "BOOLEAN" } },
              required: ["box", "apresentador"],
            },
          },
        },
        required: ["pessoas"],
      },
    },
  });
  const parsed = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { pessoas?: PessoaNoFrame[] };
  return (parsed.pessoas ?? []).filter((p) => Array.isArray(p.box) && p.box.length === 4 && p.box[2] > p.box[0] && p.box[3] > p.box[1]);
}

export type ImagemRef = { legenda: string; data: Buffer; mime: string };

export type AspectRatio = "16:9" | "9:16" | "4:5" | "3:4" | "1:1";

/**
 * Arte inteira desenhada pelo modelo a partir de imagens de referência
 * (fotos reais, logo, arte anterior). Cada imagem vai logo depois da
 * legenda dela, para o prompt poder citar "IMAGEM 2" sem ambiguidade.
 */
export async function renderWithRefs(
  prompt: string,
  refs: ImagemRef[],
  aspectRatio: AspectRatio,
  imageSize: "1K" | "2K" = "2K"
): Promise<Buffer> {
  const parts: unknown[] = [{ text: prompt }];
  refs.forEach((r, i) => {
    parts.push({ text: `IMAGEM ${i + 1} — ${r.legenda}` });
    parts.push({ inlineData: { mimeType: r.mime, data: r.data.toString("base64") } });
  });
  // Teto de saída no máximo: o modelo "pensa" antes de desenhar e, com prompt
  // longo, estourava o limite padrão sem entregar imagem (MAX_TOKENS).
  // Sem imagem, uma nova tentativa — costuma sair na segunda.
  let reason = "sem imagem";
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const json = await generate(IMAGE_MODEL, {
      contents: [{ parts }],
      generationConfig: { responseModalities: ["IMAGE"], maxOutputTokens: 32768, imageConfig: { aspectRatio, imageSize } },
    });
    const img = (json.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData)?.inlineData;
    if (img) return Buffer.from(img.data, "base64");
    reason = json.candidates?.[0]?.finishReason ?? json.promptFeedback?.blockReason ?? "sem imagem";
    // Bloqueio de conteúdo não muda numa nova tentativa.
    if (json.promptFeedback?.blockReason) break;
  }
  throw new Error(`Gemini não gerou a arte (${reason}).`);
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
