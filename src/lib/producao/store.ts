import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";

export const BUCKET = "producao";
export const LOGO_PATH = "config/logo.png";

export type ProducaoStatus =
  | "novo"
  | "gerando"
  | "revisar"
  | "aprovada"
  | "publicada"
  | "ignorado"
  | "erro";

/** l3 é opcional: com ela a thumb sai em três linhas (gancho / destaque / complemento). */
export type Headline = { l1: string; l2: string; l3?: string };

export const headlineText = (h: { l1: string; l2: string; l3?: string | null }) => [h.l1, h.l2, h.l3].filter(Boolean).join(" / ");

export type ProducaoVideo = {
  id: string;
  youtube_id: string;
  title: string;
  quadro: string | null;
  duration_sec: number | null;
  privacy: string | null;
  yt_thumb_url: string | null;
  frame_path: string | null;
  transcript: string | null;
  headline_options: Headline[];
  status: ProducaoStatus;
  error: string | null;
  approved_thumb_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  publish_at: string | null;
  uploaded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProducaoThumb = {
  id: string;
  video_id: string;
  storage_path: string;
  l1: string;
  l2: string;
  l3: string | null;
  model: string;
  created_by: string | null;
  created_at: string;
};

export type ProducaoEvento = {
  id: number;
  video_id: string;
  actor: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export function db() {
  const admin = createAdminSupabase();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  return admin;
}

export async function getConfig(key: string): Promise<string | null> {
  const { data } = await db().from("producao_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  const { error } = await db()
    .from("producao_config")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function clearConfig(key: string): Promise<void> {
  await db().from("producao_config").delete().eq("key", key);
}

export async function logEvent(videoId: string, actor: string, action: string, detail?: string) {
  await db().from("producao_eventos").insert({ video_id: videoId, actor, action, detail: detail ?? null });
}

export async function updateVideo(id: string, patch: Partial<ProducaoVideo>) {
  const { error } = await db()
    .from("producao_videos")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getVideo(id: string): Promise<ProducaoVideo | null> {
  const { data } = await db().from("producao_videos").select("*").eq("id", id).maybeSingle();
  return (data as ProducaoVideo) ?? null;
}

export async function upload(path: string, body: Buffer, contentType: string) {
  const { error } = await db().storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`Storage: ${error.message}`);
}

export async function download(path: string): Promise<Buffer | null> {
  const { data } = await db().storage.from(BUCKET).download(path);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

/** URLs assinadas (1 h) para mostrar as imagens privadas no painel. */
export async function signedUrls(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (paths.length === 0) return out;
  const { data } = await db().storage.from(BUCKET).createSignedUrls(paths, 3600);
  for (const d of data ?? []) if (d.path && d.signedUrl) out.set(d.path, d.signedUrl);
  return out;
}
