/** Utilidades de dinheiro. Regra do projeto: tudo trafega em CENTAVOS. */

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 7990 → "R$ 79,90" */
export function brl(cents: number): string {
  return BRL.format((cents ?? 0) / 100);
}

/**
 * Converte um valor digitado ("79,90", "79.90", "R$ 79,90") em centavos.
 * Retorna 0 quando não dá para interpretar.
 */
export function toCents(input: string | number | null | undefined): number {
  if (typeof input === "number") return Math.round(input * 100);
  const raw = String(input ?? "").trim();
  if (!raw) return 0;

  // Mantém apenas dígitos e separadores; assume vírgula como decimal (pt-BR).
  const cleaned = raw.replace(/[^\d,.-]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/** 7990 → "79,90" (para preencher inputs de edição). */
export function centsToInput(cents: number): string {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}
