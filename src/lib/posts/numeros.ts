import "server-only";
import { analyticsReport, channelStatisticsMine, videoTitles } from "@/lib/producao/youtube-api";
import { limpaTitulo, metricas, semanaPassada, variacao } from "@/lib/social/numeros-semana";
import type { NumerosPost, PeriodoNumeros } from "./tipos";

const DIA = 86_400_000;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Início, fim e nome do período. O Analytics fecha cada dia com uns 2 dias de atraso. */
function limites(periodo: PeriodoNumeros, agora = Date.now()): { ini: string; fim: string; nome: string } {
  if (periodo === "semana") {
    const segunda = semanaPassada(agora);
    const t = new Date(`${segunda}T12:00:00Z`).getTime();
    const fim = new Date(t + 6 * DIA);
    const dd = (d: Date) => String(d.getUTCDate()).padStart(2, "0");
    return { ini: segunda, fim: ymd(t + 6 * DIA), nome: `${dd(new Date(t))} a ${dd(fim)}/${String(fim.getUTCMonth() + 1).padStart(2, "0")}` };
  }
  if (periodo === "mes") {
    const hoje = new Date(agora);
    const ini = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1, 12));
    const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), 0, 12));
    return { ini: ymd(ini.getTime()), fim: ymd(fim.getTime()), nome: `${MESES[ini.getUTCMonth()]} de ${ini.getUTCFullYear()}` };
  }
  const fim = agora - 2 * DIA;
  return { ini: ymd(fim - 27 * DIA), fim: ymd(fim), nome: "Últimos 28 dias" };
}

/** Números do canal no período e no período anterior de mesmo tamanho, para a variação. */
export async function lerNumerosPeriodo(periodo: PeriodoNumeros): Promise<NumerosPost> {
  const { ini, fim, nome } = limites(periodo);
  const tIni = new Date(`${ini}T12:00:00Z`).getTime();
  const dias = Math.round((new Date(`${fim}T12:00:00Z`).getTime() - tIni) / DIA) + 1;
  const antesIni = ymd(tIni - dias * DIA);
  const antesFim = ymd(tIni - DIA);

  const [atual, anterior, stats, topRows, tipos] = await Promise.all([
    metricas(ini, fim),
    metricas(antesIni, antesFim),
    channelStatisticsMine().catch(() => null),
    analyticsReport({ startDate: ini, endDate: fim, metrics: "views", dimensions: "video", sort: "-views", maxResults: "3" }),
    analyticsReport({ startDate: ini, endDate: fim, metrics: "views", dimensions: "creatorContentType" }).catch(() => []),
  ]);
  if (atual.views === 0 && anterior.views === 0) {
    throw new Error("O YouTube Analytics não devolveu números. Confira a conexão do canal em /admin/producao/config.");
  }

  const linhas = topRows as [string, number][];
  const titulos = await videoTitles(linhas.map((r) => r[0])).catch(() => new Map<string, string>());
  const porTipo = tipos as [string, number][];
  const totalTipo = porTipo.reduce((s, [, v]) => s + Number(v), 0);
  const shorts = porTipo.find(([k]) => k === "shorts")?.[1];

  return {
    periodo: nome,
    views: atual.views,
    viewsVar: variacao(atual.views, anterior.views),
    horas: atual.horas,
    horasVar: variacao(atual.horas, anterior.horas),
    novosInscritos: atual.ganhos - atual.perdidos,
    inscritosTotal: stats?.subscribers ?? null,
    shortsPct: totalTipo > 0 && shorts != null ? (Number(shorts) / totalTipo) * 100 : null,
    top: linhas.map(([id, v]) => ({ titulo: limpaTitulo(titulos.get(id) ?? id), views: Number(v) })),
  };
}
