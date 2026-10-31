import "server-only";
import { db } from "@/lib/producao/store";
import { connectedChannel, uploadVideo } from "@/lib/producao/youtube-api";
import {
  MetaError,
  fbPublishVideo,
  igContainerStatus,
  igCreateReel,
  igPublish,
  igPublishingUsage,
  igReelInsights,
} from "./meta";
import { activeConnection, revokeConnection, updatePost, type SocialPost } from "./store";

/** Um "publicando" mais velho que isso morreu no meio (timeout da função). */
const STALE_MS = 15 * 60_000;
/** Container do Instagram que não termina nisso não vai terminar. */
const IG_MAX_MS = 30 * 60_000;
const MAX_ATTEMPTS = 3;
const RETRY_MS = 10 * 60_000;
/** Depois disso a rodada não pega post novo: o upload do YouTube leva ~1 min. */
const BUDGET_MS = 150_000;

/**
 * Ritmo do Instagram, bem abaixo do teto da API (100/24h) para a conta não
 * parecer robô: no máximo 4 por 24h, 2h30 entre um e outro, horário com folga
 * aleatória. Vale para todo Reel, de teste ou não.
 */
export const IG_DAILY_MAX = 4;
const IG_GAP_MS = 150 * 60_000;
const IG_JITTER_MS = 20 * 60_000;
/** Uso da API (inclui outras ferramentas) a partir do qual a fila para. */
const IG_API_STOP = 25;

/** Métricas: até 7 dias depois de publicar, no máximo uma leitura por hora. */
const METRICS_DAYS = 7;
const METRICS_EVERY_MS = 60 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Corte não abriu no R2 (HTTP ${res.status}).`);
  return Buffer.from(await res.arrayBuffer());
}

async function meta(platform: "instagram" | "facebook") {
  const c = await activeConnection(platform);
  if (!c) throw new Error(`${platform === "instagram" ? "Instagram" : "Facebook"} não conectado (/admin/marketing).`);
  return c;
}

async function published(p: SocialPost, externalId: string, url: string | null) {
  await updatePost(p.id, {
    status: "publicado",
    external_id: externalId,
    post_url: url,
    error: null,
    published_at: new Date().toISOString(),
  });
}

/** Termina um Reel: espera o container ficar pronto e publica. false = ainda processando. */
async function finishReel(p: SocialPost, waitMs: number): Promise<boolean> {
  const c = await meta("instagram");
  const until = Date.now() + waitMs;
  for (;;) {
    const s = await igContainerStatus(p.container_id!, c.token);
    if (s.code === "FINISHED") {
      const r = await igPublish(c.accountId, c.token, p.container_id!);
      await published(p, r.id, r.url);
      return true;
    }
    if (s.code === "ERROR" || s.code === "EXPIRED") {
      throw new Error(`Instagram recusou o vídeo: ${s.detail ?? s.code}`);
    }
    if (Date.now() + 5_000 > until) return false;
    await sleep(5_000);
  }
}

async function publishOne(p: SocialPost): Promise<void> {
  switch (p.platform) {
    case "youtube": {
      if (!(await connectedChannel())) throw new Error("Canal do YouTube não conectado (/admin/producao/config).");
      const id = await uploadVideo(await download(p.video_url), { title: p.title, description: p.caption });
      await published(p, id, `https://youtube.com/shorts/${id}`);
      return;
    }
    case "instagram": {
      const c = await meta("instagram");
      const containerId = await igCreateReel(c.accountId, c.token, p.video_url, p.caption, p.trial);
      await updatePost(p.id, { status: "processando", container_id: containerId, connection_id: c.id });
      await finishReel({ ...p, container_id: containerId }, 60_000);
      return;
    }
    case "facebook": {
      const c = await meta("facebook");
      const r = await fbPublishVideo(c.accountId, c.token, p.video_url, p.title, p.caption);
      await updatePost(p.id, { connection_id: c.id });
      await published(p, r.id, r.url);
      return;
    }
    case "tiktok":
      throw new Error("TikTok ainda não está ligado (fase 2).");
  }
}

/** Falhou: tenta de novo em 10 min até MAX_ATTEMPTS; token morto vai direto para erro. */
async function failed(p: SocialPost, e: unknown): Promise<void> {
  const attempts = p.attempts + 1;
  const dead = e instanceof MetaError && e.tokenDead;
  if (dead && p.connection_id) await revokeConnection(p.connection_id);
  const retry = !dead && attempts < MAX_ATTEMPTS && p.platform !== "tiktok";
  await updatePost(p.id, {
    attempts,
    error: msg(e),
    status: retry ? "agendado" : "erro",
    // Reel com container quebrado recomeça do zero.
    container_id: null,
    ...(retry ? { scheduled_at: new Date(Date.now() + RETRY_MS).toISOString() } : {}),
  });
}

