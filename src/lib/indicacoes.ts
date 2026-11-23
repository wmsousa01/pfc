import { CAMPANHA } from "@/lib/campanha";

/**
 * Indicação de patrocínio pelo parceiro. A regra de comissão é a do playbook
 * (docs/estrategia-revendedores-parceiros.md §3) mais o bônus da campanha:
 *
 * - vendeu (esteve na reunião, cliente assinou): 30% do contrato mínimo
 *   (3 meses), ou seja, 0,9 mensalidade; no anual, 1,5× a mensalidade
 *   equivalente (~16% do contrato). Teto da regra de preço: comissão +
 *   desconto ≤ 30% da tabela (benchmark de 16/11/2026, docs/precificacao.md).
 *   Exceção: o que fecha DENTRO da campanha de fim de ano mantém a promessa
 *   feita aos parceiros — 1 mensalidade inteira.
 * - indicou (só passou o contato): 30% disso.
 * - apresentador trazendo patrocínio para o próprio quadro, fechado dentro da
 *   campanha: +20% sobre a comissão.
 * - patrocina (o apresentador patrocinando com a empresa dele): sem comissão;
 *   o benefício é o desconto de 25%.
 *
 * Pagamento: mensal em duas parcelas (50% após o 1º pagamento do cliente e 50%
 * após o 3º); anual de uma vez, até 7 dias depois do pagamento.
 */

export type IndicacaoStatus = "registrada" | "aprovada" | "reuniao" | "fechada" | "perdida" | "rejeitada";
export type IndicacaoPapel = "indicou" | "vendeu" | "patrocina";
export type Ciclo = "mensal" | "anual";

export type Indicacao = {
  id: string;
  reseller_id: string;
  lead_id: string | null;
  empresa: string;
  contato: string | null;
  whatsapp: string | null;
  interesse: string | null;
  quadro: string | null;
  papel: IndicacaoPapel;
  origem: "registro" | "link";
  status: IndicacaoStatus;
  ciclo: Ciclo | null;
  mensal_cents: number | null;
  comissao_cents: number | null;
  campanha: string | null;
  protegida_ate: string | null;
  fechada_em: string | null;
  parcela1_paga_em: string | null;
  parcela2_paga_em: string | null;
  observacao: string | null;
  retorno: string | null;
  created_at: string;
  updated_at: string;
};

export const STATUS_LABEL: Record<IndicacaoStatus, string> = {
  registrada: "Em análise",
  aprovada: "Aprovada",
  reuniao: "Em reunião",
  fechada: "Fechada",
  perdida: "Não fechou",
  rejeitada: "Recusada",
};

export const STATUS_STYLE: Record<IndicacaoStatus, string> = {
  registrada: "bg-white/5 border-white/15 text-white/60",
  aprovada: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  reuniao: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  fechada: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  perdida: "bg-white/5 border-white/10 text-white/35",
  rejeitada: "bg-red-500/10 border-red-500/30 text-red-300",
};

export const PAPEL_LABEL: Record<IndicacaoPapel, string> = {
  indicou: "Indiquei (passei o contato)",
  vendeu: "Vou vender (estarei na reunião)",
  patrocina: "Minha empresa vai patrocinar",
};

/** Dias de proteção depois de aprovada; não fechou, volta para o pote comum. */
export const PROTECAO_DIAS = 60;
export const INDICOU_FRACAO = 0.3;
export const ANUAL_MULTIPLICADOR = 1.5;
/** Vendeu, contrato mensal: 30% de 3 mensalidades (contrato mínimo). */
export const VENDEU_MENSAL_MULTIPLICADOR = 0.9;
/** Na campanha de fim de ano, a promessa é 1 mensalidade inteira. */
export const VENDEU_MENSAL_CAMPANHA = 1;

export type RegraComissao = {
  mensalCents: number;
  ciclo: Ciclo;
  papel: IndicacaoPapel;
  /** Apresentador trazendo patrocínio para o quadro que ele apresenta. */
  quadroDoApresentador: boolean;
  /** Fechada dentro do prazo da campanha. */
  naCampanha: boolean;
};

export function comissaoCents(r: RegraComissao): { base: number; bonus: number; total: number } {
  if (r.papel === "patrocina" || r.mensalCents <= 0) return { base: 0, bonus: 0, total: 0 };
  const mensal = r.naCampanha ? VENDEU_MENSAL_CAMPANHA : VENDEU_MENSAL_MULTIPLICADOR;
  const vendeu = r.mensalCents * (r.ciclo === "anual" ? ANUAL_MULTIPLICADOR : mensal);
  const base = Math.round(r.papel === "vendeu" ? vendeu : vendeu * INDICOU_FRACAO);
  const bonus =
    r.quadroDoApresentador && r.naCampanha ? Math.round((base * CAMPANHA.apresentador.bonusPercent) / 100) : 0;
  return { base, bonus, total: base + bonus };
}

/** As parcelas da comissão e quando cada uma é liberada. */
export function parcelas(i: Pick<Indicacao, "ciclo" | "comissao_cents">): { valor: number; quando: string }[] {
  const total = i.comissao_cents ?? 0;
  if (!total) return [];
  if (i.ciclo === "anual") return [{ valor: total, quando: "até 7 dias após o pagamento do cliente" }];
  const metade = Math.round(total / 2);
  return [
    { valor: metade, quando: "após o 1º pagamento do cliente" },
    { valor: total - metade, quando: "após o 3º pagamento do cliente" },
  ];
}
