/**
 * Propostas comerciais fechadas, uma por cliente, servidas em /proposta/[slug].
 *
 * O slug leva um sufixo aleatório de propósito: a página mostra condição
 * negociada (desconto de fidelidade, bônus) que não pode virar referência
 * pública da tabela. A rota fica fora do sitemap e bloqueada no robots.
 *
 * O pagamento é um Link de Pagamento criado à mão no painel do Mercado Pago,
 * com o valor exato da proposta. Enquanto `paymentUrl` estiver vazio, o botão
 * cai no WhatsApp — a página nunca fica sem saída.
 */

export type Proposal = {
  slug: string;
  client: string;
  plan: string;
  /** Valor final cobrado, em reais. */
  price: number;
  /** Valor de tabela do mesmo plano, para mostrar o desconto. */
  listPrice: number;
  months: number;
  /** Por que esse cliente tem essa condição. Aparece na página. */
  discountReason?: string;
  items: string[];
  /** Último dia em que a condição vale (YYYY-MM-DD, horário de Brasília). */
  validUntil: string;
  paymentUrl?: string;
  /**
   * Parcelas sem juros no cartão, com o juro absorvido pelo PFC. Só preencha
   * se o Link de Pagamento foi criado assim — sem isso o Mercado Pago repassa
   * o juro ao cliente e a parcela mostrada aqui vira promessa falsa.
   */
  installmentsNoInterest?: number;
};

export const proposals: Proposal[] = [
  {
    slug: "real-consultoria-7k2m",
    client: "Real Consultoria em Imóveis",
    plan: "Apoio Anual",
    price: 2566,
    listPrice: 2851,
    months: 12,
    discountReason: "Condição de parceiro antigo: 10% sobre o anual.",
    items: [
      "Inserções pontuais da marca nos conteúdos do PFC",
      "Stories de divulgação no Instagram do podcast",
      "Link na descrição dos episódios",
      "Participação em ações específicas do PFC ao longo do ano",
      "Página própria no site do PFC, com QR rastreável e painel de contatos",
    ],
    validUntil: "2026-11-06",
    paymentUrl: "https://mpago.li/2tAGUym",
    installmentsNoInterest: 12,
  },
];

export function getProposal(slug: string): Proposal | undefined {
  return proposals.find((p) => p.slug === slug);
}

/** Vale até o fim do dia de `validUntil` em Brasília (UTC-3). */
export function isExpired(p: Proposal, now = new Date()): boolean {
  return now.getTime() > new Date(`${p.validUntil}T23:59:59-03:00`).getTime();
}
