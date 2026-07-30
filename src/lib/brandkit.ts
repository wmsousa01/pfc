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

function toRgb(hex: string): [number, number, number] {
  const c = hex.replace("#", "").slice(0, 6).padEnd(6, "0");
  return [
    parseInt(c.slice(0, 2), 16) || 0,
    parseInt(c.slice(2, 4), 16) || 0,
    parseInt(c.slice(4, 6), 16) || 0,
  ];
}

function toHex(r: number, g: number, b: number): string {
  const p = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${p(r)}${p(g)}${p(b)}`;
}

/** Luminância relativa (WCAG 2.1). */
export function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Decide texto preto/branco sobre uma cor de fundo escolhendo o MAIOR
 * contraste real (WCAG). Azuis saturados, por exemplo, parecem claros mas
 * pedem texto branco — a média ponderada simples errava nesses casos.
 */
export function readableOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#000000")
    ? "#ffffff"
    : "#000000";
}

/** Mistura duas cores. `amount` 0 = a, 1 = b. */
export function mix(a: string, b: string, amount: number): string {
  const [r1, g1, b1] = toRgb(a);
  const [r2, g2, b2] = toRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return toHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

/**
 * Versão da cor que passa contraste como TEXTO sobre um fundo. Clareia (fundo
 * escuro) ou escurece (fundo claro) até bater o alvo — evita o azul da marca
 * ficar ilegível em texto pequeno sobre o navy dela mesma.
 */
export function readableTone(color: string, bg: string, target = 4.5): string {
  const towardsLight = luminance(bg) < 0.5;
  let out = color;
  for (let i = 0; i < 12 && contrastRatio(out, bg) < target; i++) {
    out = towardsLight ? lighten(out, 0.08) : darken(out, 0.08);
  }
  return out;
}

/** Adiciona alpha a um hex (#RRGGBB + 'AA'). */
export function withAlpha(hex: string, alpha: string): string {
  const c = hex.replace("#", "").slice(0, 6);
  return `#${c}${alpha}`;
}

/**
 * Paleta derivada da marca do parceiro, calculada uma vez e usada pela página
 * e pelo formulário. Nasceu para não espalhar `withAlpha(...)` solto pelo JSX —
 * e para garantir contraste em qualquer combinação que o admin salvar.
 */
export type PartnerTheme = {
  primary: string;
  /** Texto sobre a cor primária (botões). */
  onPrimary: string;
  /** Primária clareada/escurecida até ser legível como texto sobre o fundo. */
  primaryText: string;
  secondary: string;
  bg: string;
  /** Fundo dos cards. */
  surface: string;
  surfaceStrong: string;
  border: string;
  borderStrong: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  radius: number;
  fontFamily: string;
  glow: boolean;
  heading: {
    fontWeight: number;
    letterSpacing: string;
    textTransform: "uppercase" | "none";
  };
};

export function buildPartnerTheme(input: {
  accent?: string | null;
  color_secondary?: string | null;
  color_bg?: string | null;
  style_preset?: string | null;
}): PartnerTheme {
  const primary = input.accent || brandDefaults.primary;
  const secondary = input.color_secondary || brandDefaults.secondary;
  const bg = input.color_bg || brandDefaults.bg;
  const preset = getPreset(input.style_preset);
  const fg = readableOn(bg);

  return {
    primary,
    onPrimary: readableOn(primary),
    primaryText: readableTone(primary, bg),
    secondary,
    bg,
    surface: withAlpha(fg, "08"),
    surfaceStrong: withAlpha(fg, "0f"),
    border: withAlpha(fg, "1a"),
    borderStrong: withAlpha(primary, "59"),
    fg,
    fgMuted: withAlpha(fg, "b3"),
    fgSubtle: withAlpha(fg, "70"),
    radius: preset.radius,
    fontFamily: preset.fontFamily,
    glow: preset.glow,
    heading: {
      fontWeight: preset.headingWeight,
      letterSpacing: preset.headingSpacing,
      textTransform: preset.headingTransform,
    },
  };
}
