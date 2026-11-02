import "server-only";
import sharp from "sharp";
import { QUADROS, isQuadroId, type QuadroId } from "@/lib/producao/quadros";
import { download, getConfig, signedUrls, type Headline } from "@/lib/producao/store";
import {
  addToPlaylist,
  connectedChannel,
  createBroadcast,
  deleteBroadcast,
  listPlaylists,
  setThumbnail,
  updateBroadcast,
} from "@/lib/producao/youtube-api";
import { MetaError, igBusinessDiscovery, igContainerStatus, igCreateImage, igPublish } from "@/lib/social/meta";
import { activeConnection, revokeConnection } from "@/lib/social/store";
import { gerarArtes } from "./arte";
import { gerarBriefing } from "./briefing";
import { calendarAccount, deleteEvent, upsertEvent } from "./gcal";
import {
  CONVIDADO,
  convidadosDe,
  db,
  getArte,
  getEpisodio,
  logAgenda,
  newToken,
  updateConvidado,
  updateEpisodio,
  vagasLivres,
  type Convidado,
  type Episodio,
  type IgFormato,
} from "./store";

export const AUTOMACAO = "automação";
/** Stream fixo do estúdio (a chave do OBS) em que toda live nova é ligada. */
export const YT_STREAM_KEY = "yt_stream_id";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const youtubeUrl = (ep: Pick<Episodio, "yt_broadcast_id">) =>
  ep.yt_broadcast_id ? `https://www.youtube.com/watch?v=${ep.yt_broadcast_id}` : null;

async function mustGet(id: string): Promise<Episodio> {
  const ep = await getEpisodio(id);
  if (!ep) throw new Error("Episódio não encontrado.");
  return ep;
}

// ---- Convidado: foto e perfil do Instagram ----

/** Foto do convidado, já girada e no máximo 1600 px. */
export async function salvarFoto(convidadoId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("A foto precisa ser uma imagem (JPG, PNG ou WebP).");
  const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  const path = `agenda/convidados/${convidadoId}.jpg`;
  const { error } = await db().storage.from("producao").upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(`Storage: ${error.message}`);
  await updateConvidado(convidadoId, { foto_path: path });
  return path;
}

/** Lê o perfil público do convidado. Sem Instagram conectado ou perfil pessoal, grava o motivo. */
export async function atualizarPerfilIg(c: Convidado): Promise<void> {
  if (!c.instagram) return;
  const conn = await activeConnection("instagram");
  if (!conn) return;
  try {
    const p = await igBusinessDiscovery(conn.accountId, conn.token, c.instagram);
    await updateConvidado(c.id, { ig_perfil: p });
  } catch (e) {
    const erro =
      e instanceof MetaError && e.code === 110
        ? "Perfil pessoal ou inexistente: a Meta só mostra contas Business/Creator."
        : msg(e);
    await updateConvidado(c.id, { ig_perfil: { username: c.instagram, name: null, biography: null, followers: null, picture: null, erro } });
  }
}

// ---- Agendamento ----

export type NovoConvidado = {
  nome: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  bio: string | null;
  temas: string | null;
  divulgar: string | null;
  links: string | null;
};

/**
 * Pedido do próprio convidado (link público). O horário tem que estar entre
 * as vagas livres agora; o índice único segura dois pedidos no mesmo segundo.
 */
export async function agendar(quadro: QuadroId, inicio: string, dados: NovoConvidado): Promise<Convidado> {
  const vaga = (await vagasLivres(quadro)).find((v) => v.inicio === inicio);
  if (!vaga) throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
  return criarEpisodio({ quadro, inicio, duracao_min: vaga.duracao_min, tema: null }, dados, null);
}

/** Episódio novo com o primeiro convidado. `actor` null = o próprio convidado. */
export async function criarEpisodio(
  ep: { quadro: QuadroId; inicio: string; duracao_min: number; tema: string | null },
  dados: NovoConvidado,
  actor: string | null
): Promise<Convidado> {
  const { data: novo, error } = await db()
    .from("agenda_episodios")
    .insert({ ...ep, status: actor ? "confirmado" : "solicitado", created_by: actor })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Esse horário acabou de ser ocupado. Escolha outro.");
    throw new Error(error.message);
  }
  const c = await adicionarConvidado(novo.id, dados);
  await logAgenda(novo.id, actor ?? CONVIDADO, actor ? "criou o episódio" : "pediu o horário", dados.nome);
  return c;
}

