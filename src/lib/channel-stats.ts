import "server-only";
import { cache } from "react";
import { channelStats as fallback } from "./config";
import { SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL } from "./supabase/env";

/**
 * Números do canal para o site, puxados do YouTube com a conta conectada em
 * /admin/producao/config.
 *
 * As páginas que mostram os números são estáticas (ISR). No Next 14, um fetch
 * `no-store` dentro delas aborta a geração; o supabase-js engole esse erro e o
 * token "some". Por isso aqui nada é no-store, nem usa o cliente do supabase
 * ou o ytFetch de producao/youtube-api: cada fetch vai para o Data Cache com
 * revalidate de 1 h (o token de acesso, 30 min, porque vale 1 h). O Analytics
 * só fecha o dia seguinte, então renovar com mais frequência não muda nada.
 *
 * Cada bloco cai sozinho para o valor fixo de `channelStats` (config.ts): sem
 * canal conectado, sem o escopo do Analytics ou com a API fora, o site continua
 * mostrando o último número conferido à mão.
 */
const HOUR = { revalidate: 3600, tags: ["channel-stats"] };

async function readRefreshToken(): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/producao_config?select=value&key=eq.yt_refresh_token`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
    next: HOUR,
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const rows = (await res.json()) as { value: string }[];
  return rows[0]?.value ?? null;
}

async function accessToken(refresh: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
    next: { revalidate: 1800, tags: ["channel-stats"] },
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Google OAuth ${res.status}: ${json.error_description ?? json.error}`);
  return json.access_token as string;
}

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url.startsWith("http") ? url : `https://www.googleapis.com/youtube/v3${url}`, {
    headers: { Authorization: `Bearer ${token}` },
    next: HOUR,
  });
  if (!res.ok) throw new Error(`YouTube ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

/** Inscritos (null se o canal esconde), views e vídeos totais. Custa 1 de cota. */
async function channelStatistics(token: string) {
  const r = await get<{
    items?: { statistics: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount: string; videoCount: string } }[];
  }>("/channels?part=statistics&mine=true", token);
  const s = r.items?.[0]?.statistics;
  if (!s) return null;
  return {
    subscribers: s.hiddenSubscriberCount || s.subscriberCount == null ? null : Number(s.subscriberCount),
    views: Number(s.viewCount),
    videos: Number(s.videoCount),
  };
}

/** YouTube Analytics (reports.query) do próprio canal. Devolve as linhas cruas. */
async function analyticsReport(token: string, q: { startDate: string; endDate: string; metrics: string; dimensions?: string }) {
  const params = new URLSearchParams({ ids: "channel==MINE", ...q });
  const r = await get<{ rows?: unknown[][] }>(`https://youtubeanalytics.googleapis.com/v2/reports?${params}`, token);
  return r.rows ?? [];
}

/** Quantos uploads públicos saíram desde `since` (para a média por semana). */
async function uploadsSince(token: string, since: Date): Promise<number> {
  const ch = await get<{ items?: { contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
    "/channels?part=contentDetails&mine=true",
    token
  );
  const uploads = ch.items?.[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploads) return 0;
  let count = 0;
  let page = "";
  // A playlist de uploads vem do mais novo para o mais velho: para no primeiro
  // vídeo anterior a `since`. Teto de 6 páginas (300 vídeos) por segurança.
  for (let i = 0; i < 6; i++) {
    const r = await get<{ items?: { contentDetails: { videoPublishedAt?: string } }[]; nextPageToken?: string }>(
      `/playlistItems?part=contentDetails&maxResults=50&playlistId=${uploads}${page ? `&pageToken=${page}` : ""}`,
      token
    );
    for (const it of r.items ?? []) {
      const at = it.contentDetails.videoPublishedAt;
      if (!at) continue; // privado/agendado: ainda não conta
      if (new Date(at) < since) return count;
      count++;
    }
    if (!r.nextPageToken) break;
    page = r.nextPageToken;
  }
  return count;
}

export type ChannelStatsView = typeof fallback & {
  /** Data da última leitura bem-sucedida (ISO), ou null se tudo veio do fixo. */
  updatedAt: string | null;
  /** Meses desde o primeiro vídeo, para o "Em ~N meses de canal". */
  monthsActive: number;
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");

/** 1530 → "1,53 mil"; 806123 → "806 mil"; 1250000 → "1,25 mi". */
function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumSignificantDigits: 3 })} mi`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("pt-BR", { maximumSignificantDigits: 3 })} mil`;
  return int(n);
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Começo do canal: abril/2025 (primeiro vídeo). */
const INICIO = new Date(Date.UTC(2025, 3, 1));

