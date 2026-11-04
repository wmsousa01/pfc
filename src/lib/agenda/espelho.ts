import "server-only";
import { createHash } from "crypto";
import { site } from "@/lib/config";
import { BUCKET } from "@/lib/producao/store";
import { casarNoticias } from "./casar-noticias";
import { db, getEpisodio, logAgenda, materiaisDe, newToken, type Briefing, type Episodio, type Material, type Materia, type Roteiro } from "./store";

/**
 * Espelho da transmissão: o roteiro bloco a bloco com as imagens de cada
 * bloco, num link sem login para a equipe técnica (direção, switcher, GC)
 * acompanhar o âncora e os comentaristas. Quem estiver com o link marca o
 * bloco no ar e as outras telas seguem em poucos segundos.
 */

export type Noticia = NonNullable<Briefing["noticias"]>[number];

export type BlocoEspelho = {
  titulo: string;
  /** Abertura: o texto corrido do resumo. */
  texto: string | null;
  pontos: string[];
  /** PFC News: as notícias do bloco, com as fontes para o crédito do GC. */
  noticias: Noticia[];
  /** Roteiro do apresentador: a matéria inteira, como ele escreveu. */
  materia: Materia | null;
};

/** Parte das palavras da notícia que a matéria do apresentador precisa ter para receber o GC e as fotos dela. */
const MINIMO_MATERIA = 0.15;

/**
 * Com roteiro do apresentador, um bloco por matéria dele, e cada notícia da
 * pauta (fontes do GC e fotos) vai para a matéria que fala dela; a que ele
 * não usou fica de fora. Sem roteiro, a abertura (o resumo) e um bloco por
 * item da pauta da IA; a notícia que não casou fica na abertura, para não
 * sumir do GC.
 */
export function blocosDoEspelho(b: Briefing | null, roteiro: Roteiro | null = null): BlocoEspelho[] {
  const noticias = b?.noticias ?? [];
  if (roteiro?.materias.length) {
    const ms = roteiro.materias;
    const alvos = ms.map((m, i) => ({ i, m })).filter((x) => x.m.tipo === "materia");
    const onde = casarNoticias(
      alvos.map(({ m }) => ({ bloco: [m.titulo, m.manchete].filter(Boolean).join(" "), perguntas: [m.leitura ?? ""] })),
      noticias,
      MINIMO_MATERIA
    ).map((k) => (k < 0 ? -1 : alvos[k].i));
    return ms.map((m, i) => ({ titulo: m.titulo, texto: null, pontos: [], noticias: noticias.filter((_, k) => onde[k] === i), materia: m }));
  }
  if (!b) return [];
  const onde = casarNoticias(b.pauta, noticias);
  const doBloco = (i: number) => noticias.filter((_, k) => onde[k] === i);
  return [
    { titulo: "Abertura", texto: b.resumo || null, pontos: [], noticias: doBloco(-1), materia: null },
    ...b.pauta.map((p, i) => ({ titulo: p.bloco, texto: null, pontos: p.perguntas, noticias: doBloco(i), materia: null })),
  ];
}