export async function adicionarConvidado(episodioId: string, dados: NovoConvidado): Promise<Convidado> {
  const { data, error } = await db()
    .from("agenda_convidados")
    .insert({ episodio_id: episodioId, token: newToken(), ...dados, briefing_em: dados.bio || dados.temas ? new Date().toISOString() : null })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Convidado;
}

// ---- Google Calendar ----

/** Cria/atualiza o evento. Sem agenda conectada, não faz nada; erro vai para o histórico. */
export async function sincronizarAgenda(epId: string, actor: string): Promise<void> {
  if (!(await calendarAccount())) return;
  const ep = await mustGet(epId);
  try {
    if (ep.status === "cancelado") {
      if (ep.gcal_event_id) {
        await deleteEvent(ep.gcal_event_id);
        await updateEpisodio(ep.id, { gcal_event_id: null });
      }
      return;
    }
    if (ep.status !== "confirmado") return;
    const eventId = await upsertEvent(ep, await convidadosDe(ep.id), youtubeUrl(ep));
    if (eventId !== ep.gcal_event_id) await updateEpisodio(ep.id, { gcal_event_id: eventId });
  } catch (e) {
    await logAgenda(ep.id, actor, "falhou no Google Calendar", msg(e));
  }
}

// ---- Status ----

export async function confirmar(epId: string, actor: string): Promise<void> {
  const ep = await mustGet(epId);
  if (ep.status === "cancelado") throw new Error("Episódio cancelado: crie outro.");
  await updateEpisodio(ep.id, { status: "confirmado" });
  await logAgenda(ep.id, actor, "confirmou");
  await sincronizarAgenda(ep.id, actor);
  // O briefing já fica pronto para o apresentador; falha aqui não desfaz a confirmação.
  if (!ep.briefing) await gerarBriefingPara(ep.id, AUTOMACAO).catch((e) => logAgenda(ep.id, AUTOMACAO, "falhou no briefing", msg(e)));
}

export async function cancelar(epId: string, actor: string, motivo: string | null): Promise<void> {
  const ep = await mustGet(epId);
  await updateEpisodio(ep.id, { status: "cancelado", ig_status: ep.ig_status === "agendado" ? "nenhum" : ep.ig_status });
  await logAgenda(ep.id, actor, "cancelou", motivo ?? undefined);
  await sincronizarAgenda(ep.id, actor);
  if (ep.yt_broadcast_id) {
    await deleteBroadcast(ep.yt_broadcast_id)
      .then(() => updateEpisodio(ep.id, { yt_broadcast_id: null }))
      .catch((e) => logAgenda(ep.id, actor, "falhou ao apagar a live", msg(e)));
  }
}

export async function remarcar(epId: string, inicio: Date, duracaoMin: number, actor: string): Promise<void> {
  const ep = await mustGet(epId);
  const { error } = await db()
    .from("agenda_episodios")
    .update({ inicio: inicio.toISOString(), duracao_min: duracaoMin, updated_at: new Date().toISOString() })
    .eq("id", ep.id);
  if (error) throw new Error(error.code === "23505" ? "Já tem episódio desse quadro nesse horário." : error.message);
  await logAgenda(ep.id, actor, "remarcou", inicio.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }));
  await sincronizarAgenda(ep.id, actor);
  if (ep.yt_broadcast_id) await sincronizarLive(ep.id, actor);
}

// ---- Briefing e artes ----

export async function gerarBriefingPara(epId: string, actor: string): Promise<void> {
  const ep = await mustGet(epId);
  const convidados = await convidadosDe(ep.id);
  if (convidados.length === 0) throw new Error("Episódio sem convidado.");
  const b = await gerarBriefing(ep, convidados);
  await updateEpisodio(ep.id, { briefing: b, ig_legenda: ep.ig_legenda ?? b.legenda_ig });
  await logAgenda(ep.id, actor, "gerou o briefing");
}

