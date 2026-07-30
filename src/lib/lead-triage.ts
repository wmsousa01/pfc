/**
 * Triagem de leads da página do parceiro.
 *
 * Módulo PURO (sem server-only): o formulário usa para montar as perguntas e a
 * server action usa para pontuar. Se um dia a triagem migrar para um bot de
 * WhatsApp, ele produz o mesmo `TriageAnswers` e reaproveita `scoreLead`.
 */

import type { LeadTemperature, PartnerTriage } from "./types";

export type TriageOption = {
  value: string;
  label: string;
  /** Texto curto de apoio embaixo da opção. */
  hint?: string;
};

/** Respostas cruas da triagem — a fonte para pontuar e para o briefing. */
export type TriageAnswers = {
  name: string;
  whatsapp: string;
  business_type: string;
  need: string;
  mode: string;
  quantity: number | null;
  timeframe: string;
  city: string;
  note: string;
};

/** Tipos de negócio padrão (cliente típico de refrigeração comercial). */
export const BUSINESS_TYPES: TriageOption[] = [
  { value: "bar", label: "Bar / Boteco" },
  { value: "restaurante", label: "Restaurante / Lanchonete" },
  { value: "mercado", label: "Mercado / Mercearia" },
  { value: "acougue", label: "Açougue / Peixaria" },
  { value: "sorveteria", label: "Sorveteria / Açaí" },
  { value: "adega", label: "Adega / Conveniência" },
  { value: "padaria", label: "Padaria / Cafeteria" },
  { value: "distribuidora", label: "Distribuidora de bebidas" },
  { value: "evento", label: "Evento / Festa" },
  { value: "outro", label: "Outro negócio" },
];

/**
 * Quem compra/aluga com recorrência. Fora dessa lista o lead ainda entra,
 * só pontua menos. Pode ser sobrescrito por parceiro em `content.triage`.
 */
export const DEFAULT_IDEAL_BUSINESS_TYPES = [
  "bar",
  "restaurante",
  "mercado",
  "acougue",
  "sorveteria",
  "adega",
  "padaria",
  "distribuidora",
];

export const NEEDS: TriageOption[] = [
  { value: "freezer", label: "Freezer", hint: "Horizontal, congelados" },
  { value: "geladeira", label: "Geladeira", hint: "Expositor vertical" },
  { value: "cervejeira", label: "Cervejeira", hint: "Bebida sempre gelada" },
  { value: "nao_sei", label: "Ainda não sei", hint: "Quero uma orientação" },
];

export const MODES: TriageOption[] = [
  { value: "locacao", label: "Alugar", hint: "Sem travar capital" },
  { value: "compra", label: "Comprar", hint: "Novo ou seminovo" },
  { value: "indiferente", label: "Tanto faz", hint: "Quero comparar" },
];

export const TIMEFRAMES: TriageOption[] = [
  { value: "imediato", label: "Para ontem", hint: "Preciso agora" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mês" },
  { value: "pesquisando", label: "Só pesquisando" },
];

export const QUANTITIES: TriageOption[] = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3 ou mais" },
];

const OPTION_SETS: Record<string, TriageOption[]> = {
  business_type: BUSINESS_TYPES,
  need: NEEDS,
  mode: MODES,
  timeframe: TIMEFRAMES,
};

/** Rótulo legível de um valor de triagem (usado no admin e no painel). */
export function labelFor(field: keyof typeof OPTION_SETS, value: string | null): string {
  if (!value) return "—";
  return OPTION_SETS[field]?.find((o) => o.value === value)?.label ?? value;
}

/** Tipos de negócio a exibir, considerando o override do parceiro. */
export function businessTypesFor(triage: PartnerTriage | undefined): TriageOption[] {
  const custom = triage?.business_types;
  if (!custom?.length) return BUSINESS_TYPES;
  return custom.map((label) => ({ value: slugValue(label), label }));
}

