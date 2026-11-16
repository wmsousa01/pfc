/**
 * Planos de patrocínio do canal. Fonte única dos preços: a vitrine (Plans.tsx)
 * e o Monte seu plano (/monte-seu-plano) leem daqui.
 */

export type Plan = {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  highlighted: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
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
    savings: 4793,
    features: [
      "Exclusividade por segmento",
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
