/**
 * Planos de patrocínio do canal. Fonte única dos preços: a vitrine (Plans.tsx)
 * e o Monte seu plano (/monte-seu-plano) leem daqui.
 *
 * Regras de preço (benchmark de 16/11/2026, docs/precificacao.md):
 * - Tudo que é recorrente tem contrato mínimo de 3 meses — plano e cota.
 * - Anual: 20% off só no Pix à vista; no cartão em até 3x, 10% off. O PFC
 *   absorve ~11,4% de taxa no 3x, então o líquido dos dois fica igual.
 * - Descontos não se somam e o desconto efetivo nunca passa de 25% da tabela
 *   mensal (12 mensalidades). Condição de parceiro antigo SUBSTITUI o desconto
 *   do anual, não soma.
 * - Contrato de 6 meses ou mais ganha uma vantagem em mídia, não em dinheiro:
 *   a marca participa como convidada especialista em um episódio. Custa quase
 *   nada (o quadro precisa de convidado de qualquer jeito) e não entra no
 *   teto de desconto. Vale também no anual, para o de 12 meses nunca ter
 *   menos que o de 6.
 */

export const REGRAS_PRECO = {
  /** Contrato mínimo de qualquer item recorrente (plano ou cota). */
  minMeses: 3,
  /** Desconto do anual pago no Pix à vista, em %. */
  anualPixOff: 20,
  /** Desconto do anual no cartão em até 3x sem juros, em %. */
  anualCartaoOff: 10,
  /** Teto de desconto efetivo sobre a tabela mensal, somando tudo, em %. */
  tetoDescontoPercent: 25,
  /** A partir de quantos meses de contrato entra a vantagem. */
  vantagemMeses: 6,
  /** Nome curto da vantagem, para chip e linha de orçamento. */
  vantagem: "Sua marca como convidada em 1 episódio",
  /** Texto completo, com a condição de agenda. */
  vantagemDetalhe:
    "Um representante da marca participa como convidado especialista em um episódio do quadro que combina com o seu segmento, com data combinada com a produção dentro do contrato.",
} as const;

export type Plan = {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  highlighted: boolean;
  monthlyPrice: number;
  /** Anual no Pix à vista (20% off). */
  yearlyPrice: number;
  /** Anual no cartão em até 3x sem juros (10% off). */
  yearlyCardPrice: number;
  /** Economia do anual no Pix contra 12 mensalidades. */
  savings: number;
  features: string[];
  ctaLabel: string;
  ctaUrl: string;
};

export const plans: Plan[] = [
  {
    id: "apoio",
    name: "Apoio",
    tagline: "Ideal para marcas que querem começar.",
    highlighted: false,
    monthlyPrice: 297,
    yearlyPrice: 2851,
    yearlyCardPrice: 3208,
    savings: 713,
    features: [
      "Inserções pontuais",
      "Stories de divulgação",
      "Link na descrição",
      "Participação em ações específicas",
    ],
    ctaLabel: "Quero o Plano Apoio",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Apoio%20do%20PFC",
  },
  {
    id: "patrocinador",
    name: "Patrocinador",
    badge: "Mais escolhido",
    tagline: "Ideal para presença recorrente.",
    highlighted: true,
    monthlyPrice: 797,
    yearlyPrice: 7651,
    yearlyCardPrice: 8608,
    savings: 1913,
    features: [
      "Logo no estúdio",
      "Menção nos episódios",
      "Presença em cortes",
      "Stories com CTA",
      "Link na descrição",
      "Possibilidade de collab",
    ],
    ctaLabel: "Quero ser Patrocinador",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Patrocinador%20do%20PFC",
  },
  {
    id: "master",
    name: "Master",
    tagline: "Ideal para máxima presença e exclusividade.",
    highlighted: false,
    monthlyPrice: 1997,
    yearlyPrice: 19171,
    yearlyCardPrice: 21568,
    savings: 4793,
    features: [
      "Exclusividade por segmento, também nas cotas dos quadros",
      "Presença em todos os episódios",
      "Destaque no estúdio",
      "Menções ao vivo",
      "Conteúdos especiais",
      "Episódio temático",
      "Prioridade na agenda do PFC Visita",
      "Relatório de resultados",
    ],
    ctaLabel: "Quero ser Master",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Master%20do%20PFC",
  },
];

export const planById = (id: string) => plans.find((p) => p.id === id);

/** Desconto efetivo (%) de um valor sobre 12 mensalidades (ou `meses`) de tabela. */
export function descontoEfetivo(planId: string, valorRecebido: number, meses = 12): number {
  const p = planById(planId);
  if (!p) return 0;
  return (1 - valorRecebido / (p.monthlyPrice * meses)) * 100;
}
