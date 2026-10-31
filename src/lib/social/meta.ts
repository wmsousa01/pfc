import "server-only";
import { saveConnection } from "./store";

/**
 * Meta (Facebook + Instagram) pela Graph API, com o token da Página.
 *
 * O login devolve um token de usuário curto → trocado por um longo (60 dias)
 * → o /me/accounts com o token longo devolve tokens de Página que NÃO expiram.
 * O Instagram (conta Business/Creator ligada à Página) publica com o mesmo
 * token da Página.
 */
const V = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${V}`;

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

export class MetaError extends Error {
  constructor(message: string, readonly code: number | null) {
    super(message);
  }
  /** Token inválido/revogado: a conexão precisa ser refeita. */
  get tokenDead(): boolean {
    return this.code === 190;
  }
}

export function isMetaConfigured(): boolean {
  return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
}

export function metaAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? "",
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${V}/dialog/oauth?${params}`;
}

async function graph<T>(path: string, params: Record<string, string> = {}, method: "GET" | "POST" = "GET"): Promise<T> {
  const qs = new URLSearchParams(params);
  const res = await fetch(method === "GET" ? `${GRAPH}${path}?${qs}` : `${GRAPH}${path}`, {
    method,
    ...(method === "POST" ? { body: qs, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new MetaError(`Meta ${res.status}: ${e.error_user_msg ?? e.message ?? "erro"}`, e.code ?? null);
  }
  return json as T;
}

type Page = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

/**
 * Qual Página usar: META_PAGE_ID manda; senão a única; senão a do Fora da
 * Caixa pelo nome. Com várias e nenhuma reconhecida, pede para fixar.
 */
function pickPage(pages: Page[]): Page {
  const forced = process.env.META_PAGE_ID;
  if (forced) {
    const p = pages.find((x) => x.id === forced);
    if (!p) throw new Error(`META_PAGE_ID ${forced} não está entre as Páginas autorizadas.`);
    return p;
  }
  if (pages.length === 1) return pages[0];
  const pfc = pages.filter((p) => /fora\s*da\s*caixa|pfc/i.test(p.name));
  if (pfc.length === 1) return pfc[0];
  if (pages.length === 0) throw new Error("Nenhuma Página autorizada. Marque a Página do Fora da Caixa no login da Meta.");
  throw new Error(
    `Várias Páginas autorizadas (${pages.map((p) => `${p.name} = ${p.id}`).join("; ")}). Defina META_PAGE_ID na Vercel.`
  );
}

/** Troca o code do callback e grava Página e Instagram. Devolve o que conectou. */
export async function connectMeta(code: string, redirectUri: string): Promise<string> {
  const app = { client_id: process.env.META_APP_ID ?? "", client_secret: process.env.META_APP_SECRET ?? "" };
  const short = await graph<{ access_token: string }>("/oauth/access_token", { ...app, redirect_uri: redirectUri, code });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    ...app,
    grant_type: "fb_exchange_token",
    fb_exchange_token: short.access_token,
  });
  const pages = await graph<{ data: Page[] }>("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username}",
    access_token: long.access_token,
  });
  const page = pickPage(pages.data ?? []);

  await saveConnection({ platform: "facebook", accountId: page.id, accountName: page.name, token: page.access_token, scopes: SCOPES });
  const ig = page.instagram_business_account;
  if (!ig) return `${page.name} (sem Instagram Business ligado à Página)`;
  await saveConnection({
    platform: "instagram",
    accountId: ig.id,
    accountName: ig.username ? `@${ig.username}` : null,
    token: page.access_token,
    scopes: SCOPES,
  });
  return `${page.name} + ${ig.username ? `@${ig.username}` : "Instagram"}`;
}

// ---- Instagram Reels: container → processamento → media_publish ----

export async function igCreateReel(igId: string, token: string, videoUrl: string, caption: string): Promise<string> {
  const r = await graph<{ id: string }>(
    `/${igId}/media`,
    { media_type: "REELS", video_url: videoUrl, caption: caption.slice(0, 2200), share_to_feed: "true", access_token: token },
    "POST"
  );
  return r.id;
}

/** FINISHED | IN_PROGRESS | ERROR | EXPIRED | PUBLISHED */
export async function igContainerStatus(containerId: string, token: string): Promise<{ code: string; detail: string | null }> {
  const r = await graph<{ status_code?: string; status?: string }>(`/${containerId}`, {
    fields: "status_code,status",
    access_token: token,
  });
  return { code: r.status_code ?? "IN_PROGRESS", detail: r.status ?? null };
}

export async function igPublish(igId: string, token: string, containerId: string): Promise<{ id: string; url: string | null }> {
  const r = await graph<{ id: string }>(`/${igId}/media_publish`, { creation_id: containerId, access_token: token }, "POST");
  const m = await graph<{ permalink?: string }>(`/${r.id}`, { fields: "permalink", access_token: token }).catch(() => ({
    permalink: undefined,
  }));
  return { id: r.id, url: m.permalink ?? null };
}

// ---- Facebook: vídeo na Página, a Meta baixa direto da URL ----

export async function fbPublishVideo(
  pageId: string,
  token: string,
  videoUrl: string,
  title: string,
  description: string
): Promise<{ id: string; url: string }> {
  const r = await graph<{ id: string }>(
    `/${pageId}/videos`,
    { file_url: videoUrl, title: title.slice(0, 255), description, access_token: token },
    "POST"
  );
  return { id: r.id, url: `https://www.facebook.com/${pageId}/videos/${r.id}/` };
}
