/** Formatos de publicação e a conta do recorte, sem esticar nem inventar borda. */

export type Formato = "4:5" | "1:1" | "9:16" | "16:9" | "original";
export type Qualidade = "instagram" | "alta";

export type Enquadro = {
  formato: Formato;
  /** 1 é o maior recorte possível. */
  zoom: number;
  /** Posição do recorte dentro da foto, de 0 a 1. */
  x: number;
  y: number;
};

export const ENQUADRO_PADRAO: Enquadro = { formato: "4:5", zoom: 1, x: 0.5, y: 0.35 };

export const FORMATOS: { id: Formato; label: string; uso: string; razao: number | null; largura: number }[] = [
  { id: "4:5", label: "4:5", uso: "Feed", razao: 4 / 5, largura: 1080 },
  { id: "1:1", label: "1:1", uso: "Quadrado", razao: 1, largura: 1080 },
  { id: "9:16", label: "9:16", uso: "Stories", razao: 9 / 16, largura: 1080 },
  { id: "16:9", label: "16:9", uso: "YouTube", razao: 16 / 9, largura: 1920 },
  { id: "original", label: "Original", uso: "Sem corte", razao: null, largura: 2160 },
];

export type Recorte = { sx: number; sy: number; sw: number; sh: number };

export function calcularRecorte(w: number, h: number, e: Enquadro): Recorte {
  const razao = FORMATOS.find((f) => f.id === e.formato)?.razao ?? w / h;
  let sw = w;
  let sh = w / razao;
  if (sh > h) {
    sh = h;
    sw = h * razao;
  }
  const zoom = Math.max(1, e.zoom);
  sw /= zoom;
  sh /= zoom;
  return { sx: (w - sw) * e.x, sy: (h - sh) * e.y, sw, sh };
}

/** Tamanho final. Nunca amplia além do que a foto tem de verdade. */
export function tamanhoFinal(r: Recorte, formato: Formato, qualidade: Qualidade): { width: number; height: number } {
  const base = FORMATOS.find((f) => f.id === formato)?.largura ?? 1080;
  const alvo = qualidade === "alta" ? (formato === "original" ? r.sw : base * 2) : base;
  const escala = Math.min(1, alvo / r.sw);
  return { width: Math.round(r.sw * escala), height: Math.round(r.sh * escala) };
}
