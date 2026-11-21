"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/app/admin/producao/actions";
import { listJobCuts, type ContentaCut } from "@/lib/producao/contenta";
import { db } from "@/lib/producao/store";
import { captionFor, defaultCaption } from "@/lib/social/caption";
import { IG_DAILY_MAX, runSocialQueue } from "@/lib/social/publisher";
import { IG_MAX_SEGUNDOS, JANELA_HORAS, dentroDaJanela } from "@/lib/social/ritmo";
import { PLATFORMS, connectionById, deleteConnections, deleteExtraConnection, type Platform } from "@/lib/social/store";

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

/** O Instagram vem do seletor `ig` (off | teste | normal); as outras redes, das caixas. */
function platformsOf(form: FormData): Platform[] {
  const boxes = form
    .getAll("platforms")
    .map(String)
    .filter((p): p is Platform => p in PLATFORMS && PLATFORMS[p as Platform].ready && p !== "instagram");
  const ig = str(form, "ig");
  return ig === "teste" || ig === "normal" ? [...boxes, "instagram"] : boxes;
}

const isTrial = (form: FormData) => str(form, "ig") === "teste";

/**
 * Perfis do collab: atalhos marcados (`collab`) + campo livre (`collab_extra`),
 * que aceita @perfil, perfil ou o link do Instagram, separados por vírgula/espaço.
 */