function slugValue(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export type LeadScore = {
  /** 0 a 100. */
  score: number;
  temperature: LeadTemperature;
  /** Motivos legíveis — vão no briefing que o parceiro recebe. */
  reasons: string[];
};

const TIMEFRAME_POINTS: Record<string, number> = {
  imediato: 40,
  semana: 30,
  mes: 18,
  pesquisando: 4,
};

const MODE_POINTS: Record<string, number> = {
  locacao: 10,
  compra: 8,
  indiferente: 5,
};

/**
 * Pontua o lead do ponto de vista do PARCEIRO: quem está perto de fechar,
 * sabe o que quer e é o tipo de negócio que ele atende vale mais.
 * Peso maior para PRAZO — é o que mais separa comprador de curioso.
 */
export function scoreLead(
  answers: TriageAnswers,
  triage?: PartnerTriage
): LeadScore {
  const reasons: string[] = [];
  let score = 0;

  score += TIMEFRAME_POINTS[answers.timeframe] ?? 0;
  if (answers.timeframe === "imediato") reasons.push("Precisa agora");
  else if (answers.timeframe === "semana") reasons.push("Precisa esta semana");
  else if (answers.timeframe === "pesquisando") reasons.push("Ainda pesquisando");

  if (answers.need && answers.need !== "nao_sei") {
    score += 20;
    reasons.push(`Já sabe o equipamento (${labelFor("need", answers.need)})`);
  } else {
    score += 8;
    reasons.push("Precisa de orientação para escolher");
  }

  const ideal = triage?.ideal_business_types ?? DEFAULT_IDEAL_BUSINESS_TYPES;
  if (answers.business_type && ideal.includes(answers.business_type)) {
    score += 15;
    reasons.push(`Cliente ideal (${labelFor("business_type", answers.business_type)})`);
  } else if (answers.business_type) {
    score += 5;
  }

  const qty = answers.quantity ?? 0;
  if (qty >= 3) {
    score += 15;
    reasons.push("Quer 3 ou mais equipamentos");
  } else if (qty === 2) {
    score += 10;
  } else if (qty === 1) {
    score += 7;
  }

  score += MODE_POINTS[answers.mode] ?? 0;
  if (answers.mode === "locacao") reasons.push("Quer alugar (receita recorrente)");

  if (answers.city.trim()) score += 5;
  if (answers.note.trim().length > 15) {
    score += 5;
    reasons.push("Descreveu a necessidade");
  }

  score = Math.max(0, Math.min(100, score));

  const temperature: LeadTemperature =
    score >= 70 ? "quente" : score >= 45 ? "morno" : "frio";

  return { score, temperature, reasons };
}

export const TEMPERATURE_LABEL: Record<LeadTemperature, string> = {
  quente: "🔥 Quente",
  morno: "🌤 Morno",
  frio: "❄ Frio",
};

/**
 * Briefing que o parceiro recebe no WhatsApp. É o coração da entrega:
 * ele não recebe um "oi", recebe o lead já qualificado e pronto para orçar.
 */
export function buildLeadBrief(
  answers: TriageAnswers,
  result: LeadScore,
  partnerName: string,
  brand: string
): string {
  const lines = [
    `Olá, ${partnerName}! Vim pela página de vocês no ${brand}.`,
    "",
    `*Nome:* ${answers.name}`,
    `*Negócio:* ${labelFor("business_type", answers.business_type)}`,
    `*Preciso de:* ${labelFor("need", answers.need)}${
      answers.quantity ? ` (${answers.quantity}${answers.quantity >= 3 ? "+" : ""})` : ""
    }`,
    `*Quero:* ${labelFor("mode", answers.mode)}`,
    `*Prazo:* ${labelFor("timeframe", answers.timeframe)}`,
  ];

  if (answers.city.trim()) lines.push(`*Onde:* ${answers.city.trim()}`);
  if (answers.note.trim()) lines.push(`*Observação:* ${answers.note.trim()}`);

  lines.push("", `_Lead ${TEMPERATURE_LABEL[result.temperature]} · via ${brand}_`);

  return lines.join("\n");
}

/** Normaliza WhatsApp para dígitos com DDI 55. Retorna null se inválido. */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}