export async function gerarArtesPara(epId: string, actor: string, headline: Headline | null): Promise<void> {
  const ep = await mustGet(epId);
  const convidados = await convidadosDe(ep.id);
  if (convidados.length === 0) throw new Error("Episódio sem convidado.");
  const h = headline ?? ep.briefing?.arte;
  if (!h?.l1 || !h.l2) throw new Error("Gere o briefing ou escreva a headline da arte.");
  const arte = await gerarArtes(ep, convidados, h, actor);
  await logAgenda(ep.id, actor, "gerou as artes", [h.l1, h.l2, h.l3].filter(Boolean).join(" / "));
  // A primeira arte já entra aprovada; trocar é um clique.
  if (!ep.arte_id) await updateEpisodio(ep.id, { arte_id: arte.id });
}

export async function aprovarArte(epId: string, arteId: string, actor: string): Promise<void> {
  const ep = await mustGet(epId);
  const arte = await getArte(arteId);
  if (!arte || arte.episodio_id !== ep.id) throw new Error("Arte não encontrada.");
  await updateEpisodio(ep.id, { arte_id: arte.id });
  await logAgenda(ep.id, actor, "escolheu a arte");
  // Live já criada recebe a thumb nova.
  if (ep.yt_broadcast_id) {
    const jpeg = await download(arte.thumb_path);
    if (jpeg) await setThumbnail(ep.yt_broadcast_id, jpeg).catch((e) => logAgenda(ep.id, actor, "falhou na thumb da live", msg(e)));
  }
}

// ---- Live no YouTube ----

function liveInput(ep: Episodio, convidados: Convidado[]) {
  const quadro = isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro;
  const nomes = convidados.map((c) => c.nome).join(" e ");
  const start = new Date(ep.inicio);
  return {
    title: ep.briefing?.titulo_live || `${quadro} com ${nomes}${ep.tema ? ` | ${ep.tema}` : ""}`,
    description: ep.briefing?.descricao_yt || `${quadro} ao vivo com ${nomes}.`,
    start,
    end: new Date(start.getTime() + ep.duracao_min * 60_000),
  };
}

/** Cria a live (ou atualiza, se já existe), com a thumb aprovada e na playlist do quadro. */
export async function sincronizarLive(epId: string, actor: string): Promise<string> {
  const ep = await mustGet(epId);
  if (ep.status !== "confirmado") throw new Error("Confirme o episódio antes de criar a live.");
  if (!(await connectedChannel())) throw new Error("Canal do YouTube não conectado (/admin/producao/config).");
  const convidados = await convidadosDe(ep.id);
  const input = liveInput(ep, convidados);

  if (ep.yt_broadcast_id) {
    await updateBroadcast(ep.yt_broadcast_id, input);
    await logAgenda(ep.id, actor, "atualizou a live");
    return ep.yt_broadcast_id;
  }

  const id = await createBroadcast(input, await getConfig(YT_STREAM_KEY));
  await updateEpisodio(ep.id, { yt_broadcast_id: id });
  await logAgenda(ep.id, actor, "criou a live", input.title);

  // Daqui para baixo é acabamento: falha vira aviso no histórico, a live fica.
  const arte = ep.arte_id ? await getArte(ep.arte_id) : null;
  const jpeg = arte ? await download(arte.thumb_path) : null;
  if (jpeg) await setThumbnail(id, jpeg).catch((e) => logAgenda(ep.id, actor, "falhou na thumb da live", msg(e)));
  if (isQuadroId(ep.quadro)) {
    const titulo = QUADROS[ep.quadro].episodes;
    await listPlaylists()
      .then((pls) => pls.find((p) => p.title.trim().toLowerCase() === titulo.toLowerCase()))
      .then((pl) => (pl ? addToPlaylist(pl.id, id) : undefined))
      .catch((e) => logAgenda(ep.id, actor, "falhou ao pôr na playlist", msg(e)));
  }
  // O convite da agenda ganha o link da live.
  await sincronizarAgenda(ep.id, actor);
  return id;
}

// ---- Instagram: arte de divulgação ----

export async function programarInstagram(
  epId: string,
  opts: { formatos: IgFormato[]; legenda: string; collab: boolean; quando: Date | null },
  actor: string
): Promise<void> {
  const ep = await mustGet(epId);
  if (!ep.arte_id) throw new Error("Gere e escolha a arte primeiro.");
  if (opts.formatos.length === 0) throw new Error("Escolha feed, story ou os dois.");
  if (!(await activeConnection("instagram"))) throw new Error("Instagram não conectado (/admin/marketing).");
  await updateEpisodio(ep.id, {
    ig_formatos: opts.formatos,
    ig_legenda: opts.legenda,
    ig_collab: opts.collab,
    ig_publicar_em: (opts.quando ?? new Date()).toISOString(),
    ig_status: "agendado",
    ig_erro: null,
  });
  await logAgenda(ep.id, actor, opts.quando ? "programou o Instagram" : "mandou publicar no Instagram", opts.formatos.join(" + "));
  if (!opts.quando) await publicarInstagram(ep.id);
}