function collaboratorsOf(form: FormData): string[] {
  const raw = [...form.getAll("collab").map(String), ...str(form, "collab_extra").split(/[\s,;]+/)];
  const users = raw
    .map((u) =>
      u
        .trim()
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
        .replace(/[/?#].*$/, "")
        .replace(/^@/, "")
        .toLowerCase()
    )
    .filter(Boolean);
  const bad = users.find((u) => !/^[a-z0-9._]{1,30}$/.test(u));
  if (bad) throw new Error(`Perfil de collab inválido: ${bad}`);
  const unique = Array.from(new Set(users));
  if (unique.length > 3) throw new Error("O Instagram aceita no máximo 3 perfis no collab.");
  return unique;
}

/** Perfil do Instagram (`perfil`): vazio = principal; senão o id de um perfil extra ativo. */
async function perfilOf(form: FormData): Promise<number | null> {
  const raw = str(form, "perfil");
  if (!raw) return null;
  const id = Number(raw);
  const c = Number.isInteger(id) ? await connectionById(id) : null;
  if (!c || c.principal) throw new Error("Perfil do Instagram inválido ou desconectado.");
  return id;
}

/** `when` vem do datetime-local, no horário de Brasília (sem horário de verão). */
function brasilia(when: string): Date {
  const d = new Date(`${when}:00-03:00`);
  if (Number.isNaN(d.getTime())) throw new Error("Data inválida.");
  return d;
}

/** O corte vem do Contenta de novo: a URL do vídeo nunca sai do formulário. */
async function cutsOf(jobId: string): Promise<{ cuts: ContentaCut[]; outputFormat: string | null }> {
  if (!/^job_\d{13,16}$/.test(jobId)) throw new Error("Job inválido.");
  const r = await listJobCuts(jobId);
  return { cuts: r.items, outputFormat: r.outputFormat };
}

/**
 * Por que o corte não serve para o Instagram, ou null se serve. Corte 16:9
 * saiu como Reel com 0 views; acima de IG_MAX_SEGUNDOS rende pouco.
 */
function foraDoInstagram(cut: ContentaCut, outputFormat: string | null): string | null {
  if (outputFormat === "landscape") return "corte horizontal (16:9)";
  if (cut.durationSec != null && cut.durationSec > IG_MAX_SEGUNDOS) return `corte com mais de ${IG_MAX_SEGUNDOS} s`;
  return null;
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
  collaborators: string[];
  perfilId: number | null;
};

/** Folga aleatória de até 20 min: horários redondos repetidos parecem robô. */
const jitter = (d: Date) => new Date(d.getTime() + Math.floor(Math.random() * 20 * 60_000));

/** Com o Instagram no lote, o intervalo respeita o teto de Reels por dia dentro da janela (10h–22h). */
const IG_MIN_INTERVAL_H = Math.round((JANELA_HORAS / IG_DAILY_MAX) * 10) / 10;

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
      collaborators: p.platform === "instagram" ? p.collaborators : [],
      perfil_id: p.platform === "instagram" ? p.perfilId : null,
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
    const { cuts, outputFormat } = await cutsOf(jobId);
    const cut = cuts.find((c) => c.file === str(form, "file"));
    if (!cut) return { ok: false, error: "Corte não encontrado no Contenta." };
    const motivo = platforms.includes("instagram") ? foraDoInstagram(cut, outputFormat) : null;
    if (motivo) return { ok: false, error: `O Instagram só recebe cortes verticais de até ${IG_MAX_SEGUNDOS} s (este é ${motivo}). Desmarque o Instagram.` };

    const when = str(form, "publish_at");
    const at = when ? brasilia(when) : new Date();
    if (when && at.getTime() < Date.now() + 5 * 60_000) {
      return { ok: false, error: "Agende para pelo menos 5 minutos à frente, ou deixe em branco para publicar agora." };
    }
    const title = str(form, "title") || cut.title || cut.file;
    // Legenda mexida vale para todas as redes; a padrão muda por rede (o Instagram ganha pergunta e pedido de envio).
    const typed = str(form, "caption");
    const custom = typed && typed.replace(/\r\n/g, "\n") !== defaultCaption(cut) ? typed : null;
    const trial = isTrial(form);
    const collaborators = collaboratorsOf(form);
    const perfilId = await perfilOf(form);
    const r = await insertPosts(
      platforms.map((platform) => ({
        platform,
        cut,
        jobId,
        title,
        caption: custom ?? captionFor(cut, platform),
        at,
        actor: actorOf(role),
        trial,
        collaborators,
        perfilId,
      }))
    );
    const q = !when && r.criados > 0 ? await runSocialQueue(r.criados) : null;
    refresh();
    if (r.criados === 0) return { ok: false, error: "Esse corte já está programado nessas redes." };
    const notes = [
      r.repetidos && `${r.repetidos} rede(s) já tinham esse corte e foram puladas.`,
      q?.adiados && "Fora do horário (10h–22h) ou no limite de ritmo da rede: foi para o próximo horário livre (veja a fila).",
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
    const trial = isTrial(form);
    const collaborators = collaboratorsOf(form);
    const perfilId = await perfilOf(form);

    const { cuts, outputFormat } = await cutsOf(jobId);
    const { data: taken } = await db()
      .from("social_posts")
      .select("platform, cut_file, perfil_id")
      .eq("contenta_job_id", jobId)
      .neq("status", "cancelado");
    // O Instagram conta por perfil: o mesmo corte pode ir à principal e a um extra.
    const chave = (platform: string, file: string, perfil: number | null) =>
      `${platform}|${file}|${platform === "instagram" ? (perfil ?? 0) : 0}`;
    const has = new Set((taken ?? []).map((t) => chave(t.platform, t.cut_file, t.perfil_id)));

    const posts: NewPost[] = [];
    let foraIg = 0;
    // Horários só dentro da janela (10h–22h): o que cairia de madrugada passa para a manhã.
    let t = dentroDaJanela(start.getTime());
    for (const cut of cuts) {
      const semIg = platforms.includes("instagram") && !!foraDoInstagram(cut, outputFormat);
      if (semIg) foraIg++;
      const free = platforms.filter((p) => !has.has(chave(p, cut.file, perfilId)) && !(p === "instagram" && semIg));
      if (free.length === 0) continue;
      const at = jitter(new Date(t));
      t = dentroDaJanela(t + interval * 3_600_000);
      for (const platform of free) {
        const caption = captionFor(cut, platform);
        posts.push({ platform, cut, jobId, title: cut.title || cut.file, caption, at, actor: actorOf(role), trial, collaborators, perfilId });
      }
    }
    const nota = foraIg
      ? `${foraIg} corte(s) ficaram fora do Instagram (só vão cortes verticais de até ${IG_MAX_SEGUNDOS} s).`
      : null;
    if (posts.length === 0) {
      return { ok: false, error: nota ?? "Todos os cortes já estão programados nessas redes." };
    }
    await insertPosts(posts);
    refresh();
    return { ok: true, error: nota };
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
  await deleteConnections(["instagram", "facebook"], true);
  refresh();
}

/** Tira só um perfil extra do Instagram; a conta principal fica. */
export async function disconnectPerfilAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(form, "id"));
  if (Number.isInteger(id)) await deleteExtraConnection(id);
  refresh();
}
