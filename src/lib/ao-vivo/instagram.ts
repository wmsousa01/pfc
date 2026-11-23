import "server-only";
import QRCode from "qrcode";
import { db } from "@/lib/producao/store";
import { QUADROS, type QuadroId } from "@/lib/producao/quadros";
import { MetaError, graph, igBusinessDiscovery } from "@/lib/social/meta";
import { activeConnection } from "@/lib/social/store";

/**
 * Instagram do convidado do dia, para a cena do OBS: perfil, seguidores, bio,
 * posts recentes e um QR para o perfil. Tudo pela API oficial (Business
 * Discovery, com a conta do PFC conectada em /admin/marketing): abrir o
 * instagram.com direto no OBS cai na tela de login.
 */

export type PostTela = { id: string; imagem: string; curtidas: number | null; video: boolean };

export type PerfilTela = {
  username: string;
  nome: string;
  bio: string | null;
  seguidores: number | null;
  foto: string | null;
  qr: string;
  posts: PostTela[];
  /** Perfil pessoal, conta inexistente ou Instagram desconectado: a cena mostra só o @. */
  aviso: string | null;
};

export type InstagramTela = { quadro: string; cor: string; titulo: string | null; perfis: PerfilTela[] };

const CACHE_MS = 10 * 60_000;
const cache = new Map<string, { ate: number; perfil: PerfilTela }>();

/** Posts com imagem: no vídeo e no Reel vale a capa (thumbnail_url). */
async function postsDe(igId: string, token: string, username: string): Promise<PostTela[]> {
  const r = await graph<{ business_discovery?: { media?: { data?: Record<string, unknown>[] } } }>(`/${igId}`, {
    fields: `business_discovery.username(${username}){media.limit(18){id,media_type,media_url,thumbnail_url,like_count}}`,
    access_token: token,
  });
  return (r.business_discovery?.media?.data ?? [])
    .map((m) => {
      const video = m.media_type === "VIDEO";
      const imagem = (video ? m.thumbnail_url : m.media_url) as string | undefined;
      return imagem ? { id: String(m.id), imagem, curtidas: typeof m.like_count === "number" ? m.like_count : null, video } : null;
    })
    .filter((p): p is PostTela => !!p)
    .slice(0, 6);
}

export async function perfilDe(username: string, nomeAgenda: string): Promise<PerfilTela> {
  const c = cache.get(username);
  if (c && c.ate > Date.now()) return c.perfil;
  const qr = await QRCode.toDataURL(`https://www.instagram.com/${username}/`, { width: 420, margin: 1, errorCorrectionLevel: "M" });
  const base: PerfilTela = { username, nome: nomeAgenda, bio: null, seguidores: null, foto: null, qr, posts: [], aviso: null };
  // Conexão que não abre (token ou chave com problema) não pode derrubar a cena no ar.
  const conn = await activeConnection("instagram").catch(() => null);
  let perfil = base;
  if (!conn) perfil = { ...base, aviso: "Instagram do PFC desconectado em /admin/marketing." };
  else {
    try {
      const [p, posts] = await Promise.all([igBusinessDiscovery(conn.accountId, conn.token, username), postsDe(conn.accountId, conn.token, username)]);
      perfil = { ...base, nome: p.name || nomeAgenda, bio: p.biography, seguidores: p.followers, foto: p.picture, posts };
    } catch (e) {
      perfil = {
        ...base,
        aviso: e instanceof MetaError && e.code === 110 ? "Perfil pessoal: a Meta só mostra contas comerciais ou de criador." : "Não deu para ler o perfil agora.",
      };
    }
  }
  // Falha fica pouco tempo no cache, para a próxima tentativa vir logo.
  cache.set(username, { ate: Date.now() + (perfil.aviso ? 60_000 : CACHE_MS), perfil });
  return perfil;
}

/** O episódio do quadro mais perto de agora (de 10 h antes a 14 h depois) e seus convidados com Instagram. */
export async function instagramDoDia(quadro: QuadroId): Promise<InstagramTela> {
  const agora = Date.now();
  const { data: eps } = await db()
    .from("agenda_episodios")
    .select("id, tema, inicio")
    .eq("quadro", quadro)
    .neq("status", "cancelado")
    .gte("inicio", new Date(agora - 10 * 3600_000).toISOString())
    .lte("inicio", new Date(agora + 14 * 3600_000).toISOString());
  const ep = (eps ?? []).sort((a, b) => Math.abs(new Date(a.inicio).getTime() - agora) - Math.abs(new Date(b.inicio).getTime() - agora))[0];
  const tema = QUADROS[quadro];
  const vazio = { quadro: tema.name, cor: tema.accent[1], titulo: ep?.tema ?? null, perfis: [] };
  if (!ep) return vazio;
  const { data: cs } = await db()
    .from("agenda_convidados")
    .select("nome, instagram")
    .eq("episodio_id", ep.id)
    .not("instagram", "is", null)
    .order("created_at");
  const lista = (cs ?? []).filter((c) => c.instagram);
  return { ...vazio, perfis: await Promise.all(lista.map((c) => perfilDe(String(c.instagram), c.nome))) };
}
