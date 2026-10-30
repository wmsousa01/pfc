import "server-only";
import { jobFailed, listContentaJobs, startCuts, type ContentaJob, type CutMode } from "./contenta";
import { clearConfig, db, getConfig, setConfig } from "./store";

/** Última recusa do Contenta, mostrada no painel até a próxima leitura dar certo. */
export const CONTENTA_ERROR = "contenta_erro";
import { listRecentUploads } from "./youtube-api";

export type LiveStatus = "detectada" | "cortando" | "cortada" | "ja_cortada" | "ignorada" | "erro";

export type LiveJob = {
  mode: CutMode;
  jobId: string;
  runId: string | null;
  status: "processing" | "done" | "failed";
  totalCuts: number;
};

export type ProducaoLive = {
  id: string;
  youtube_id: string;
  title: string;
  privacy: string | null;
  duration_sec: number | null;
  ended_at: string | null;
  thumb_url: string | null;
  status: LiveStatus;
  jobs: LiveJob[];
  error: string | null;
  triggered_by: string | null;
  triggered_at: string | null;
  created_at: string;
  updated_at: string;
};

const ALL_MODES: CutMode[] = ["shorts", "long"];
/** O YouTube ainda processa o VOD logo depois do fim da live. */
const VOD_GRACE_MS = 30 * 60_000;
/** Por rodada do cron: cada live vira dois jobs pesados no Contenta. */
const AUTO_PER_RUN = 2;

