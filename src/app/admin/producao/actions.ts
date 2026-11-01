"use server";

import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isContentaConfigured } from "@/lib/producao/contenta";
import { setLiveStatus, syncLives, triggerLiveCuts } from "@/lib/producao/lives";
import { approveThumb, generateFor, syncChannel } from "@/lib/producao/pipeline";
import { runPlaylists } from "@/lib/producao/playlists";
import { QUADROS, isQuadroId, quadroLogoPath } from "@/lib/producao/quadros";
import { LOGO_PATH, getVideo, logEvent, setConfig, updateVideo, upload, db } from "@/lib/producao/store";

const PATH = "/admin/producao";
const refresh = () => revalidatePath(PATH, "layout");

export type ActionState = { ok: boolean; error: string | null };

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function actorOf(role: { email: string | null; userId: string }): string {
  return role.email ?? role.userId;
}

function fail(e: unknown): ActionState {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function syncAction(): Promise<void> {
  const role = await requireAdmin();
  await syncChannel(actorOf(role));
  // Lê as lives e o andamento dos jobs, sem disparar nada: o disparo
  // automático é do cron, o manual é o botão de cada live.
  if (isContentaConfigured()) await syncLives().catch(() => null);
  refresh();
}

export async function triggerLiveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    await triggerLiveCuts(str(form, "id"), actorOf(role), { force: str(form, "force") === "1" });
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function playlistsAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  try {
    const r = await runPlaylists();
    refresh();
    if (r.erro) return { ok: false, error: r.erro };
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function liveStatusAction(form: FormData): Promise<void> {
  await requireAdmin();
  const status = str(form, "status");
  if (status !== "ignorada" && status !== "detectada" && status !== "ja_cortada") return;
  await setLiveStatus(str(form, "id"), status);
  refresh();
}

/** Gera (ou regenera) thumbs. Com l1/l2 preenchidos, usa a headline da equipe. */
export async function generateAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  const id = str(form, "id");
  const l1 = str(form, "l1").toUpperCase().slice(0, 40);
  const l2 = str(form, "l2").toUpperCase().slice(0, 40);
  try {
    await generateFor(id, actorOf(role), l1 && l2 ? { headline: { l1, l2 } } : {});
    const v = await getVideo(id);
    refresh();
    return v?.status === "erro" ? { ok: false, error: v.error } : { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

/** `when` vem do datetime-local, no horário de Brasília (sem horário de verão). */
export async function approveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  const when = str(form, "publish_at");
  let publishAt: Date | null = null;
  if (when) {
    publishAt = new Date(`${when}:00-03:00`);
    if (Number.isNaN(publishAt.getTime())) return { ok: false, error: "Data inválida." };
    if (publishAt.getTime() < Date.now() + 5 * 60_000) {
      return { ok: false, error: "Agende para pelo menos 5 minutos à frente, ou deixe em branco para publicar agora." };
    }
  }
  try {
    await approveThumb(str(form, "thumb_id"), actorOf(role), publishAt);
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    refresh();
    return fail(e);
  }
}

/** A equipe corrige o quadro do corte; a próxima geração usa a identidade dele. */
export async function setQuadroAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const id = str(form, "id");
  const quadro = str(form, "quadro");
  if (!isQuadroId(quadro)) return;
  await updateVideo(id, { quadro });
  await logEvent(id, actorOf(role), "trocou o quadro", QUADROS[quadro].name);
  refresh();
}

export async function setStatusAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const id = str(form, "id");
  const status = str(form, "status");
  if (status !== "ignorado" && status !== "novo") return;
  await updateVideo(id, { status, error: null });
  await logEvent(id, actorOf(role), status === "ignorado" ? "ignorou" : "voltou para a fila");
  refresh();
}

/** Frame enviado à mão, para quando a miniatura do YouTube não serve. */
export async function uploadFrameAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  const id = str(form, "id");
  const file = form.get("frame");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha uma imagem." };
  try {
    const jpeg = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(1920, 1080, { fit: "inside" })
      .jpeg({ quality: 90 })
      .toBuffer();
    const path = `frames/${id}.jpg`;
    await upload(path, jpeg, "image/jpeg");
    await updateVideo(id, { frame_path: path });
    await logEvent(id, actorOf(role), "enviou frame");
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function savePromptAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const prompt = str(form, "prompt");
  try {
    if (prompt) await setConfig("plate_prompt", prompt);
    else await db().from("producao_config").delete().eq("key", "plate_prompt");
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadLogoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Escolha o arquivo do logo." };
  // Sem `quadro`, é o logo do PFC (padrão de todas as thumbs).
  const quadro = str(form, "quadro");
  try {
    const png = await sharp(Buffer.from(await file.arrayBuffer()))
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
    await upload(isQuadroId(quadro) ? quadroLogoPath(quadro) : LOGO_PATH, png, "image/png");
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function disconnectAction(): Promise<void> {
  await requireAdmin();
  await db().from("producao_config").delete().in("key", ["yt_refresh_token", "yt_channel"]);
  refresh();
}