/** "DfHjCCtDty1" de https://www.instagram.com/p/DfHjCCtDty1/: vai no nome das fotos tiradas do post. */
export const codigoDoPost = (url: string) => url.match(/\/(?:p|reel|tv)\/([^/?#]+)/)?.[1] ?? null;

/**
 * O espelho mudou de blocos (entrou ou saiu o roteiro do apresentador):
 * cada imagem segue a notícia do bloco em que estava — a foto do post pela
 * notícia de onde veio. Abertura continua na abertura e o último bloco no
 * último; imagem de bloco sem notícia sai do espelho e fica em Materiais.
 */
export async function remapearImagens(epId: string, antes: BlocoEspelho[], depois: BlocoEspelho[]): Promise<number> {
  let fora = 0;
  for (const m of await materiaisDe(epId)) {
    if (m.bloco == null) continue;
    const i = blocoDa(m, antes.length);
    const doBloco = antes[i]?.noticias ?? [];
    const daFoto = doBloco.find((n) => n.fontes.some((f) => {
      const c = codigoDoPost(f.url);
      return !!c && m.nome.includes(c);
    }));
    const titulos = new Set((daFoto ? [daFoto] : doBloco).map((n) => n.titulo));
    let novo: number | null = depois.findIndex((d) => d.noticias.some((n) => titulos.has(n.titulo)));
    if (novo < 0) novo = i === 0 ? 0 : i === antes.length - 1 ? depois.length - 1 : null;
    if (novo == null) fora++;
    if (novo !== m.bloco) await db().from("agenda_materiais").update({ bloco: novo }).eq("id", m.id);
  }
  return fora;
}

export const linkEspelho = (token: string) => `${site.url}/espelho/${token}`;

export async function episodioPorEspelho(token: string): Promise<Episodio | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const { data } = await db().from("agenda_episodios").select("*").eq("espelho_token", token).maybeSingle();
  return (data as Episodio) ?? null;
}

/** Cria o link do espelho, ou troca por um novo (o antigo para de abrir). */
export async function abrirEspelho(epId: string, actor: string, trocar = false): Promise<string> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  if (ep.espelho_token && !trocar) return ep.espelho_token;
  const token = newToken();
  const { error } = await db().from("agenda_episodios").update({ espelho_token: token }).eq("id", ep.id);
  if (error) throw new Error(error.message);
  await logAgenda(ep.id, actor, trocar ? "trocou o link do espelho" : "criou o link do espelho");
  return token;
}

/**
 * Põe um bloco no ar (null = antes de começar). Não mexe em updated_at:
 * ele é a revisão do roteiro, e as telas recarregam o espelho quando muda.
 * A tela do OBS volta para a primeira imagem do bloco novo.
 */
export async function moverEspelho(token: string, atual: number | null): Promise<number | null> {
  const ep = await episodioPorEspelho(token);
  if (!ep) throw new Error("Link inválido.");
  const total = blocosDoEspelho(ep.briefing, ep.roteiro).length;
  const v = atual == null || total === 0 ? null : Math.min(total - 1, Math.max(0, Math.trunc(atual)));
  const { error } = await db().from("agenda_episodios").update({ espelho_atual: v, espelho_imagem: null }).eq("id", ep.id);
  if (error) throw new Error(error.message);
  return v;
}

export const SEM_IMAGEM = "nenhuma";

/** Escolhe a imagem da tela do OBS: um material, SEM_IMAGEM ou null (a primeira do bloco). */
export async function escolherTela(token: string, imagem: string | null): Promise<void> {
  const ep = await episodioPorEspelho(token);
  if (!ep) throw new Error("Link inválido.");
  if (imagem && imagem !== SEM_IMAGEM && !(await materiaisDoEspelho(ep.id)).some((m) => m.id === imagem)) {
    throw new Error("Imagem fora do espelho.");
  }
  const { error } = await db().from("agenda_episodios").update({ espelho_imagem: imagem }).eq("id", ep.id);
  if (error) throw new Error(error.message);
}

/** Bloco da imagem no espelho: bloco que não existe mais (a pauta encolheu) vai para o último. */
export const blocoDa = (m: Material, total: number) => Math.min(m.bloco ?? 0, Math.max(0, total - 1));

/** O que a tela do OBS mostra agora: a imagem escolhida do bloco no ar ou a primeira dele. */
export function imagemNaTela(ep: Episodio, materiais: Material[]): { id: string; mime: string } | null {
  if (ep.espelho_atual == null || ep.espelho_imagem === SEM_IMAGEM) return null;
  const total = blocosDoEspelho(ep.briefing, ep.roteiro).length;
  const doBloco = materiais.filter((m) => blocoDa(m, total) === ep.espelho_atual);
  const m = doBloco.find((x) => x.id === ep.espelho_imagem) ?? doBloco[0];
  return m ? { id: m.id, mime: m.mime } : null;
}

/** Imagens e vídeos do espelho, na ordem em que foram enviados. */
export async function materiaisDoEspelho(epId: string): Promise<Material[]> {
  return (await materiaisDe(epId)).filter((m) => m.bloco != null && /^(image|video)\//.test(m.mime));
}

/** Muda quando o roteiro ou as imagens mudam: é o sinal para as telas recarregarem. */
export function revisaoEspelho(ep: Episodio, materiais: Material[]): string {
  return createHash("sha1")
    .update(JSON.stringify([ep.updated_at, materiais.map((m) => [m.id, m.bloco])]))
    .digest("base64url")
    .slice(0, 12);
}

/** URL assinada do arquivo, se ele for do episódio do link. */
export async function urlMaterialEspelho(token: string, materialId: string, baixar: boolean): Promise<string | null> {
  const ep = await episodioPorEspelho(token);
  if (!ep) return null;
  const { data: m } = await db().from("agenda_materiais").select("*").eq("id", materialId).eq("episodio_id", ep.id).maybeSingle();
  if (!m) return null;
  const { data } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(m.path, 3600, baixar ? { download: (m as Material).nome } : undefined);
  return data?.signedUrl ?? null;
}