/** Publica os formatos que ainda não saíram. Reentrante: o que já saiu fica em ig_posts. */
async function publicarInstagram(epId: string): Promise<void> {
  // Trava: só uma rodada pega o episódio.
  const { data: claimed } = await db()
    .from("agenda_episodios")
    .update({ ig_status: "publicando", updated_at: new Date().toISOString() })
    .eq("id", epId)
    .eq("ig_status", "agendado")
    .select("*")
    .maybeSingle();
  if (!claimed) return;
  const ep = claimed as Episodio;
  const conn = await activeConnection("instagram");
  try {
    if (!conn) throw new Error("Instagram não conectado (/admin/marketing).");
    const arte = ep.arte_id ? await getArte(ep.arte_id) : null;
    if (!arte) throw new Error("Arte não encontrada.");
    const convidados = await convidadosDe(ep.id);
    const collaborators = ep.ig_collab ? convidados.map((c) => c.instagram).filter((v): v is string => !!v) : [];
    const urls = await signedUrls([arte.feed_path, arte.story_path]);

    const posts = [...ep.ig_posts];
    for (const formato of ep.ig_formatos) {
      if (posts.some((p) => p.formato === formato)) continue;
      const url = urls.get(formato === "feed" ? arte.feed_path : arte.story_path);
      if (!url) throw new Error("Não consegui assinar a URL da arte.");
      const container = await igCreateImage(conn.accountId, conn.token, url, {
        story: formato === "story",
        caption: ep.ig_legenda ?? "",
        collaborators,
      });
      // Imagem costuma ficar pronta na hora; espera até 30 s por garantia.
      for (let i = 0; i < 6; i++) {
        const s = await igContainerStatus(container, conn.token);
        if (s.code === "FINISHED") break;
        if (s.code === "ERROR" || s.code === "EXPIRED") throw new Error(`Instagram recusou a arte: ${s.detail ?? s.code}`);
        await sleep(5_000);
      }
      const r = await igPublish(conn.accountId, conn.token, container);
      posts.push({ formato, id: r.id, url: r.url });
      await updateEpisodio(ep.id, { ig_posts: posts });
      await logAgenda(ep.id, AUTOMACAO, `publicou no Instagram (${formato})`, r.url ?? undefined);
    }
    await updateEpisodio(ep.id, { ig_status: "publicado", ig_erro: null });
  } catch (e) {
    if (e instanceof MetaError && e.tokenDead && conn) await revokeConnection(conn.id);
    await updateEpisodio(ep.id, { ig_status: "erro", ig_erro: msg(e) });
    await logAgenda(ep.id, AUTOMACAO, "falhou no Instagram", msg(e));
  }
}

/**
 * Rodada da agenda, junto da fila social (a cada 5 min): publica os posts
 * programados que venceram e dá baixa nos episódios que já passaram.
 */
export async function runAgendaQueue(): Promise<{ instagram: number; realizados: number }> {
  const agora = new Date().toISOString();
  const { data: devidos } = await db()
    .from("agenda_episodios")
    .select("id")
    .eq("ig_status", "agendado")
    .neq("status", "cancelado")
    .lte("ig_publicar_em", agora)
    .limit(3);
  for (const d of devidos ?? []) await publicarInstagram(d.id);

  // Confirmado cuja gravação terminou há mais de 3 h vira realizado.
  const { data: passados } = await db()
    .from("agenda_episodios")
    .select("id, inicio, duracao_min")
    .eq("status", "confirmado")
    .lt("inicio", agora);
  let realizados = 0;
  for (const p of passados ?? []) {
    const fim = new Date(p.inicio).getTime() + (p.duracao_min + 180) * 60_000;
    if (fim > Date.now()) continue;
    await updateEpisodio(p.id, { status: "realizado" });
    await logAgenda(p.id, AUTOMACAO, "marcou como realizado");
    realizados++;
  }
  return { instagram: (devidos ?? []).length, realizados };
}
