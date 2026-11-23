/**
 * Acabamento "PFC Cinematic": as regras do prompt que a equipe usava no GPT,
 * feitas como ajuste de tom e cor. A foto continua sendo a mesma fotografia.
 */

import type { Imagem } from "./faixas";

export type Ajustes = {
  /** Correção das faixas, de 0 a 200. Foto já tratada esconde parte da perda, por isso o padrão passa de 100. */
  faixas: number;
  /** -100 a 100. */
  exposicao: number;
  altas: number;
  /** -100 a 100. */
  sombras: number;
  contraste: number;
  cor: number;
  nitidez: number;
  profundidade: number;
};

export const AJUSTES_PADRAO: Ajustes = {
  faixas: 160,
  exposicao: 0,
  altas: 35,
  sombras: 10,
  contraste: 25,
  cor: 45,
  nitidez: 30,
  profundidade: 25,
};

/** Faixa de cada régua, usada na tela e para validar o ajuste salvo. */
export const LIMITES: Record<keyof Ajustes, [number, number]> = {
  faixas: [0, 200],
  exposicao: [-100, 100],
  altas: [0, 100],
  sombras: [-100, 100],
  contraste: [0, 100],
  cor: [0, 100],
  nitidez: [0, 100],
  profundidade: [0, 100],
};

export const SEM_TRATAMENTO: Omit<Ajustes, "faixas"> = {
  exposicao: 0,
  altas: 0,
  sombras: 0,
  contraste: 0,
  cor: 0,
  nitidez: 0,
  profundidade: 0,
};

const suave = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const paraLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
const paraSrgb = (l: number) => (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055);

const TAM_CURVA = 1024;

function curvaDeTom(a: Ajustes): Float32Array {
  const curva = new Float32Array(TAM_CURVA + 1);
  const ganho = Math.pow(2, (a.exposicao / 100) * 0.8);
  const k = (a.contraste / 100) * 0.35;
  for (let i = 0; i <= TAM_CURVA; i++) {
    let v = Math.min(1, paraSrgb(paraLinear(i / TAM_CURVA) * ganho));
    v -= (a.altas / 100) * 0.2 * suave(0.55, 1, v) * v;
    if (v < 0.5) {
      const t = v / 0.5;
      v += (a.sombras / 100) * 0.1 * t * (1 - t) * (1 - t) * 4;
    }
    v -= (k * Math.sin(2 * Math.PI * v)) / (2 * Math.PI);
    curva[i] = Math.max(0, Math.min(1, v));
  }
  return curva;
}

/** Tons de pele ficam de fora da cor do grade: nada de rosto azulado. */
function pesoPele(y: number, r: number, b: number): number {
  const cb = (b - y) * 0.564;
  const cr = (r - y) * 0.713;
  return suave(0.012, 0.045, cr) * (1 - suave(0.16, 0.24, cr)) * suave(-0.22, -0.13, cb) * (1 - suave(-0.008, 0.03, cb));
}

function desfocar(orig: Float32Array, w: number, h: number, raio: number): Float32Array {
  let atual = orig;
  const janela = raio * 2 + 1;
  for (let passe = 0; passe < 3; passe++) {
    const hor = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let soma = 0;
      const lin = y * w;
      for (let x = -raio; x <= raio; x++) soma += atual[lin + Math.max(0, Math.min(w - 1, x))];
      for (let x = 0; x < w; x++) {
        hor[lin + x] = soma / janela;
        soma += atual[lin + Math.min(w - 1, x + raio + 1)] - atual[lin + Math.max(0, x - raio)];
      }
    }
    const ver = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let soma = 0;
      for (let y = -raio; y <= raio; y++) soma += hor[Math.max(0, Math.min(h - 1, y)) * w + x];
      for (let y = 0; y < h; y++) {
        ver[y * w + x] = soma / janela;
        soma += hor[Math.min(h - 1, y + raio + 1) * w + x] - hor[Math.max(0, y - raio) * w + x];
      }
    }
    atual = ver;
  }
  return atual;
}

function aplicarNitidez(img: Imagem, quantidade: number): void {
  const { data, width: w, height: h } = img;
  const luz = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    luz[p] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  const raio = Math.max(1, Math.round(Math.max(w, h) / 1400));
  const base = desfocar(luz, w, h, raio);
  const forca = (quantidade / 100) * 1.1;
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    let d = luz[p] - base[p];
    const abs = Math.abs(d);
    // Abaixo do limiar é ruído; acima do teto viraria halo.
    d *= suave(0.004, 0.016, abs);
    d = Math.max(-0.06, Math.min(0.06, d));
    const pele = pesoPele(luz[p], data[i] / 255, data[i + 2] / 255);
    const soma = d * forca * (1 - 0.45 * pele) * 255;
    data[i] += soma;
    data[i + 1] += soma;
    data[i + 2] += soma;
  }
}

/** Aplica o acabamento na própria imagem. */
export function aplicarTratamento(img: Imagem, a: Ajustes): void {
  const { data, width: w, height: h } = img;
  const curva = curvaDeTom(a);
  const cor = a.cor / 100;
  const vinheta = (a.profundidade / 100) * 0.34;
  const cx = (w - 1) / 2 || 1;
  const cy = (h - 1) / 2 || 1;

  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / cy;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i] / 255;
      let g = data[i + 1] / 255;
      let b = data[i + 2] / 255;
      const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const pos = luz * TAM_CURVA;
      const base = Math.min(TAM_CURVA - 1, pos | 0);
      const nova = curva[base] + (curva[base + 1] - curva[base]) * (pos - base);

      if (luz > 0.02) {
        const razao = Math.min(3, nova / luz);
        r *= razao;
        g *= razao;
        b *= razao;
      } else {
        r += nova - luz;
        g += nova - luz;
        b += nova - luz;
      }

      if (cor > 0) {
        const fora = 1 - pesoPele(luz, r, b);
        const sombra = Math.pow(Math.max(0, 1 - nova / 0.42), 2) * fora * cor;
        const alta = suave(0.62, 1, nova) * fora * cor;
        r += -0.03 * sombra + 0.018 * alta;
        g += -0.008 * sombra + 0.006 * alta;
        b += 0.05 * sombra - 0.022 * alta;
      }

      if (vinheta > 0) {
        const dx = (x - cx) / cx;
        const fator = 1 - vinheta * suave(0.5, 1.9, dx * dx + dy * dy);
        r *= fator;
        g *= fator;
        b *= fator;
      }

      data[i] = r * 255 + 0.5;
      data[i + 1] = g * 255 + 0.5;
      data[i + 2] = b * 255 + 0.5;
    }
  }

  if (a.nitidez > 0) aplicarNitidez(img, a.nitidez);
}
