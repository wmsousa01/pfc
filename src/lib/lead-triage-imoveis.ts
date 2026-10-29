/**
 * Triagem de leads para imobiliária de alto padrão (content.triage.kind =
 * "imoveis"). Módulo PURO, como o lead-triage: o formulário monta as
 * perguntas daqui e a server action pontua com as mesmas regras.
 *
 * O FILTRO: quem procura (ou quer vender) imóvel abaixo do piso não vira
 * lead — o formulário para nessa pergunta e explica, sem levar ao WhatsApp
 * do corretor. É o que poupa o tempo dele, que só atende a partir do piso.
 *
 * Gravação: reaproveita as colunas de `partner_leads` (need = intenção,
 * business_type = tipo de imóvel, mode = faixa de valor, timeframe = prazo)
 * e guarda o resto em `answers` com `kind: "imoveis"` — é o que o painel usa
 * para mostrar os rótulos certos.
 */

import type { LeadTemperature, PartnerLead } from "./types";
import type { TriageOption } from "./lead-triage";

export type ImovelOption = TriageOption & {
  /** Escolher esta opção encerra a triagem com esta mensagem (fora do perfil). */
  stop?: string;
};

export const MIN_PRICE_LABEL = "R$ 500 mil";

export const INTENTS: ImovelOption[] = [
  { value: "comprar", label: "Comprar", hint: "Para morar" },
  { value: "investir", label: "Investir", hint: "Renda ou valorização" },
  { value: "vender", label: "Vender", hint: "Quero anunciar o meu" },
];

export const PROPERTY_TYPES: ImovelOption[] = [
  { value: "casa_condominio", label: "Casa em condomínio" },
  { value: "casa", label: "Casa de rua" },
  { value: "apartamento", label: "Apartamento" },
  { value: "chacara", label: "Chácara ou sítio" },
  { value: "terreno", label: "Terreno ou lote" },
  { value: "comercial", label: "Imóvel comercial" },
];

const OUT_OF_PROFILE = `A Real Consultoria trabalha com imóveis a partir de ${MIN_PRICE_LABEL}. Para valores abaixo disso, ela não é a melhor indicação — mas obrigado pelo interesse!`;

export const PRICE_RANGES: ImovelOption[] = [
  { value: "500k_1mi", label: "R$ 500 mil a 1 milhão" },
  { value: "1mi_2mi", label: "R$ 1 a 2 milhões" },
  { value: "2mi_mais", label: "Acima de R$ 2 milhões" },
  { value: "ate_500k", label: `Até ${MIN_PRICE_LABEL}`, stop: OUT_OF_PROFILE },
];

export const PAYMENTS: ImovelOption[] = [
  { value: "a_vista", label: "À vista", hint: "Recurso disponível" },
  { value: "financiamento_aprovado", label: "Financiamento aprovado", hint: "Crédito já liberado" },
  { value: "permuta", label: "Permuta", hint: "Dou um imóvel na troca" },
  { value: "vou_financiar", label: "Vou financiar", hint: "Ainda vou aprovar" },
];

export const TIMEFRAMES: ImovelOption[] = [
  { value: "30d", label: "Nos próximos 30 dias" },
  { value: "3m", label: "Em até 3 meses" },
  { value: "6m", label: "Em até 6 meses" },
  { value: "pesquisando", label: "Só pesquisando" },
];

const SETS = {
  need: INTENTS,
  business_type: PROPERTY_TYPES,
  mode: PRICE_RANGES,
  payment: PAYMENTS,
  timeframe: TIMEFRAMES,
} as const;

export function imovelLabel(field: keyof typeof SETS, value: string | null | undefined): string {
  if (!value) return "—";
  return SETS[field].find((o) => o.value === value)?.label ?? value;
}

export type ImovelStep = {
  key: "need" | "business_type" | "mode" | "payment" | "timeframe" | "contato";
  question: string;
  helper?: string;
  options?: ImovelOption[];
  stacked?: boolean;
};

/** Perguntas na ordem; quem vende não responde forma de pagamento. */
export function imovelSteps(intent: string, partnerName: string): ImovelStep[] {
  const selling = intent === "vender";
  const steps: ImovelStep[] = [
    { key: "need", question: "O que você quer fazer?", options: INTENTS },
    {
      key: "business_type",
      question: selling ? "Que imóvel você quer vender?" : "Que tipo de imóvel você procura?",
      options: PROPERTY_TYPES,
      stacked: true,
    },
    {
      key: "mode",
      question: selling ? "Quanto vale o seu imóvel, mais ou menos?" : "Qual a faixa de valor?",
      helper: "Uma faixa aproximada já ajuda a separar as opções certas.",
      options: PRICE_RANGES,
      stacked: true,
    },
  ];
  if (!selling) {
    steps.push({
      key: "payment",
      question: "Como pretende pagar?",
      helper: "Isso define quais imóveis fazem sentido mostrar primeiro.",
      options: PAYMENTS,
    });
  }
  steps.push(
    {
      key: "timeframe",
      question: selling ? "Para quando quer vender?" : "Para quando você pretende fechar?",
      options: TIMEFRAMES,
      stacked: true,
    },
    {
      key: "contato",
      question: selling ? "Para onde a avaliação deve ir?" : "Para onde mandamos as opções?",
      helper: `A ${partnerName} recebe tudo o que você respondeu junto com seu contato.`,
    }
  );
  return steps;
}