function monthsSince(d: Date): number {
  const now = new Date();
  return (now.getUTCFullYear() - d.getUTCFullYear()) * 12 + now.getUTCMonth() - d.getUTCMonth();
}

async function load(): Promise<ChannelStatsView> {
  const out: ChannelStatsView = { ...fallback, updatedAt: null, monthsActive: monthsSince(INICIO) };
  let ok = false;

  let token: string;
  try {
    const refresh = await readRefreshToken();
    if (!refresh) return out;
    token = await accessToken(refresh);
  } catch (e) {
    console.warn("[channel-stats] token:", e);
    return out;
  }

  // Dia (e não hora) nas datas: a URL do Analytics fica igual o dia todo e o
  // Data Cache acerta.
  const [stats, rolling, months, uploads] = await Promise.allSettled([
    channelStatistics(token),
    (() => {
      // Últimos 365 dias fechados (o dia de hoje ainda não tem dado).
      const end = new Date(Date.now() - 86_400_000);
      const start = new Date(end.getTime() - 364 * 86_400_000);
      return analyticsReport(token, { startDate: ymd(start), endDate: ymd(end), metrics: "views,estimatedMinutesWatched,likes" });
    })(),
    (() => {
      // Melhor mês: só meses fechados, os 12 anteriores ao atual. Com
      // dimensions=month as duas datas têm de ser dia 1: endDate = 1º do
      // último mês fechado (o mês inteiro entra).
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return analyticsReport(token, { startDate: ymd(start), endDate: ymd(end), metrics: "views", dimensions: "month" });
    })(),
    uploadsSince(token, new Date(Date.now() - 28 * 86_400_000)),
  ]);

  if (stats.status === "fulfilled" && stats.value) {
    const s = stats.value;
    if (s.subscribers != null) out.subscribers = compact(s.subscribers);
    out.totalViews = int(s.views);
    out.totalVideos = int(s.videos);
    ok = true;
  } else if (stats.status === "rejected") {
    console.warn("[channel-stats] statistics:", stats.reason);
  }

  if (rolling.status === "fulfilled" && rolling.value[0]) {
    const [views, minutes, likes] = rolling.value[0] as number[];
    out.views12m = compact(views);
    out.watchHoursYear = int(minutes / 60);
    out.likes12m = int(likes);
    ok = true;
  } else if (rolling.status === "rejected") {
    console.warn("[channel-stats] analytics 12m:", rolling.reason);
  }

  if (months.status === "fulfilled" && months.value.length > 0) {
    const best = (months.value as [string, number][]).reduce((a, b) => (b[1] > a[1] ? b : a));
    const [y, m] = best[0].split("-").map(Number);
    out.bestMonth = compact(best[1]);
    out.bestMonthLabel = `${MESES[m - 1]}/${y}`;
  } else if (months.status === "rejected") {
    console.warn("[channel-stats] analytics por mês:", months.reason);
  }

  if (uploads.status === "fulfilled" && uploads.value > 0) {
    out.weeklyContent = `~${Math.round(uploads.value / 4)}`;
    ok = true;
  } else if (uploads.status === "rejected") {
    console.warn("[channel-stats] uploads:", uploads.reason);
  }

  if (ok) out.updatedAt = new Date().toISOString();
  return out;
}

/** Uma leitura por renderização (Hero, Números e Parcerias dividem a mesma). */
export const getChannelStats = cache(load);

/** "16/11/2026" a partir do updatedAt, ou null. */
export function statsDateLabel(s: ChannelStatsView): string | null {
  if (!s.updatedAt) return null;
  return new Date(s.updatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
