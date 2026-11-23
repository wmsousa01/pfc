import type { Momento, TipoInsercao } from "./tipos";

/**
 * Monta a fila de uma live a partir das cotas do quadro. Puro: sem banco,
 * para dar para conferir a conta.
 *
 * - abertura: em sequência no começo (vinheta primeiro, depois por prioridade);
 * - continuo: logo do episódio todo, desde o segundo 0;
 * - durante: "N vezes" espalha por igual entre o fim da abertura e os últimos
 *   minutos; "a cada N min" repete até lá. Cada cota ganha um deslocamento
 *   pequeno, para duas marcas não caírem sempre no mesmo minuto;
 * - encerramento: sem hora, espera a régie apertar "Encerramento".
 *
 * O relógio (ao_vivo_avancar) serializa o destaque: se dois horários colidem,
 * o segundo entra depois do primeiro mais o respiro.
 */

export type CotaPlano = {
  id: string;
  partner_id: string;
  tipo: TipoInsercao;
  momento: Momento;
  duracao_s: number;
  vezes: number | null;
  a_cada_min: number | null;
  prioridade: number;
};

export type InsercaoPlanejada = {
  cota_id: string;
  partner_id: string;
  tipo: TipoInsercao;
  momento: Momento;
  previsto_s: number | null;
  duracao_s: number;
  prioridade: number;
};

/** Depois da abertura, antes de começar a espalhar. */
export const INICIO_MEIO_S = 3 * 60;
/** Antes do fim previsto, para não atropelar o encerramento. */
export const FIM_MEIO_S = 5 * 60;
const DESLOCAMENTO_S = 40;

const ordemAbertura = (a: CotaPlano, b: CotaPlano) =>
  Number(b.tipo === "vinheta") - Number(a.tipo === "vinheta") || b.prioridade - a.prioridade;

export function montarFila(cotas: CotaPlano[], duracaoMin: number): InsercaoPlanejada[] {
  const fim = Math.max(duracaoMin * 60 - FIM_MEIO_S, INICIO_MEIO_S + 60);
  const janela = fim - INICIO_MEIO_S;
  const fila: InsercaoPlanejada[] = [];
  const item = (c: CotaPlano, previsto_s: number | null): InsercaoPlanejada => ({
    cota_id: c.id,
    partner_id: c.partner_id,
    tipo: c.tipo,
    momento: c.momento,
    previsto_s: previsto_s === null ? null : Math.round(previsto_s),
    duracao_s: c.momento === "continuo" ? 0 : c.duracao_s,
    prioridade: c.prioridade,
  });

  // Abertura: segundos 0, 1, 2... só para manter a ordem; o relógio põe o respiro.
  cotas
    .filter((c) => c.momento === "abertura")
    .sort(ordemAbertura)
    .forEach((c, i) => fila.push(item(c, i)));

  for (const c of cotas.filter((c) => c.momento === "continuo")) fila.push(item(c, 0));

  const durante = cotas.filter((c) => c.momento === "durante").sort((a, b) => b.prioridade - a.prioridade);
  durante.forEach((c, idx) => {
    const desloc = (idx * DESLOCAMENTO_S) % 180;
    if (c.vezes) {
      const passo = janela / c.vezes;
      for (let k = 0; k < c.vezes; k++) {
        fila.push(item(c, Math.min(INICIO_MEIO_S + passo * (k + 0.5) + desloc, fim)));
      }
    } else if (c.a_cada_min) {
      const passo = c.a_cada_min * 60;
      for (let t = INICIO_MEIO_S + desloc; t <= fim; t += passo) fila.push(item(c, t));
    }
  });

  for (const c of cotas.filter((c) => c.momento === "encerramento").sort(ordemAbertura)) fila.push(item(c, null));

  return fila;
}
