import type { Platform } from "./store";

/**
 * Ritmo da publicação orgânica: a fila (publisher.ts) segura o que passar
 * disso e a aba Semana (/admin/marketing/semana) compara o publicado com a meta.
 *
 * Por que (auditoria de 16/11/2026): a fila soltava 195 posts numa semana e
 * nada na seguinte, publicava Shorts às 2h, 4h e 6h da manhã, e os 12 Reels
 * de teste por dia esbarraram no limite da Meta em 08/11 (104 recusados).
 */

/** Horário de Brasília em que a fila publica: das 10h00 às 21h59. */
export const JANELA = { inicio: 10, fim: 22 } as const;
export const JANELA_HORAS = JANELA.fim - JANELA.inicio;

/** Teto por 24h e intervalo mínimo entre dois posts da mesma rede. */
export const RITMO: Record<Platform, { porDia: number; intervaloMin: number }> = {
  // 4 por dia (decisão de 16/11/2026): Shorts trazem 89% das views do canal.
  // Horários fixos em auto-youtube.ts (10h, 13h, 16h, 19h + folga de até 40 min).
  youtube: { porDia: 4, intervaloMin: 2 * 60 },
  // 1 Reel no perfil + até 4 de teste.
  instagram: { porDia: 5, intervaloMin: 2 * 60 },
  facebook: { porDia: 2, intervaloMin: 5 * 60 },
  tiktok: { porDia: 2, intervaloMin: 5 * 60 },
};

/**
 * Reels de teste por 24h. A Meta não publica o número; com 12 por dia a conta
 * bateu "maximum number of trial reels" em 5 dias. Quando ela recusa mesmo
 * assim, a fila para os testes por 24 h (IG_TESTES_BLOQUEIO).
 */
export const IG_TESTES_POR_DIA = 4;
/** Chave em producao_config: até quando os testes ficam parados (ISO). */
export const IG_TESTES_BLOQUEIO = "ig_testes_bloqueio_ate";

/** Linhas da grade da semana e a meta de cada uma por dia. */
export type LinhaSemana = "youtube" | "ig_perfil" | "ig_teste" | "facebook" | "tiktok";
export const METAS: { key: LinhaSemana; label: string; porDia: number }[] = [
  { key: "youtube", label: "YouTube Shorts", porDia: RITMO.youtube.porDia },
  { key: "ig_perfil", label: "Instagram · perfil", porDia: 1 },
  { key: "ig_teste", label: "Instagram · teste", porDia: IG_TESTES_POR_DIA },
  { key: "facebook", label: "Facebook", porDia: 1 },
  { key: "tiktok", label: "TikTok", porDia: 1 },
];

export function linhaDo(p: { platform: Platform; trial: boolean; graduated_at?: string | null }): LinhaSemana {
  if (p.platform === "instagram") return p.trial && !p.graduated_at ? "ig_teste" : "ig_perfil";
  return p.platform;
}

const BRT_MS = 3 * 3_600_000;
const DIA = 86_400_000;

/** Hora cheia em Brasília (sem horário de verão desde 2019). */
export function horaBrasilia(t: number): number {
  return new Date(t - BRT_MS).getUTCHours();
}

/** Meia-noite em Brasília do dia de `t`, em ms UTC. */
function inicioDoDia(t: number): number {
  return Math.floor((t - BRT_MS) / DIA) * DIA + BRT_MS;
}

/**
 * O próprio `t` se cair na janela; senão a próxima abertura (10h), com até
 * 30 min de folga aleatória para os adiados da madrugada não saírem juntos.
 */
export function dentroDaJanela(t: number): number {
  const h = horaBrasilia(t);
  if (h >= JANELA.inicio && h < JANELA.fim) return t;
  const dia = inicioDoDia(t) + (h >= JANELA.fim ? DIA : 0);
  return dia + JANELA.inicio * 3_600_000 + Math.floor(Math.random() * 30 * 60_000);
}

/** Segunda-feira (YYYY-MM-DD, Brasília) da semana de `t`. */
export function segundaDe(t: number): string {
  const d = new Date(inicioDoDia(t) - BRT_MS + 12 * 3_600_000); // meio-dia, longe da virada
  const dow = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - dow * DIA).toISOString().slice(0, 10);
}

/** Início (00h de segunda) e fim (00h da segunda seguinte) da semana, em ms UTC. */
export function limitesDaSemana(segunda: string): { ini: number; fim: number } {
  const ini = new Date(`${segunda}T00:00:00-03:00`).getTime();
  return { ini, fim: ini + 7 * DIA };
}

export function isSegunda(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}
