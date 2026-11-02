/**
 * Identidade visual de cada quadro nas thumbs dos cortes: cor da 2ª linha da
 * headline (e do brilho dela), contorno de luz nas pessoas, selo com o nome,
 * luz do estúdio gerado pelo Gemini e logo próprio (opcional, em Configurar).
 *
 * `episodes`/`cuts` são os títulos das playlists do canal: a live fica na de
 * episódios, e é por ela que o quadro de cada corte é descoberto.
 */
export type QuadroId = "fora-da-caixa" | "lado-a-lado-b" | "pfc-news" | "pfc-visita" | "tateios-escolares";

export type QuadroTheme = {
  id: QuadroId;
  name: string;
  episodes: string;
  cuts: string;
  /** Degradê da 2ª linha, de cima para baixo. */
  accent: [string, string, string];
  /** Com isto, a 2ª linha divide na horizontal (esquerda × direita) em vez do degradê vertical. */
  split?: [string, string];
  /** Cor do volume 3D da 2ª linha (a 1ª é sempre grafite). */
  stroke: string;
  glow: string;
  /** Headline inclinada, como nas thumbs do PFC News. */
  italic?: boolean;
  /** Contorno de luz atrás das pessoas recortadas. */
  rim: string;
  /** Selo: com `bg2`, o fundo é um degradê (Lado A × Lado B). */
  selo: { bg: string; bg2?: string; text: string };
  /** Trecho do prompt do fundo que define a iluminação. */
  light: string;
};

export const QUADROS: Record<QuadroId, QuadroTheme> = {
  "fora-da-caixa": {
    id: "fora-da-caixa",
    name: "Fora da Caixa",
    episodes: "Fora da Caixa",
    cuts: "Cortes Fora da Caixa",
    accent: ["#ffe27a", "#ffb300", "#d97a00"],
    stroke: "#2a1500",
    glow: "#ffa600",
    rim: "#ffa31a",
    selo: { bg: "#ffb300", text: "#111111" },
    light:
      "tall vertical warm amber light strips near the left and right edges, soft electric-blue and cyan bokeh reflections in the middle distance",
  },
  "lado-a-lado-b": {
    id: "lado-a-lado-b",
    name: "Lado A Lado B",
    episodes: "Lado A Lado B",
    cuts: "Cortes Lado A Lado B",
    // Logo: disco azul-marinho (#051a2d) × laranja (#f7941d). A headline vai no
    // laranja; o marinho fica no selo e na luz do fundo.
    accent: ["#ffc06a", "#f7941d", "#e66d01"],
    stroke: "#04121f",
    glow: "#f7941d",
    rim: "#ff8a1c",
    selo: { bg: "#0b2a48", bg2: "#f7941d", text: "#ffffff" },
    light:
      "a tall vertical deep navy-blue light strip near the left edge and a tall vertical warm orange light strip near the right edge, navy-blue bokeh on the left half and orange bokeh on the right half",
  },
  "pfc-news": {
    id: "pfc-news",
    name: "PFC News",
    episodes: "PFC News",
    cuts: "Cortes PFC News",
    // Logo: quadrado amarelo→laranja (#fcc43e → #fd9429) com microfone e letras pretas.
    accent: ["#ffe08a", "#fcc43e", "#fd9429"],
    stroke: "#111111",
    glow: "#fcb030",
    rim: "#ffc43e",
    selo: { bg: "#fcc43e", text: "#111111" },
    italic: true,
    light:
      "a broadcast newsroom look: cool white key light, thin horizontal amber-yellow LED accent lines, out-of-focus news screens glowing amber and white in the background",
  },
  "pfc-visita": {
    id: "pfc-visita",
    name: "PFC Visita",
    episodes: "PFC Visita",
    cuts: "Cortes PFC Visita",
    accent: ["#a7f3c0", "#22c55e", "#15803d"],
    stroke: "#00220d",
    glow: "#22c55e",
    rim: "#4ade80",
    selo: { bg: "#22c55e", text: "#06210f" },
    light: "warm natural ambient light with tall vertical emerald-green accent light strips and soft green bokeh",
  },
  "tateios-escolares": {
    id: "tateios-escolares",
    name: "Tateios Escolares",
    episodes: "Tateios Escolares",
    cuts: "Cortes Tateios Escolares",
    accent: ["#d6f1ff", "#38bdf8", "#0284c7"],
    stroke: "#001a2a",
    glow: "#38bdf8",
    rim: "#7dd3fc",
    selo: { bg: "#38bdf8", text: "#04202e" },
    light: "bright sky-blue accent light strips and soft cyan bokeh, a lighter and friendlier mood",
  },
};

export const QUADRO_IDS = Object.keys(QUADROS) as QuadroId[];
/** Corte sem quadro identificado sai com a identidade do PFC. */
export const DEFAULT_QUADRO: QuadroId = "fora-da-caixa";

export function isQuadroId(v: string | null | undefined): v is QuadroId {
  return !!v && v in QUADROS;
}

export function themeOf(v: string | null | undefined): QuadroTheme {
  return QUADROS[isQuadroId(v) ? v : DEFAULT_QUADRO];
}

/** Logo próprio do quadro no Storage; sem ele, vale o logo do PFC. */
export const quadroLogoPath = (id: QuadroId) => `config/logo-${id}.png`;
