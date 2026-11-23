import "server-only";
import { TEXT_MODEL, generate, isGeminiConfigured } from "@/lib/producao/gemini";
import { listContentaJobs } from "@/lib/producao/contenta";

/**
 * Título e descrição do Short no YouTube.
 *
 * O título do Contenta é feito para ser queimado na tela ("promessa" de até 6
 * palavras) e costuma sair na fórmula "Tema: o X" ("Ter um filho: o fim do
 * medo"). No Analytics de 90 dias até 14/11/2026, os shorts nessa fórmula
 * tiveram mediana de 7 views, contra 31 dos que não usam (197 × 233 shorts).
 * Por isso o título que vai para o YouTube é reescrito quando cai na fórmula.
 * Título escrito pela equipe sem dois-pontos passa intacto.
 */
const FORMULA = /^[^:]{2,60}:\s+\S/;

export function isFormulaTitle(title: string): boolean {
  return FORMULA.test(title.trim());
}

async function rewriteTitle(title: string, context: string): Promise<string | null> {
  const prompt = `Você escreve títulos de YouTube Shorts para o podcast "Papo Fora da Caixa", de Mogi Guaçu (SP).
Título atual (feito para aparecer na tela do vídeo): ${title}
Contexto do corte: ${context.slice(0, 1500)}

Reescreva como título de YouTube Shorts, em português do Brasil:
- até 50 caracteres
- SEM dois-pontos e sem a fórmula "assunto: o segredo / o fim / o preço"
- uma situação concreta, um fato, um número ou uma pergunta direta ao espectador ("Você é o vilão do Toy Story?")
- NÃO invente nada: nenhum fato, valor, opinião ou primeira pessoa ("eu", "paguei") que não esteja no título ou no contexto
- se o contexto for pouco, só reorganize o que o título atual já diz numa frase natural
- sem palavras inteiras em maiúsculas, sem emoji, sem hashtag`;
  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: { type: "OBJECT", properties: { title: { type: "STRING" } }, required: ["title"] },
    },
  });
  const raw = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { title?: string };
  const t = (raw.title ?? "").replace(/\s+/g, " ").replace(/^["“]|["”]$/g, "").trim();
  if (!t || t.length > 70 || t.includes(":")) return null;
  return t;
}

/** Live de origem do corte, para o link do episódio completo na descrição. */
async function episodeUrl(jobId: string): Promise<string | null> {
  try {
    const job = (await listContentaJobs()).find((j) => j.jobId === jobId);
    const id = job?.videoSource?.match(/(?:v=|\/live\/|youtu\.be\/|\/shorts\/)([\w-]{11})/)?.[1];
    return id ? `https://youtu.be/${id}` : null;
  } catch {
    return null;
  }
}

export async function youtubeShortMeta(p: {
  title: string;
  caption: string;
  contenta_job_id: string;
}): Promise<{ title: string; description: string }> {
  let title = p.title;
  if (isFormulaTitle(title) && isGeminiConfigured()) {
    title = (await rewriteTitle(title, p.caption).catch(() => null)) ?? title;
  }
  const ep = await episodeUrl(p.contenta_job_id);
  // O link vai no começo: no Short, só as primeiras linhas da descrição aparecem.
  const description = [ep && `▶ Episódio completo: ${ep}`, p.caption].filter(Boolean).join("\n\n");
  return { title, description };
}
