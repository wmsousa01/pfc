"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/app/admin/producao/actions";
import { listJobCuts, type ContentaCut } from "@/lib/producao/contenta";
import { db } from "@/lib/producao/store";
import { defaultCaption } from "@/lib/social/caption";
import { IG_DAILY_MAX, runSocialQueue } from "@/lib/social/publisher";
import { PLATFORMS, deleteConnections, type Platform } from "@/lib/social/store";

const PATH = "/admin/marketing";
const refresh = () => revalidatePath(PATH);

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function actorOf(role: { email: string | null; userId: string }): string {
  return role.email ?? role.userId;
}

function fail(e: unknown): ActionState {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

function platformsOf(form: FormData): Platform[] {
  return form
    .getAll("platforms")
    .map(String)
    .filter((p): p is Platform => p in PLATFORMS && PLATFORMS[p as Platform].ready);
}

/** `when` vem do datetime-local, no horário de Brasília (sem horário de verão). */
function brasilia(when: string): Date {
  const d = new Date(`${when}:00-03:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  return d;
}

/** O corte vem do Contenta de novo: a URL do vídeo nunca sai do formulário. */
async function cutsOf(jobId: string): Promise<ContentaCut[]> {
  if (!/^job_\d{13,16}$/.test(jobId)) throw new Error("Job inválido.");
  return (await listJobCuts(jobId)).items;
}

type NewPost = {
  platform: Platform;
  cut: ContentaCut;
  jobId: string;
  title: string;
  caption: string;
  at: Date;
  actor: string;
  trial: boolean;
};

/** Folga aleatória de até 20 min: horários redondos repetidos parecem robô. */
const jitter = (d: Date) => new Date(d.getTime() + Math.floor(Math.random() * 20 * 60_000));

/** Com o Instagram no lote, o intervalo respeita o teto de Reels por dia. */
const IG_MIN_INTERVAL_H = 24 / IG_DAILY_MAX;

/** Insere os posts. O índice único barra corte repetido na mesma rede: devolve quantos pularam. */
async function insertPosts(posts: NewPost[]): Promise<{ criados: number; repetidos: number }> {
  let criados = 0;
  let repetidos = 0;
  for (const p of posts) {
    const { error } = await db().from("social_posts").insert({
      platform: p.platform,
      contenta_job_id: p.jobId,
      cut_file: p.cut.file,
      video_url: p.cut.url,
      thumb_url: p.cut.thumbUrl,
      title: p.title.slice(0, 100),
      caption: p.caption,
      scheduled_at: p.at.toISOString(),
      created_by: p.actor,
      trial: p.platform === "instagram" && p.trial,
    });
    if (!error) criados++;
    else if (error.code === "23505") repetidos++;
    else throw new Error(error.message);
  }
  return { criados, repetidos };
}

/** Programa um corte nas redes marcadas. Sem data, publica agora. */
export async function scheduleCutAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const platforms = platformsOf(form);
    if (platforms.length === 0) return { ok: false, error: "Marque pelo menos uma rede." };
    const jobId = str(form, "job");
    const cut = (await cutsOf(jobId)).find((c) => c.file === str(form, "file"));
    if (!cut) return { ok: false, error: "Corte não encontrado no Contenta." };

    const when = str(form, "publish_at");
    const at = when ? brasilia(when) : new Date();
    if (when && at.getTime() < Date.now() + 5 * 60_000) {
      return { ok: false, error: "Agende para pelo menos 5 minutos à frente, ou deixe em branco para publicar agora." };
    }
    const title = str(form, "title") || cut.title || cut.file;
    const caption = str(form, "caption") || defaultCaption(cut);
    const trial = form.get("trial") === "on";
    const r = await insertPosts(
      platforms.map((platform) => ({ platform, cut, jobId, title, caption, at, actor: actorOf(role), trial }))
    );
    const q = !when && r.criados > 0 ? await runSocialQueue(r.criados) : null;
    refresh();
    if (r.criados === 0) return { ok: false, error: "Esse corte já está programado nessas redes." };
    const notes = [
      r.repetidos && `${r.repetidos} rede(s) já tinham esse corte e foram puladas.`,
      q?.adiados && "O Instagram está no limite de ritmo: o Reel foi para o próximo horário livre (veja a fila).",
    ].filter(Boolean);
    return { ok: true, error: notes.length ? notes.join(" ") : null };
  } catch (e) {
    refresh();
    return fail(e);
  }
}

/**
 * Distribui todos os cortes do job: um por horário, a partir de `start`, de
 * `interval` em `interval` horas, nas redes marcadas. Corte já programado
 * numa rede é pulado sem ocupar horário.
 */
export async function scheduleJobAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    const platforms = platformsOf(form);
    if (platforms.length === 0) return { ok: false, error: "Marque pelo menos uma rede." };
    const jobId = str(form, "job");
    const start = brasilia(str(form, "start"));
    if (start.getTime() < Date.now() + 5 * 60_000) return { ok: false, error: "O primeiro horário precisa ser no futuro." };
    const interval = Math.min(168, Math.max(1, Number(str(form, "interval")) || 24));
    if (platforms.includes("instagram") && interval < IG_MIN_INTERVAL_H) {
      return {
        ok: false,
        error: `Com o Instagram no lote, o intervalo mínimo é de ${IG_MIN_INTERVAL_H} h (até ${IG_DAILY_MAX} Reels por dia).`,
      };
    }
    const trial = form.get("trial") === "on";

    const cuts = await cutsOf(jobId);
    const { data: taken } = await db()
      .from("social_posts")
      .select("platform, cut_file")
      .eq("contenta_job_id", jobId)
      .neq("status", "cancelado");
    const has = new Set((taken ?? []).map((t) => `${t.platform}|${t.cut_file}`));

    const posts: NewPost[] = [];
    let slot = 0;
    for (const cut of cuts) {
      const free = platforms.filter((p) => !has.has(`${p}|${cut.file}`));
      if (free.length === 0) continue;
      const at = jitter(new Date(start.getTime() + slot * interval * 3_600_000));
      const caption = defaultCaption(cut);
      for (const platform of free) {
        posts.push({ platform, cut, jobId, title: cut.title || cut.file, caption, at, actor: actorOf(role), trial });
      }
      slot++;
    }
    if (posts.length === 0) return { ok: false, error: "Todos os cortes já estão programados nessas redes." };
    await insertPosts(posts);
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelPostAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db()
    .from("social_posts")
    .update({ status: "cancelado", updated_at: new Date().toISOString() })
    .eq("id", str(form, "id"))
    .in("status", ["agendado", "erro"]);
  refresh();
}

/** Volta um post com erro para a fila, para a próxima rodada (até 5 min). */
export async function retryPostAction(form: FormData): Promise<void> {
  await requireAdmin();
  const now = new Date().toISOString();
  await db()
    .from("social_posts")
    .update({ status: "agendado", attempts: 0, error: null, container_id: null, scheduled_at: now, updated_at: now })
    .eq("id", str(form, "id"))
    .eq("status", "erro");
  refresh();
}

export async function runQueueAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  try {
    const r = await runSocialQueue();
    refresh();
    return { ok: true, error: r.erros ? `${r.erros} post(s) falharam — veja a fila.` : null };
  } catch (e) {
    return fail(e);
  }
}

/** A equipe promoveu o Reel de teste no app: sai do ranking. */
export async function graduatePostAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db()
    .from("social_posts")
    .update({ graduated_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", str(form, "id"))
    .eq("trial", true);
  refresh();
}

export async function disconnectMetaAction(): Promise<void> {
  await requireAdmin();
  await deleteConnections(["instagram", "facebook"]);
  refresh();
}