async function patch(id: string, p: Partial<ProducaoLive>) {
  const { error } = await db()
    .from("producao_lives")
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Data a partir da qual a automação dispara sozinha. Gravada na primeira
 * leitura: as lives anteriores ao recurso aparecem no painel, mas só são
 * cortadas se alguém clicar — sem isso a primeira rodada cortaria o arquivo
 * inteiro do canal.
 */
async function autoSince(): Promise<Date> {
  const v = await getConfig("lives_auto_since");
  if (v) return new Date(v);
  const now = new Date();
  await setConfig("lives_auto_since", now.toISOString());
  return now;
}

/**
 * Job do Contenta que já cortou esta live, sem contar os que o próprio hub
 * disparou. Casa pelo id do vídeo em qualquer formato de link
 * (watch?v=, /live/, youtu.be/).
 */
function cutElsewhere(youtubeId: string, jobs: ContentaJob[], own: LiveJob[] = []): ContentaJob | null {
  const mine = new Set(own.map((j) => j.jobId));
  return jobs.find((j) => !mine.has(j.jobId) && j.videoSource?.includes(youtubeId)) ?? null;
}

/** Atualiza o andamento dos jobs de uma live a partir da lista do Contenta. */
function refreshJobs(live: ProducaoLive, byId: Map<string, ContentaJob>): { jobs: LiveJob[]; status: LiveStatus } {
  const jobs = live.jobs.map((j) => {
    const c = byId.get(j.jobId);
    if (!c) return j;
    if (c.status === "done") return { ...j, status: "done" as const, totalCuts: c.totalCuts };
    if (jobFailed(c)) return { ...j, status: "failed" as const };
    return j;
  });
  const status: LiveStatus = jobs.every((j) => j.status === "done")
    ? "cortada"
    : jobs.some((j) => j.status === "failed" || !j.runId)
      ? "erro"
      : "cortando";
  return { jobs, status };
}

/**
 * Atualiza o andamento das lives que estão sendo cortadas. O painel chama ao
 * abrir: sem isso, um job pronto no Contenta só aparecia depois de alguém
 * clicar em "Buscar no canal" ou da rodada diária.
 */
export async function refreshCuttingLives(): Promise<void> {
  const { data } = await db().from("producao_lives").select("*").in("status", ["cortando", "erro"]);
  const lives = ((data ?? []) as ProducaoLive[]).filter((l) => l.jobs.length > 0);
  if (lives.length === 0) return;
  const byId = new Map((await listContentaJobs()).map((j) => [j.jobId, j]));
  for (const live of lives) {
    const r = refreshJobs(live, byId);
    if (r.status !== live.status || JSON.stringify(r.jobs) !== JSON.stringify(live.jobs)) await patch(live.id, r);
  }
}

/**
 * Lê as lives encerradas do canal, cruza com os jobs do Contenta e devolve as
 * que a automação pode cortar agora.
 */
export async function syncLives(): Promise<{ novas: number; prontas: ProducaoLive[] }> {
  const [videos, since] = await Promise.all([listRecentUploads(50), autoSince()]);

  // O Contenta fora do ar (ou recusando) não pode esconder as lives: elas
  // entram no painel do mesmo jeito. Só o cruzamento e o disparo automático
  // esperam, porque sem a lista de jobs não dá para saber o que já foi cortado.
  let contenta: ContentaJob[] = [];
  let contentaOk = true;
  try {
    contenta = await listContentaJobs();
    await clearConfig(CONTENTA_ERROR);
  } catch (e) {
    contentaOk = false;
    await setConfig(CONTENTA_ERROR, e instanceof Error ? e.message : String(e));
  }
  const byId = new Map(contenta.map((j) => [j.jobId, j]));

  const ended = videos.filter((v) => v.liveEndedAt);
  const { data: known } = await db()
    .from("producao_lives")
    .select("*")
    .in("youtube_id", ended.map((v) => v.id));
  const byYt = new Map(((known ?? []) as ProducaoLive[]).map((l) => [l.youtube_id, l]));

  let novas = 0;
  const prontas: ProducaoLive[] = [];
  for (const v of ended) {
    let live = byYt.get(v.id);
    if (!live) {
      const { data } = await db()
        .from("producao_lives")
        .insert({
          youtube_id: v.id,
          title: v.title,
          privacy: v.privacy,
          duration_sec: v.durationSec,
          ended_at: v.liveEndedAt,
          thumb_url: v.thumbUrl,
          status: cutElsewhere(v.id, contenta) ? "ja_cortada" : "detectada",
        })
        .select("*")
        .single();
      if (!data) continue;
      live = data as ProducaoLive;
      novas++;
    } else {
      await patch(live.id, { title: v.title, privacy: v.privacy, thumb_url: v.thumbUrl });
      if (live.status === "detectada" && cutElsewhere(v.id, contenta, live.jobs)) {
        await patch(live.id, { status: "ja_cortada" });
        continue;
      }
      if (contentaOk && live.jobs.length > 0 && (live.status === "cortando" || live.status === "erro")) {
        const r = refreshJobs(live, byId);
        await patch(live.id, r);
        continue;
      }
    }

    const endedAt = new Date(v.liveEndedAt!).getTime();
    if (
      contentaOk &&
      live.status === "detectada" &&
      endedAt >= since.getTime() &&
      Date.now() - endedAt >= VOD_GRACE_MS &&
      v.privacy !== "private"
    ) {
      prontas.push(live);
    }
  }
  return { novas, prontas };
}

/** Só uma chamada por vez corta a mesma live. */
async function claim(id: string): Promise<ProducaoLive | null> {
  const { data } = await db()
    .from("producao_lives")
    .update({ status: "cortando", error: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["detectada", "erro", "ja_cortada"])
    .select("*");
  return ((data ?? [])[0] as ProducaoLive) ?? null;
}

/**
 * Dispara os cortes de uma live: um job por modo que ainda não tem job vivo
 * (num retry, só os que falharam). O jobId é gravado ANTES da chamada, para
 * que repetir caia no mesmo run do Contenta em vez de criar outro.
 */
export async function triggerLiveCuts(liveId: string, actor: string, opts: { force?: boolean } = {}): Promise<void> {
  // Antes de cortar, confere no Contenta se a live já tem cortes feitos por
  // fora do hub. Sem essa trava, uma live cortada à mão foi cortada de novo
  // (30/10: a dos cães da guarda, já com dois jobs, ganhou um terceiro).
  // Contenta fora do ar = erro, nunca disparo às cegas. `force` é o
  // "Cortar de novo" explícito da equipe.
  if (!opts.force) {
    const { data } = await db().from("producao_lives").select("*").eq("id", liveId).maybeSingle();
    const current = data as ProducaoLive | null;
    if (!current) return;
    const dup = cutElsewhere(current.youtube_id, await listContentaJobs(), current.jobs);
    if (dup) {
      await patch(current.id, { status: "ja_cortada", error: null });
      throw new Error(
        `Essa live já tem cortes no Contenta (${dup.jobId}, ${dup.totalCuts} cortes). Para cortar de novo, use "Cortar de novo".`
      );
    }
  }

  const live = await claim(liveId);
  if (!live) return;

  const base = Date.now();
  const kept = live.jobs.filter((j) => j.status !== "failed" || !j.runId);
  const jobs: LiveJob[] = [...kept];
  ALL_MODES.forEach((mode, i) => {
    if (!jobs.some((j) => j.mode === mode)) {
      jobs.push({ mode, jobId: `job_${base + i}`, runId: null, status: "processing", totalCuts: 0 });
    }
  });
  await patch(live.id, { jobs, triggered_by: actor, triggered_at: new Date().toISOString() });

  const errors: string[] = [];
  for (const j of jobs) {
    if (j.runId || j.status === "done") continue;
    try {
      j.runId = await startCuts(live.youtube_id, j.jobId, j.mode);
    } catch (e) {
      errors.push(`${j.mode}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  await patch(live.id, {
    jobs,
    status: errors.length ? "erro" : "cortando",
    error: errors.length ? errors.join(" · ").slice(0, 500) : null,
  });
}

export async function setLiveStatus(liveId: string, status: "ignorada" | "detectada" | "ja_cortada") {
  await patch(liveId, { status, error: null });
}

/** Rodada da automação: sincroniza e corta as lives novas, até AUTO_PER_RUN. */
export async function runLives(actor: string) {
  const { novas, prontas } = await syncLives();
  const alvo = prontas.slice(0, AUTO_PER_RUN);
  for (const l of alvo) await triggerLiveCuts(l.id, actor);
  return { lives_novas: novas, lives_disparadas: alvo.length };
}
