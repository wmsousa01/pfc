/**
 * Kit de marca do parceiro: presets de estilo visual (o "tom de voz" da marca
 * refletido em tipografia, cantos e sombra) + helpers de paleta.
 * Sem dependências de servidor — usado no form (client) e na página (server).
 */

export type StylePreset = {
  key: string;
  label: string;
  description: string;
  /** Stack de fontes self-contained (sem fontes externas). */
  fontFamily: string;
  /** Raio de borda de cards/botões, em px. */
  radius: number;
  headingWeight: number;
  headingSpacing: string; // letter-spacing
  headingTransform: "uppercase" | "none";
  /** Usa sombra/brilho colorido com a cor primária. */
  glow: boolean;
};

export const stylePresets: StylePreset[] = [
  {
    key: "moderno",
    label: "Moderno",
    description: "Sans clean, cantos arredondados, sombra suave.",
    fontFamily:
      "var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
    radius: 16,
    headingWeight: 800,
    headingSpacing: "-0.02em",
    headingTransform: "none",
    glow: false,
  },
  {
    key: "elegante",
    label: "Elegante",
    description: "Serifada, cantos discretos, ar sofisticado.",
    fontFamily: "Georgia, 'Times New Roman', 'Playfair Display', serif",
    radius: 4,
    headingWeight: 700,
    headingSpacing: "0em",
    headingTransform: "none",
    glow: false,
  },
  {
    key: "vibrante",
    label: "Vibrante",
    description: "Arredondada, cantos generosos, brilho colorido.",
    fontFamily:
      "'Trebuchet MS', 'Segoe UI', ui-rounded, system-ui, sans-serif",
    radius: 28,
    headingWeight: 900,
    headingSpacing: "-0.01em",
    headingTransform: "none",
    glow: true,
  },
  {
    key: "minimalista",
    label: "Minimalista",
    description: "Leve, títulos em caixa alta espaçada, sem sombra.",
    fontFamily:
      "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif",
    radius: 10,
    headingWeight: 600,
    headingSpacing: "0.12em",
    headingTransform: "uppercase",
    glow: false,
  },
  {
    key: "corporativo",
    label: "Corporativo",
    description: "Sóbrio e confiável, cantos retos, visual limpo.",
    fontFamily: "Arial, Helvetica, 'Segoe UI', sans-serif",
    radius: 6,
    headingWeight: 700,
    headingSpacing: "0em",
    headingTransform: "none",
    glow: false,
  },
];

export function getPreset(key: string | null | undefined): StylePreset {
  return stylePresets.find((p) => p.key === key) ?? stylePresets[0];
}

export const brandDefaults = {
  primary: "#FFD700",
  secondary: "#1a1a1a",
  bg: "#0a0a0a",
  preset: "moderno",
};

/** Decide texto preto/branco sobre uma cor de fundo (contraste). */
export function readableOn(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length < 6) return "#000000";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
}

/** Adiciona alpha a um hex (#RRGGBB + 'AA'). */
export function withAlpha(hex: string, alpha: string): string {
  const c = hex.replace("#", "").slice(0, 6);
  return `#${c}${alpha}`;
}
