/**
 * Propostas comerciais fechadas, uma por cliente, servidas em /proposta/[slug].
 *
 * O slug leva um sufixo aleatório de propósito: a página mostra condição
 * negociada (desconto de fidelidade, bônus) que não pode virar referência
 * pública da tabela. A rota fica fora do sitemap e bloqueada no robots.
 *
 * Teto de desconto (regra de 16/11/2026, lib/planos REGRAS_PRECO): descontos
 * não se somam e o LÍQUIDO recebido nunca fica mais de 25% abaixo da tabela
 * mensal × meses — conte a taxa do Mercado Pago que o PFC absorver. Condição
 * de parceiro antigo substitui o desconto do anual. A proposta da Real
 * Consultoria (44% abaixo) é anterior à regra e não é precedente.
 *
 * O pagamento é um Link de Pagamento criado à mão no painel do Mercado Pago,
 * com o valor exato da proposta. Enquanto `paymentUrl` estiver vazio, o botão
 * cai no WhatsApp — a página nunca fica sem saída.
 */

export type Proposal = {
  slug: string;
  client: string;
  plan: string;
  /** Título da página. Sem ele, sai "Plano {plan}" (cota de quadro não é plano). */
  headline?: string;
  /** Avulsos que o cliente pode somar depois. Não entram no valor nem no link. */
  addOns?: { name: string; price: number; note: string }[];
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
   *
   * Proposta com desconto é à vista por regra (lib/payment). Parcelar sem
   * juros em cima do desconto é exceção decidida caso a caso, com o líquido
   * conferido em `netReceived`.
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
  {
    // Lead do Monte seu plano em 17/11/2026: marcou verba de até R$ 500/mês,
    // quer exclusividade e montou Master + Cota Master + Visita (R$ 10.332).
    // Proposta enxuta: só a cota master do Papo, que já dá a exclusividade no
    // quadro. Preço de tabela, então 3x sem juros pela regra de lib/payment.
    slug: "f1-contabil-c0f8",
    client: "F1 Contábil",
    plan: "Cota Master do Papo Fora da Caixa",
    headline: "F1 Contábil apresenta o Papo Fora da Caixa",
    price: 2991,
    listPrice: 2991,
    months: 3,
    items: [
      "“Papo Fora da Caixa apresentado por F1 Contábil” na abertura e no encerramento",
      "Logo na vinheta, no cenário e na thumb dos episódios",
      "Menção do apresentador em todos os episódios do quadro",
      "Marca nos cortes e shorts do quadro",
      "QR code na tela e página exclusiva da F1 no site do PFC, com painel de contatos",
      "Exclusividade: nenhuma outra marca como master do quadro durante o contrato",
      "Relatório mensal de alcance e acessos ao QR",
    ],
    addOns: [
      {
        name: "PFC Visita",
        price: 1350,
        note: "Gravação no escritório ou no lançamento/evento da F1. Preço de cliente com cota ativa (avulso: R$ 1.690).",
      },
    ],
    validUntil: "2026-11-27",
    installmentsNoInterest: 3,
  },
];

export function getProposal(slug: string): Proposal | undefined {
  return proposals.find((p) => p.slug === slug);
}

/** Vale até o fim do dia de `validUntil` em Brasília (UTC-3). */
export function isExpired(p: Proposal, now = new Date()): boolean {
  return now.getTime() > new Date(`${p.validUntil}T23:59:59-03:00`).getTime();
}
