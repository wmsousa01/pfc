const BASE_TAG = "#ForaDaCaixa";
/** Revezadas por corte: a mesma trinca em todo post é sinal de automação. */
const TAG_POOL = ["#MogiGuaçu", "#podcast", "#podcastbrasil", "#cortesdepodcast", "#entrevista", "#interiorSP", "#MogiMirim"];

/** Duas hashtags do pool, sempre as mesmas para o mesmo corte. */
function tagsFor(seed: string): string {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = h % TAG_POOL.length;
  const b = (a + 1 + ((h >>> 8) % (TAG_POOL.length - 1))) % TAG_POOL.length;
  return [BASE_TAG, TAG_POOL[a], TAG_POOL[b]].join(" ");
}

/** Legenda padrão de um corte: título, descrição do Contenta e hashtags. */
export function defaultCaption(cut: { title: string | null; description: string | null; file?: string }): string {
  return [cut.title, cut.description, tagsFor(cut.file ?? cut.title ?? "")].filter(Boolean).join("\n\n");
}
