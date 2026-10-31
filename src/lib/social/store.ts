import "server-only";
import { db } from "@/lib/producao/store";
import { decrypt, encrypt } from "./crypto";

export type Platform = "youtube" | "instagram" | "facebook" | "tiktok";
export type ConnectedPlatform = Exclude<Platform, "youtube">;

export type PostStatus = "agendado" | "publicando" | "processando" | "publicado" | "erro" | "cancelado";

export const PLATFORMS: Record<Platform, { label: string; ready: boolean }> = {
  youtube: { label: "YouTube Shorts", ready: true },
  instagram: { label: "Instagram Reels", ready: true },
  facebook: { label: "Facebook", ready: true },
  tiktok: { label: "TikTok", ready: false },
};

/** Conexão sem token — é o que pode ir para a página. */
export type SafeConnection = {
  id: number;
  platform: ConnectedPlatform;
  external_account_id: string;
  account_name: string | null;
  status: "ativa" | "revogada";
  created_at: string;
};

export type SocialPost = {
  id: string;
  platform: Platform;
  connection_id: number | null;
  contenta_job_id: string;
  cut_file: string;
  video_url: string;
  thumb_url: string | null;
  title: string;
  caption: string;
  status: PostStatus;
  scheduled_at: string;
  attempts: number;
  container_id: string | null;
  external_id: string | null;
  post_url: string | null;
  error: string | null;
  created_by: string | null;
  published_at: string | null;
  /** Reel de teste: o Instagram mostra só para não seguidores. */
  trial: boolean;
  metrics: ReelMetrics | null;
  metrics_at: string | null;
  /** A equipe promoveu o teste para os seguidores (no app). */
  graduated_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Insights do Reel; `erro` quando a Meta recusou a leitura. */
export type ReelMetrics = {
  views?: number;
  reach?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
  /** Em milissegundos. */
  ig_reels_avg_watch_time?: number;
  erro?: string;
};

export async function listConnections(): Promise<SafeConnection[]> {
  const { data } = await db()
    .from("social_connections")
    .select("id, platform, external_account_id, account_name, status, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as SafeConnection[];
}

/** A conta ativa da rede, com o token em claro. Só para o publicador. */
export async function activeConnection(
  platform: ConnectedPlatform
): Promise<{ id: number; accountId: string; token: string } | null> {
  const { data } = await db()
    .from("social_connections")
    .select("id, external_account_id, access_token_enc")
    .eq("platform", platform)
    .eq("status", "ativa")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, accountId: data.external_account_id, token: decrypt(data.access_token_enc) };
}

/** Grava a conta e desativa as outras da mesma rede: uma conta ativa por rede. */
export async function saveConnection(c: {
  platform: ConnectedPlatform;
  accountId: string;
  accountName: string | null;
  token: string;
  expiresAt?: Date | null;
  scopes?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db()
    .from("social_connections")
    .upsert(
      {
        platform: c.platform,
        external_account_id: c.accountId,
        account_name: c.accountName,
        access_token_enc: encrypt(c.token),
        token_expires_at: c.expiresAt?.toISOString() ?? null,
        scopes: c.scopes ?? null,
        status: "ativa",
        updated_at: now,
      },
      { onConflict: "platform,external_account_id" }
    );
  if (error) throw new Error(error.message);
  await db()
    .from("social_connections")
    .update({ status: "revogada", updated_at: now })
    .eq("platform", c.platform)
    .neq("external_account_id", c.accountId);
}

export async function revokeConnection(id: number): Promise<void> {
  await db().from("social_connections").update({ status: "revogada", updated_at: new Date().toISOString() }).eq("id", id);
}

export async function deleteConnections(platforms: ConnectedPlatform[]): Promise<void> {
  await db().from("social_connections").delete().in("platform", platforms);
}

export async function updatePost(id: string, patch: Partial<SocialPost>): Promise<void> {
  const { error } = await db()
    .from("social_posts")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getPost(id: string): Promise<SocialPost | null> {
  const { data } = await db().from("social_posts").select("*").eq("id", id).maybeSingle();
  return (data as SocialPost) ?? null;
}
