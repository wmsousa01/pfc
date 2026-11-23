import "server-only";
import { db } from "@/lib/producao/store";
import { decrypt, encrypt } from "./crypto";

export type Platform = "youtube" | "instagram" | "facebook" | "tiktok";
export type ConnectedPlatform = Exclude<Platform, "youtube">;
/** Contas de anúncio (/admin/campanhas): mesma tabela, mesmo cofre de tokens. */
export type AdsPlatform = "meta_ads" | "google_ads";
type AnyConnection = ConnectedPlatform | AdsPlatform;

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
  platform: AnyConnection;
  external_account_id: string;
  account_name: string | null;
  status: "ativa" | "revogada";
  /** false = perfil extra do Instagram (ex.: Lado A Lado B), escolhido post a post. */
  principal: boolean;
  /** null = não expira (token de Página da Meta). */
  token_expires_at: string | null;
  created_at: string;
};

export type SocialPost = {
  id: string;
  platform: Platform;
  connection_id: number | null;
  /** Perfil extra de destino (social_connections.id); null = conta principal. */
  perfil_id: number | null;
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
  /** Perfis convidados para o collab (sem @). */
  collaborators: string[];
  /** A Meta recusou collab no reel de teste: saiu sem o convite. */
  collab_dropped: boolean;
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
    .select("id, platform, external_account_id, account_name, status, principal, token_expires_at, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as SafeConnection[];
}

export type LiveConnection = {
  id: number;
  accountId: string;
  accountName: string | null;
  token: string;
  expiresAt: string | null;
  principal: boolean;
};

const LIVE_COLS = "id, external_account_id, account_name, access_token_enc, token_expires_at, principal";

function live(data: {
  id: number;
  external_account_id: string;
  account_name: string | null;
  access_token_enc: string;
  token_expires_at: string | null;
  principal: boolean;
}): LiveConnection {
  return {
    id: data.id,
    accountId: data.external_account_id,
    accountName: data.account_name,
    token: decrypt(data.access_token_enc),
    expiresAt: data.token_expires_at,
    principal: data.principal,
  };
}

/** A conta principal ativa da rede, com o token em claro. Só para o servidor. */
export async function activeConnection(platform: AnyConnection): Promise<LiveConnection | null> {
  const { data } = await db()
    .from("social_connections")
    .select(LIVE_COLS)
    .eq("platform", platform)
    .eq("status", "ativa")
    .eq("principal", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? live(data) : null;
}

/** Uma conta ativa pelo id (perfil extra do Instagram), com o token em claro. */
export async function connectionById(id: number): Promise<LiveConnection | null> {
  const { data } = await db().from("social_connections").select(LIVE_COLS).eq("id", id).eq("status", "ativa").maybeSingle();
  return data ? live(data) : null;
}

/**
 * Grava a conta. A principal desativa as outras principais da mesma rede
 * (uma principal por rede); um perfil extra (`principal: false`) convive com ela.
 */
export async function saveConnection(c: {
  platform: AnyConnection;
  accountId: string;
  accountName: string | null;
  token: string;
  expiresAt?: Date | null;
  scopes?: string;
  principal?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const principal = c.principal ?? true;
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
        principal,
        updated_at: now,
      },
      { onConflict: "platform,external_account_id" }
    );
  if (error) throw new Error(error.message);
  if (!principal) return;
  await db()
    .from("social_connections")
    .update({ status: "revogada", updated_at: now })
    .eq("platform", c.platform)
    .eq("principal", true)
    .neq("external_account_id", c.accountId);
}

export async function revokeConnection(id: number): Promise<void> {
  await db().from("social_connections").update({ status: "revogada", updated_at: new Date().toISOString() }).eq("id", id);
}

/** Apaga as contas das redes. Os perfis extras do Instagram só saem com `extras`. */
export async function deleteConnections(platforms: AnyConnection[], extras = false): Promise<void> {
  let q = db().from("social_connections").delete().in("platform", platforms);
  if (!extras) q = q.eq("principal", true);
  await q;
}

/** Desconecta um perfil extra. Os posts dele que ainda estão na fila param com erro, não caem na principal. */
export async function deleteExtraConnection(id: number): Promise<void> {
  await db().from("social_connections").delete().eq("id", id).eq("principal", false);
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
