const BASE_TAG = "#ForaDaCaixa";
/** Revezadas por corte: a mesma trinca em todo post é sinal de automação. */
const TAG_POOL = ["#MogiGuaçu", "#podcast", "#podcastbrasil", "#cortesdepodcast", "#entrevista", "#interiorSP", "#MogiMirim"];

/**
 * Fechos do Instagram. Em 84 Reels (31/10 a 14/11/2026) houve 35
 * compartilhamentos e 28 comentários para 52 mil views: a legenda não pedia
 * nada. Uma pergunta puxa comentário e o "manda pra quem" puxa envio, que é
 * o que mais leva o Reel para gente nova.
 */
const PERGUNTAS = [
  "E você, concorda? Comenta aí 👇",
  "Já passou por isso? Conta nos comentários 👇",
  "Qual a sua opinião? Deixa nos comentários 👇",
  "Você faria diferente? Comenta 👇",
  "Isso acontece aí na sua cidade? 👇",
];
const ENVIOS = [
  "📲 Manda pra aquele amigo que precisa ver isso.",
  "📲 Marca quem vai se identificar.",
  "📲 Compartilha com quem é da região.",
  "📲 Envia pra quem sempre fala disso.",
];

function hash(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Duas hashtags do pool, sempre as mesmas para o mesmo corte. */
function tagsFor(seed: string): string {
  const h = hash(seed);
  const a = h % TAG_POOL.length;
  const b = (a + 1 + ((h >>> 8) % (TAG_POOL.length - 1))) % TAG_POOL.length;
  return [BASE_TAG, TAG_POOL[a], TAG_POOL[b]].join(" ");
}

type CutText = { title: string | null; description: string | null; file?: string };

/** Legenda padrão de um corte: título, descrição do Contenta e hashtags. */
export function defaultCaption(cut: CutText): string {
  return [cut.title, cut.description, tagsFor(cut.file ?? cut.title ?? "")].filter(Boolean).join("\n\n");
}

/** Legenda do Instagram: a padrão com pergunta e pedido de envio antes das hashtags. */
export function instagramCaption(cut: CutText): string {
  const seed = cut.file ?? cut.title ?? "";
  const h = hash(seed);
  const fecho = `${PERGUNTAS[h % PERGUNTAS.length]}\n${ENVIOS[(h >>> 4) % ENVIOS.length]}`;
  return [cut.title, cut.description, fecho, tagsFor(seed)].filter(Boolean).join("\n\n");
}

/** Legenda padrão por rede. */
export function captionFor(cut: CutText, platform: string): string {
  return platform === "instagram" ? instagramCaption(cut) : defaultCaption(cut);
}
