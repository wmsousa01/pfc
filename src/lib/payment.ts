/**
 * Regra de pagamento do PFC. Toda página que mostra preço parcelado tira daqui
 * — o "equivale a R$ 214/mês" de uma proposta virou expectativa de 12x sem
 * juros, o cliente viu 12x de R$ 261 no link e o PFC acabou absorvendo 22,6%.
 *
 * Taxas do simulador do Mercado Pago (10/2026, recebimento na hora). No
 * parcelado, a taxa por venda (3,09%) soma com a de parcelamento. Se as taxas
 * mudarem, atualize aqui e a regra abaixo continua valendo.
 *
 * Por que 3x: absorvendo até 3x (11,38%), o anual no cartão ainda fica ~29%
 * abaixo de 12 mensalidades — dentro do desconto máximo que a gente já aceita
 * dar. Em 12x a perda é 22,6% e, para receber o valor cheio, o anual no cartão
 * teria que custar mais que 12 mensalidades. Acima de 3x, o Mercado Pago
 * cobra os juros do comprador.
 *
 * Preço que já tem desconto (Visita para cliente, proposta negociada) é à
 * vista: parcelar sem juros em cima do desconto vende abaixo do piso.
 */

export const MP_SALE_FEE = 3.09;
export const MP_CASH_CARD_FEE = 4.98;
export const MP_INSTALLMENT_FEES: Record<number, number> = {
  2: 6.91,
  3: 8.29,
  4: 9.65,
  5: 10.98,
  6: 12.28,
  7: 13.46,
  8: 14.72,
  9: 15.95,
  10: 17.15,
  11: 18.34,
  12: 19.5,
};

/** Até quantas parcelas o PFC absorve os juros. */
export const MAX_NO_INTEREST = 3;

/** Taxa total do Mercado Pago, em %, para `n` parcelas no cartão. */
export function mpFee(n: number): number {
  if (n <= 1) return MP_CASH_CARD_FEE;
  return MP_SALE_FEE + (MP_INSTALLMENT_FEES[n] ?? MP_INSTALLMENT_FEES[12]);
}

/** Quanto entra no caixa do PFC numa venda de `price` em `n` parcelas sem juros. */
export function netReceived(price: number, n: number): number {
  return price * (1 - mpFee(n) / 100);
}

export function brlCents(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "3x de R$ 950,33 sem juros" */
export function installmentLabel(price: number, n = MAX_NO_INTEREST): string {
  return `${n}x de ${brlCents(price / n)} sem juros`;
}

/** Texto padrão para preço cheio, que aceita o parcelamento da regra. */
export const PAYMENT_TERMS = `Pix à vista ou até ${MAX_NO_INTEREST}x sem juros no cartão. Acima de ${MAX_NO_INTEREST}x, o Mercado Pago cobra juros do comprador.`;

/** Texto padrão para preço que já tem desconto. */
export const PAYMENT_TERMS_CASH = "À vista no Pix ou no cartão. Parcelado, com juros do Mercado Pago.";