export type ImovelAnswers = {
  name: string;
  whatsapp: string;
  need: string;
  business_type: string;
  mode: string;
  payment: string;
  timeframe: string;
  city: string;
  note: string;
};

export function isOutOfProfile(a: Pick<ImovelAnswers, "mode">): boolean {
  return PRICE_RANGES.find((o) => o.value === a.mode)?.stop !== undefined;
}

const TIMEFRAME_POINTS: Record<string, number> = { "30d": 35, "3m": 25, "6m": 14, pesquisando: 3 };
const PAYMENT_POINTS: Record<string, number> = {
  a_vista: 25,
  financiamento_aprovado: 22,
  permuta: 14,
  vou_financiar: 8,
};
const PRICE_POINTS: Record<string, number> = { "500k_1mi": 10, "1mi_2mi": 15, "2mi_mais": 18 };

/**
 * Do ponto de vista do corretor: prazo curto e dinheiro disponível separam
 * quem compra de quem sonha. Vendedor pontua pelo valor e pelo prazo — imóvel
 * de alto padrão para captar também é negócio.
 */
export function scoreImovelLead(a: ImovelAnswers): {
  score: number;
  temperature: LeadTemperature;
  reasons: string[];
} {
  if (isOutOfProfile(a)) {
    return { score: 0, temperature: "frio", reasons: [`Abaixo de ${MIN_PRICE_LABEL}`] };
  }
  const reasons: string[] = [];
  let score = 0;

  score += TIMEFRAME_POINTS[a.timeframe] ?? 0;
  if (a.timeframe === "30d") reasons.push("Quer fechar em 30 dias");
  else if (a.timeframe === "pesquisando") reasons.push("Ainda pesquisando");

  score += PRICE_POINTS[a.mode] ?? 0;

  if (a.need === "vender") {
    score += 22;
    reasons.push(`Imóvel para captar (${imovelLabel("mode", a.mode)})`);
  } else {
    score += PAYMENT_POINTS[a.payment] ?? 0;
    if (a.payment === "a_vista") reasons.push("Compra à vista");
    if (a.payment === "financiamento_aprovado") reasons.push("Crédito aprovado");
    if (a.payment === "permuta") reasons.push("Oferece permuta");
  }

  if (a.business_type) score += 6;
  if (a.city.trim()) score += 6;
  if (a.note.trim().length > 15) {
    score += 6;
    reasons.push("Descreveu o que procura");
  }

  score = Math.max(0, Math.min(100, score));
  const temperature: LeadTemperature = score >= 70 ? "quente" : score >= 45 ? "morno" : "frio";
  return { score, temperature, reasons };
}

const TEMP_TAG: Record<LeadTemperature, string> = {
  quente: "🔥 Quente",
  morno: "🌤 Morno",
  frio: "❄ Frio",
};

/** De onde veio: só vale citar quando é o QR de um imóvel específico. */
function propertyFromSource(source: string | null | undefined): string | null {
  if (!source || /^(qr|direct|ig|site)$/i.test(source)) return null;
  return source.replace(/[-_]+/g, " ");
}

/** Mensagem que já chega escrita no WhatsApp do corretor. */
export function buildImovelBrief(
  a: ImovelAnswers,
  result: { temperature: LeadTemperature },
  partnerName: string,
  brand: string,
  source?: string | null
): string {
  const selling = a.need === "vender";
  const lines = [
    `Olá, ${partnerName}! Vim pela página de vocês no ${brand}.`,
    "",
    `*Nome:* ${a.name}`,
    `*Quero:* ${imovelLabel("need", a.need)}`,
    `*Imóvel:* ${imovelLabel("business_type", a.business_type)}`,
    `*${selling ? "Valor estimado" : "Faixa"}:* ${imovelLabel("mode", a.mode)}`,
  ];
  if (!selling) lines.push(`*Pagamento:* ${imovelLabel("payment", a.payment)}`);
  lines.push(`*Prazo:* ${imovelLabel("timeframe", a.timeframe)}`);
  if (a.city.trim()) lines.push(`*Região:* ${a.city.trim()}`);
  const from = propertyFromSource(source);
  if (from) lines.push(`*Vi o imóvel:* ${from}`);
  if (a.note.trim()) lines.push(`*Observação:* ${a.note.trim()}`);
  lines.push("", `_Lead ${TEMP_TAG[result.temperature]} · via ${brand}_`);
  return lines.join("\n");
}

/** Etiquetas do lead no painel do parceiro e no admin. */
export function imovelLeadChips(l: PartnerLead): string[] {
  const payment = typeof l.answers?.payment === "string" ? l.answers.payment : "";
  return [
    imovelLabel("need", l.need),
    imovelLabel("business_type", l.business_type),
    imovelLabel("mode", l.mode),
    payment ? imovelLabel("payment", payment) : null,
    imovelLabel("timeframe", l.timeframe),
  ].filter((x): x is string => Boolean(x) && x !== "—");
}

export function isImovelLead(l: PartnerLead): boolean {
  return l.answers?.kind === "imoveis";
}
