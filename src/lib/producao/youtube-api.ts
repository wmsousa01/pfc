import "server-only";
import { getConfig, setConfig } from "./store";

/**
 * YouTube Data API v3 com a conta do canal (OAuth, não API key): é o único
 * jeito de enxergar vídeos PRIVADOS, baixar a legenda automática, trocar a
 * thumb e agendar a publicação.
 *
 * youtube.force-ssl cobre leitura, captions.download, thumbnails.set e
 * videos.update — um escopo só.
 */
const SCOPE = "https://www.googleapis.com/auth/youtube.force-ssl";
const API = "https://www.googleapis.com/youtube/v3";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export function isYouTubeOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    // offline + consent: o Google só manda refresh_token no primeiro consentimento.
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google OAuth ${res.status}: ${json.error_description ?? json.error}`);
  return json as { access_token: string; refresh_token?: string; expires_in: number };
}

/** Troca o code do callback e grava o refresh token + o canal conectado. */
export async function connectChannel(code: string, redirectUri: string): Promise<string> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("O Google não devolveu refresh_token. Remova o acesso e conecte de novo.");
  const ch = await ytFetch<{ items?: { id: string; snippet: { title: string } }[] }>(
    "/channels?part=snippet&mine=true",
    {},
    t.access_token
  );
  const channel = ch.items?.[0];
  if (!channel) throw new Error("Essa conta Google não tem canal do YouTube.");
  await setConfig("yt_refresh_token", t.refresh_token);
  await setConfig("yt_channel", `${channel.id}|${channel.snippet.title}`);
  return channel.snippet.title;
}

/** Canal conectado (id e nome), ou null. */
export async function connectedChannel(): Promise<{ id: string; title: string } | null> {
  const v = await getConfig("yt_channel");
  if (!v) return null;
  const [id, ...rest] = v.split("|");
  return { id, title: rest.join("|") };
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const refresh = await getConfig("yt_refresh_token");
  if (!refresh) throw new Error("Canal do YouTube não conectado (/admin/producao/config).");
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

async function ytFetch<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const res = await fetch(path.startsWith("http") ? path : `${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token ?? (await accessToken())}`, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube ${res.status}: ${text.slice(0, 300)}`);
  }
  const type = res.headers.get("content-type") ?? "";
  return (type.includes("json") ? res.json() : res.text()) as Promise<T>;
}

export type ChannelVideo = {
  id: string;
  title: string;
  description: string;
  privacy: string;
  durationSec: number;
  thumbUrl: string | null;
  uploadedAt: string;
  /** "live" | "upcoming" enquanto a transmissão não acabou; "none" depois. */
  liveState: string;
  /** Fim da transmissão, só para vídeo que foi live. */
  liveEndedAt: string | null;
};

/** "PT4M13S" → 253 */
function isoDuration(v: string): number {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(v);
  if (!m) return 0;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

/** Os uploads mais recentes do canal, privados inclusive. */
export async function listRecentUploads(max = 50): Promise<ChannelVideo[]> {
  const ch = await ytFetch<{ items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    "/channels?part=contentDetails&mine=true"
  );
  const uploads = ch.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) return [];

  const pl = await ytFetch<{ items?: { contentDetails: { videoId: string } }[] }>(
    `/playlistItems?part=contentDetails&maxResults=${max}&playlistId=${uploads}`
  );
  const ids = (pl.items ?? []).map((i) => i.contentDetails.videoId);
  if (ids.length === 0) return [];

  const vids = await ytFetch<{ items?: any[] }>(
    `/videos?part=snippet,status,contentDetails,liveStreamingDetails&id=${ids.join(",")}`
  );
  return (vids.items ?? []).map((v) => {
    const t = v.snippet.thumbnails ?? {};
    return {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description ?? "",
      privacy: v.status.privacyStatus,
      durationSec: isoDuration(v.contentDetails.duration ?? ""),
      thumbUrl: (t.maxres ?? t.standard ?? t.high ?? t.medium)?.url ?? null,
      uploadedAt: v.snippet.publishedAt,
      liveState: v.snippet.liveBroadcastContent ?? "none",
      liveEndedAt: v.liveStreamingDetails?.actualEndTime ?? null,
    };
  });
}

/**
 * Texto da legenda (automática ou enviada) do vídeo, sem marcação de tempo.
 * null quando o YouTube ainda não gerou a legenda — acontece nos primeiros
 * minutos depois do upload.
 */