/** null = o Instagram pode receber um Reel agora; senão, o próximo horário permitido. */
async function igNextSlot(): Promise<Date | null> {
  const day = 86_400_000;
  const { data } = await db()
    .from("social_posts")
    .select("published_at, updated_at")
    .eq("platform", "instagram")
    .or(`status.eq.processando,and(status.eq.publicado,published_at.gte.${new Date(Date.now() - day).toISOString()})`);
  const times = (data ?? []).map((r) => new Date(r.published_at ?? r.updated_at).getTime()).sort((a, b) => a - b);

  let next = 0;
  if (times.length >= IG_DAILY_MAX) next = times[times.length - IG_DAILY_MAX] + day;
  if (times.length > 0) next = Math.max(next, times[times.length - 1] + IG_GAP_MS);
  if (next <= Date.now()) {
    const c = await activeConnection("instagram");
    const usage = c ? await igPublishingUsage(c.accountId, c.token).catch(() => 0) : 0;
    if (usage < IG_API_STOP) return null;
    next = Date.now() + 3 * 3_600_000;
  }
  return new Date(next + Math.random() * IG_JITTER_MS);
}

/** Atualiza os insights dos Reels de teste recentes, que alimentam o ranking. */
async function refreshTrialMetrics(started: number): Promise<number> {
  const c = await activeConnection("instagram");
  if (!c) return 0;
  const { data } = await db()
    .from("social_posts")
    .select("id, external_id, metrics_at")
    .eq("platform", "instagram")
    .eq("trial", true)
    .eq("status", "publicado")
    .is("graduated_at", null)
    .gte("published_at", new Date(Date.now() - METRICS_DAYS * 86_400_000).toISOString())
    .or(`metrics_at.is.null,metrics_at.lt.${new Date(Date.now() - METRICS_EVERY_MS).toISOString()}`)
    .order("metrics_at", { ascending: true, nullsFirst: true })
    .limit(10);
  let n = 0;
  for (const p of data ?? []) {
    if (!p.external_id || Date.now() - started > BUDGET_MS + 60_000) break;
    try {
      const metrics = await igReelInsights(p.external_id, c.token);
      await updatePost(p.id, { metrics, metrics_at: new Date().toISOString() });
      n++;
    } catch (e) {
      await updatePost(p.id, { metrics: { erro: msg(e) }, metrics_at: new Date().toISOString() });
    }
  }
  return n;
}

/** Marca "publicando" só se ninguém pegou antes — cron e botão não duplicam. */
async function claim(id: string): Promise<SocialPost | null> {
  const { data } = await db()
    .from("social_posts")
    .update({ status: "publicando", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "agendado")
    .select("*")
    .maybeSingle();
  return (data as SocialPost) ?? null;
}

/**
 * Rodada da fila: recupera os travados, termina os Reels em processamento e
 * publica os agendados que venceram (mais antigos primeiro).
 */
export async function runSocialQueue(limit = 4) {
  const started = Date.now();
  const now = new Date().toISOString();
  const out = { publicados: 0, processando: 0, erros: 0, travados: 0, adiados: 0, metricas: 0 };

  // Não dá para saber se o upload chegou na rede: erro, sem tentar sozinho.
  const { data: stale } = await db()
    .from("social_posts")
    .update({ status: "erro", error: "Interrompido no meio da publicação. Confira na rede antes de tentar de novo." })
    .eq("status", "publicando")
    .lt("updated_at", new Date(Date.now() - STALE_MS).toISOString())
    .select("id");
  out.travados = stale?.length ?? 0;

  const { data: proc } = await db().from("social_posts").select("*").eq("status", "processando").limit(10);
  for (const p of (proc ?? []) as SocialPost[]) {
    try {
      if (await finishReel(p, 0)) out.publicados++;
      else if (Date.now() - new Date(p.updated_at).getTime() > IG_MAX_MS) {
        throw new Error("O Instagram não terminou de processar o vídeo em 30 min.");
      } else out.processando++;
    } catch (e) {
      await failed(p, e);
      out.erros++;
    }
  }

  const { data: due } = await db()
    .from("social_posts")
    .select("id, platform")
    .eq("status", "agendado")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  for (const row of due ?? []) {
    if (Date.now() - started > BUDGET_MS) break;
    if (row.platform === "instagram") {
      const slot = await igNextSlot();
      if (slot) {
        await db()
          .from("social_posts")
          .update({ scheduled_at: slot.toISOString(), updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .eq("status", "agendado");
        out.adiados++;
        continue;
      }
    }
    const p = await claim(row.id);
    if (!p) continue;
    try {
      await publishOne(p);
      const after = await db().from("social_posts").select("status").eq("id", p.id).single();
      if (after.data?.status === "publicado") out.publicados++;
      else out.processando++;
    } catch (e) {
      await failed(p, e);
      out.erros++;
    }
  }

  out.metricas = await refreshTrialMetrics(started).catch(() => 0);
  return out;
}
