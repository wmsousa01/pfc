import type { CommissionType, Reseller } from "./types";

export type CommissionInput = {
  commission_type: CommissionType;
  commission_value: number;
};

export type DiscountInput = {
  discount_percent: number;
};

/** Teto de desconto — o mesmo do check em `supabase/005_desconto_e_privacidade.sql`. */
export const MAX_DISCOUNT_PERCENT = 30;

/**
 * Desconto que o cupom do revendedor dá ao cliente, em centavos.
 * Incide sobre o subtotal (soma dos itens a preço de tabela).
 */
export function calcDiscountCents(
  reseller: DiscountInput | null | undefined,
  subtotalCents: number
): number {
  const percent = Math.min(
    MAX_DISCOUNT_PERCENT,
    Math.max(0, reseller?.discount_percent ?? 0)
  );
  if (!percent || subtotalCents <= 0) return 0;
  return Math.min(subtotalCents, Math.round((subtotalCents * percent) / 100));
}

/**
 * Calcula a comissão de um pedido em centavos.
 * - 'percent': percentual sobre o valor total do pedido.
 * - 'fixed':   valor fixo (em centavos) por PEÇA vendida.
 *
 * IMPORTANTE: `totalCents` é o valor LÍQUIDO, já descontado o cupom. Comissão
 * sobre o preço de tabela faria o PFC pagar duas vezes pelo mesmo desconto.
 *
 * O resultado é congelado no pedido no momento da criação — mudar a regra
 * do revendedor depois não reescreve comissões já geradas.
 */
export function calcCommissionCents(
  reseller: CommissionInput | null | undefined,
  totalCents: number,
  totalUnits: number
): number {
  if (!reseller) return 0;
  const value = Math.max(0, reseller.commission_value ?? 0);

  if (reseller.commission_type === "fixed") {
    return Math.max(0, Math.round(value * totalUnits));
  }
  return Math.max(0, Math.round((totalCents * value) / 100));
}

/** Descrição legível da regra ("10% por venda" / "R$ 15,00 por peça"). */
export function commissionLabel(
  reseller: Pick<Reseller, "commission_type" | "commission_value">
): string {
  if (reseller.commission_type === "fixed") {
    const brl = (reseller.commission_value / 100).toFixed(2).replace(".", ",");
    return `R$ ${brl} por peça`;
  }
  return `${reseller.commission_value}% por venda`;
}

/** "5% OFF para quem usa seu cupom" — ou null quando o cupom só atribui. */
export function discountLabel(
  reseller: Pick<Reseller, "discount_percent">
): string | null {
  return reseller.discount_percent > 0
    ? `${reseller.discount_percent}% OFF para quem usa seu cupom`
    : null;
}

/** Cupom do revendedor: o slug em maiúsculas. */
export function couponFor(slug: string): string {
  return slug.toUpperCase();
}

/** Normaliza o que o cliente digitou no campo de cupom. */
export function normalizeCoupon(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]/g, "");
}
