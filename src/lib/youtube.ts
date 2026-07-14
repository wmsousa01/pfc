import { XMLParser } from "fast-xml-parser";
import { youtube } from "./config";

export type YouTubeVideo = {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  published: string; // ISO
  views?: number;
  description?: string;
  isShort: boolean;
};

const FEED_URL = (channelId: string) =>
  `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
});

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function parseEntry(entry: any): YouTubeVideo {
  const id = entry["yt:videoId"];
  const group = entry["media:group"] ?? {};
  const thumb = group["media:thumbnail"];
  const stats = group["media:community"]?.["media:statistics"];
  const viewsRaw = stats?.["@_views"];
  const altHref = toArray(entry.link).find(
    (l: any) => l?.["@_rel"] === "alternate"
  )?.["@_href"] as string | undefined;
  const isShort = !!altHref && altHref.includes("/shorts/");
  return {
    id,
    title: entry.title ?? group["media:title"] ?? "",
    url: altHref ?? `https://www.youtube.com/watch?v=${id}`,
    thumbnail: thumb?.["@_url"] ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    published: entry.published ?? "",
    views: viewsRaw != null ? Number(viewsRaw) : undefined,
    description: group["media:description"],
    isShort,
  };
}

async function fetchFeed(): Promise<YouTubeVideo[]> {
  const res = await fetch(FEED_URL(youtube.channelId), {
    next: { revalidate: 1800 },
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const data = parser.parse(xml);
  return toArray(data?.feed?.entry).map(parseEntry);
}

/**
 * Últimos vídeos do canal via feed RSS público (sem API key).
 * Revalida a cada 30 min (ISR). Retorna [] em caso de falha para não quebrar a página.
 */
export async function getLatestVideos(limit = 6): Promise<YouTubeVideo[]> {
  try {
    return (await fetchFeed()).slice(0, limit);
  } catch {
    return [];
  }
}

/** Separa os vídeos em episódios (long-form) e shorts. */
export async function getVideosSplit(): Promise<{
  episodes: YouTubeVideo[];
  shorts: YouTubeVideo[];
  latest: YouTubeVideo | null;
}> {
  try {
    const all = await fetchFeed();
    const episodes = all.filter((v) => !v.isShort);
    const shorts = all.filter((v) => v.isShort);
    return { episodes, shorts, latest: all[0] ?? null };
  } catch {
    return { episodes: [], shorts: [], latest: null };
  }
}
