import "server-only";
import { listContentaJobs, listJobCuts } from "./contenta";
import { QUADROS, QUADRO_IDS, type QuadroId } from "./quadros";
import { db, getConfig, setConfig } from "./store";
import {
  addToPlaylist,
  createPlaylist,
  listPlaylistVideoIds,
  listPlaylists,
  listRecentUploads,
} from "./youtube-api";

/*
 * Cada quadro tem a playlist dos episódios (a equipe já põe a live nela) e a
 * dos cortes (quadros.ts). O quadro do corte vem da live de origem: o job do
 * Contenta guarda a URL da live, e a live está na playlist de episódios.
 */
/** Short também entra aqui, além da playlist de cortes do quadro. */
const SHORTS = "Shorts";
/** Mesmo limite do pipeline: até 3 min é Short. */
const SHORT_MAX_SEC = 180;
/** PFC Visita sobe o arquivo direto no Contenta, sem live: o nome do arquivo diz o quadro. */
const VISITA_FILE = /pfc[\s_-]*visita/i;
/** Jobs do Contenta olhados por rodada (cada um é uma leitura do meta.json). */
const JOBS_PER_RUN = 30;
/** 50 de cota por inserção: 80 = 4.000 dos 10.000 do dia, sobra para os uploads. */
const MAX_INSERTS = 80;
/** Corte sem origem só vira aviso se for recente. */
const ORPHAN_DAYS = 14;

export const PLAYLISTS_RESULT = "playlists_ultimo";

export type PlaylistsResult = {
  at: string;
  adicionados: number;
  criadas: string[];
  semOrigem: { id: string; title: string }[];
  erro?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Inclusões seguidas na mesma playlist voltam 409 ABORTED / 5xx de vez em
 * quando: espera e tenta de novo.
 */
async function addWithRetry(playlistId: string, videoId: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await addToPlaylist(playlistId, videoId);
      await sleep(400);
      return;
    } catch (e) {
      const transient = /YouTube (409|5\d\d)/.test(e instanceof Error ? e.message : "");
      if (!transient || attempt >= 4) throw e;
      await sleep(1500 * attempt);
    }
  }
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function youtubeIdOf(source: string | null): string | null {
  if (!source) return null;
  if (/^[\w-]{11}$/.test(source)) return source;
  return /(?:[?&]v=|youtu\.be\/|\/live\/|\/shorts\/)([\w-]{11})/.exec(source)?.[1] ?? null;
}

/** Título do corte → de onde ele veio (id da live ou o quadro, no caso do PFC Visita). */
async function cutOrigins(): Promise<Map<string, { liveId: string | null; quadro: QuadroId | null }>> {
  const jobs = (await listContentaJobs())
    .filter((j) => j.status === "done" && j.totalCuts > 0)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
    .slice(0, JOBS_PER_RUN);
  const out = new Map<string, { liveId: string | null; quadro: QuadroId | null }>();
  for (const j of jobs) {
    const liveId = youtubeIdOf(j.videoSource);
    const quadro = !liveId && VISITA_FILE.test(j.videoSource ?? "") ? ("pfc-visita" as const) : null;
    if (!liveId && !quadro) continue;
    const cuts = await listJobCuts(j.jobId).catch(() => null);
    for (const c of cuts?.items ?? []) {
      const key = norm(c.title);
      if (key && !out.has(key)) out.set(key, { liveId, quadro });
    }
  }
  return out;
}

/** Título do corte → quadro, ou null quando não dá para saber a origem. */
async function quadroResolver(byTitle: Map<string, string>): Promise<(title: string) => QuadroId | null> {
  // Live → quadro, pela playlist de episódios em que a equipe pôs a live.
  const liveQuadro = new Map<string, QuadroId>();
  for (const q of QUADRO_IDS) {
    const id = byTitle.get(norm(QUADROS[q].episodes));
    if (!id) continue;
    for (const v of await listPlaylistVideoIds(id)) if (!liveQuadro.has(v)) liveQuadro.set(v, q);
  }
  const origins = await cutOrigins();
  return (title) => {
    const o = origins.get(norm(title));
    return o?.quadro ?? (o?.liveId ? liveQuadro.get(o.liveId) ?? null : null);
  };
}

