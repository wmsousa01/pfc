import "server-only";
import { unstable_cache } from "next/cache";
import { channelStats as fallback } from "./config";
import { channelStatisticsMine, analyticsReport, uploadsSince } from "./producao/youtube-api";

/**
 * Números do canal para o site, puxados do YouTube com a conta conectada em
 * /admin/producao/config. Cache de 1 h: as páginas que mostram os números
 * revalidam nesse ritmo (o Analytics só fecha o dia seguinte, então mais que
 * isso não muda nada).
 *
 * Cada bloco cai sozinho para o valor fixo de `channelStats` (config.ts): sem
 * canal conectado, sem o escopo do Analytics ou com a API fora, o site continua
 * mostrando o último número conferido à mão.
 */
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

  const [stats, rolling, months, uploads] = await Promise.allSettled([
    channelStatisticsMine(),
    (() => {
      // Últimos 365 dias fechados (o dia de hoje ainda não tem dado).
      const end = new Date(Date.now() - 86_400_000);
      const start = new Date(end.getTime() - 364 * 86_400_000);
      return analyticsReport({ startDate: ymd(start), endDate: ymd(end), metrics: "views,estimatedMinutesWatched,likes" });
    })(),
    (() => {
      // Melhor mês: só meses fechados, os 12 anteriores ao atual. Com
      // dimensions=month as duas datas têm de ser dia 1: endDate = 1º do
      // último mês fechado (o mês inteiro entra).
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return analyticsReport({ startDate: ymd(start), endDate: ymd(end), metrics: "views", dimensions: "month" });
    })(),
    uploadsSince(new Date(Date.now() - 28 * 86_400_000)),
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

export const getChannelStats = unstable_cache(load, ["channel-stats-v1"], {
  revalidate: 3600,
  tags: ["channel-stats"],
});

/** "16/11/2026" a partir do updatedAt, ou null. */
export function statsDateLabel(s: ChannelStatsView): string | null {
  if (!s.updatedAt) return null;
  return new Date(s.updatedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