export async function fetchTranscript(videoId: string): Promise<string | null> {
  const list = await ytFetch<{ items?: { id: string; snippet: { language: string; trackKind: string } }[] }>(
    `/captions?part=snippet&videoId=${videoId}`
  );
  const tracks = list.items ?? [];
  const pick =
    tracks.find((t) => t.snippet.language.startsWith("pt") && t.snippet.trackKind !== "asr") ??
    tracks.find((t) => t.snippet.language.startsWith("pt")) ??
    tracks[0];
  if (!pick) return null;
  const srt = await ytFetch<string>(`/captions/${pick.id}?tfmt=srt`);
  return srt
    .split(/\r?\n/)
    .filter((l) => l && !/^\d+$/.test(l) && !l.includes("-->"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sobe a thumb (JPEG até 2 MB). Exige canal verificado no YouTube. */
export async function setThumbnail(videoId: string, jpeg: Buffer): Promise<void> {
  await ytFetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}&uploadType=media`,
    { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: new Uint8Array(jpeg) }
  );
}

/**
 * Sobe um vídeo novo, já público (Shorts do Contenta). Upload resumable em uma
 * requisição só: o corte cabe na memória da função. Custa 1.600 de cota —
 * com a cota padrão (10.000/dia) são ~6 uploads por dia no projeto.
 */
export async function uploadVideo(
  video: Buffer,
  meta: { title: string; description: string; tags?: string[] }
): Promise<string> {
  const token = await accessToken();
  const init = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(video.length),
      },
      body: JSON.stringify({
        snippet: {
          title: meta.title.slice(0, 100),
          description: meta.description.slice(0, 5000),
          tags: meta.tags,
          categoryId: "22",
        },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
      cache: "no-store",
    }
  );
  const session = init.headers.get("location");
  if (!init.ok || !session) {
    throw new Error(`YouTube ${init.status}: ${(await init.text().catch(() => "")).slice(0, 300)}`);
  }
  const res = await fetch(session, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "video/mp4" },
    body: new Uint8Array(video),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`YouTube upload ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  const json = (await res.json()) as { id?: string };
  if (!json.id) throw new Error("O YouTube não devolveu o id do vídeo.");
  return json.id;
}

/**
 * Publica agora (publishAt null) ou agenda. O videos.update troca o objeto
 * `status` inteiro, então os demais campos vêm do estado atual — sem isso o
 * vídeo perderia, por exemplo, a marcação de "não é para crianças".
 */
export async function publishVideo(videoId: string, publishAt: Date | null): Promise<void> {
  const cur = await ytFetch<{ items?: { status: Record<string, unknown> }[] }>(
    `/videos?part=status&id=${videoId}`
  );
  const status = cur.items?.[0]?.status;
  if (!status) throw new Error("Vídeo não encontrado no canal.");
  const { uploadStatus, failureReason, rejectionReason, ...rest } = status;
  void uploadStatus; void failureReason; void rejectionReason;
  const next = publishAt
    ? { ...rest, privacyStatus: "private", publishAt: publishAt.toISOString() }
    : { ...rest, privacyStatus: "public", publishAt: undefined };
  await ytFetch(`/videos?part=status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: videoId, status: next }),
  });
}

// ---- Playlists: playlistItems.insert custa 50 de cota; listar custa 1 ----

export type ChannelPlaylist = { id: string; title: string };

export async function listPlaylists(): Promise<ChannelPlaylist[]> {
  const out: ChannelPlaylist[] = [];
  let page = "";
  do {
    const r = await ytFetch<{ items?: { id: string; snippet: { title: string } }[]; nextPageToken?: string }>(
      `/playlists?part=snippet&mine=true&maxResults=50${page ? `&pageToken=${page}` : ""}`
    );
    for (const p of r.items ?? []) out.push({ id: p.id, title: p.snippet.title });
    page = r.nextPageToken ?? "";
  } while (page);
  return out;
}

/** Ids dos vídeos de uma playlist, todas as páginas. */
export async function listPlaylistVideoIds(playlistId: string): Promise<string[]> {
  const out: string[] = [];
  let page = "";
  do {
    const r = await ytFetch<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>(
      `/playlistItems?part=contentDetails&maxResults=50&playlistId=${playlistId}${page ? `&pageToken=${page}` : ""}`
    );
    for (const i of r.items ?? []) out.push(i.contentDetails.videoId);
    page = r.nextPageToken ?? "";
  } while (page);
  return out;
}

export async function createPlaylist(title: string): Promise<string> {
  const r = await ytFetch<{ id: string }>(`/playlists?part=snippet,status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snippet: { title }, status: { privacyStatus: "public" } }),
  });
  return r.id;
}

export async function addToPlaylist(playlistId: string, videoId: string): Promise<void> {
  await ytFetch(`/playlistItems?part=snippet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: "youtube#video", videoId } } }),
  });
}