let cachedResolver: { at: number; fn: (title: string) => QuadroId | null } | null = null;

/** Quadro de um corte pelo título. Guarda a leitura por 10 min: a rodada gera thumbs em sequência. */
export async function detectQuadro(title: string): Promise<QuadroId | null> {
  if (!cachedResolver || Date.now() - cachedResolver.at > 10 * 60_000) {
    const byTitle = new Map((await listPlaylists()).map((p) => [norm(p.title), p.id]));
    cachedResolver = { at: Date.now(), fn: await quadroResolver(byTitle) };
  }
  return cachedResolver.fn(title);
}

/** Põe os cortes recentes do canal nas playlists do quadro (e Shorts). Idempotente. */
export async function runPlaylists(): Promise<PlaylistsResult> {
  const result: PlaylistsResult = { at: new Date().toISOString(), adicionados: 0, criadas: [], semOrigem: [] };
  const byTitle = new Map((await listPlaylists()).map((p) => [norm(p.title), p.id]));
  const quadroOf = await quadroResolver(byTitle);
  cachedResolver = { at: Date.now(), fn: quadroOf };
  const members = new Map<string, Set<string>>();
  const playlistOf = async (title: string): Promise<string> => {
    let id = byTitle.get(norm(title));
    if (!id) {
      id = await createPlaylist(title);
      byTitle.set(norm(title), id);
      members.set(id, new Set());
      result.criadas.push(title);
    }
    if (!members.has(id)) members.set(id, new Set(await listPlaylistVideoIds(id)));
    return id;
  };

  const inSomeCutPlaylist = async (videoId: string): Promise<boolean> => {
    for (const q of QUADRO_IDS) {
      if (!byTitle.has(norm(QUADROS[q].cuts))) continue;
      const id = await playlistOf(QUADROS[q].cuts);
      if (members.get(id)!.has(videoId)) return true;
    }
    return false;
  };
  const recentCut = Date.now() - ORPHAN_DAYS * 86_400_000;
  const uploads = (await listRecentUploads(50)).filter(
    (v) => !v.liveEndedAt && v.liveState === "none" && v.durationSec > 0 && v.durationSec < 3600
  );

  // O quadro também vai para o cartão do corte na Produção (identidade da thumb).
  const found = new Map<QuadroId, string[]>();
  try {
    for (const v of uploads) {
      const quadro = quadroOf(v.title);
      if (quadro) found.set(quadro, [...(found.get(quadro) ?? []), v.id]);
      if (!quadro) {
        if (new Date(v.uploadedAt).getTime() < recentCut) continue;
        // Já posto à mão numa playlist de cortes não é órfão.
        if (!(await inSomeCutPlaylist(v.id))) result.semOrigem.push({ id: v.id, title: v.title });
        continue;
      }
      const targets = [QUADROS[quadro].cuts];
      if (v.durationSec <= SHORT_MAX_SEC) targets.push(SHORTS);
      for (const t of targets) {
        const id = await playlistOf(t);
        if (members.get(id)!.has(v.id)) continue;
        if (result.adicionados >= MAX_INSERTS) throw new Error(`Limite de ${MAX_INSERTS} por rodada; o resto vai na próxima.`);
        try {
          await addWithRetry(id, v.id);
          members.get(id)!.add(v.id);
          result.adicionados++;
        } catch (e) {
          // Um vídeo que falhou não segura os outros; a próxima rodada tenta de novo.
          if (/YouTube 403/.test(e instanceof Error ? e.message : "")) throw e;
          result.erro = `"${v.title}" não entrou em ${t}: ${(e instanceof Error ? e.message : String(e)).slice(0, 200)}`;
        }
      }
    }
  } catch (e) {
    result.erro = e instanceof Error ? e.message : String(e);
  }

  for (const [quadro, ids] of Array.from(found)) {
    await db().from("producao_videos").update({ quadro }).in("youtube_id", ids).is("quadro", null);
  }
  await setConfig(PLAYLISTS_RESULT, JSON.stringify(result));
  return result;
}

export async function lastPlaylistsResult(): Promise<PlaylistsResult | null> {
  const v = await getConfig(PLAYLISTS_RESULT);
  try {
    return v ? (JSON.parse(v) as PlaylistsResult) : null;
  } catch {
    return null;
  }
}
