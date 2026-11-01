import "server-only";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import opentype from "opentype.js";
import type { Matte } from "./matte";
import type { QuadroTheme } from "./quadros";
import type { Headline } from "./store";

const W = 1280;
const H = 720;
const LOGO_W = 150;

let font: opentype.Font | null = null;
function anton(): opentype.Font {
  // Anton (SIL OFL 1.1) — assets/fonts/OFL.txt. Vetorizada aqui, então não
  // depende de fonte instalada no servidor.
  font ??= opentype.loadSync(path.join(process.cwd(), "assets/fonts/Anton-Regular.ttf"));
  return font;
}

/** Maior tamanho de fonte (até `max`) em que o texto cabe em `maxW`. */
function fit(text: string, maxW: number, max: number) {
  const f = anton();
  let size = max;
  while (size > 24 && f.getAdvanceWidth(text, size) > maxW) size -= 2;
  return { size, width: f.getAdvanceWidth(text, size) };
}

/** "#ffb300" → "1 0.702 0" (canais 0–1 para a matriz de cor do SVG). */
function rgb01(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => (c / 255).toFixed(3)).join(" ");
}

function headlineSvg(h: Headline, t: QuadroTheme): string {
  const [r, g, b] = rgb01(t.glow).split(" ");
  const f = anton();
  const f1 = fit(h.l1, 1160, 118);
  const f2 = fit(h.l2, 1180, 150);
  const base2 = H - 34;
  const base1 = base2 - f2.size * 0.98;
  const p1 = f.getPath(h.l1, (W - f1.width) / 2, base1, f1.size).toPathData(2);
  const p2 = f.getPath(h.l2, (W - f2.width) / 2, base2, f2.size).toPathData(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs>
  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.44" stop-color="#03060f" stop-opacity="0"/>
    <stop offset="0.60" stop-color="#03060f" stop-opacity="0.92"/>
    <stop offset="1" stop-color="#000000" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#f3ece2"/><stop offset="1" stop-color="#bdb5aa"/>
  </linearGradient>
  ${
    t.split
      ? `<linearGradient id="accent" gradientUnits="userSpaceOnUse" x1="${(W - f2.width) / 2}" y1="0" x2="${(W + f2.width) / 2}" y2="0">
    <stop offset="0.46" stop-color="${t.split[0]}"/><stop offset="0.54" stop-color="${t.split[1]}"/>
  </linearGradient>`
      : `<linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.accent[0]}"/><stop offset="0.5" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.accent[2]}"/>
  </linearGradient>`
  }
  <filter id="shadow" x="-10%" y="-20%" width="120%" height="160%">
    <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.9"/>
  </filter>
  <filter id="glow" x="-10%" y="-30%" width="120%" height="180%">
    <feGaussianBlur stdDeviation="10" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 0.55 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#band)"/>
<g filter="url(#shadow)"><path d="${p1}" fill="url(#silver)" stroke="#0b0b0b" stroke-width="5" paint-order="stroke" stroke-linejoin="round"/></g>
<g filter="url(#glow)"><g filter="url(#shadow)"><path d="${p2}" fill="url(#accent)" stroke="${t.stroke}" stroke-width="6" paint-order="stroke" stroke-linejoin="round"/></g></g>
</svg>`;
}

/** Selo com o nome do quadro, no canto superior esquerdo (o logo fica no direito). */
function seloSvg(t: QuadroTheme): { svg: string; w: number; h: number } {
  const f = anton();
  const size = 44;
  const label = t.name.toUpperCase();
  const tw = f.getAdvanceWidth(label, size);
  const w = Math.ceil(tw + 52);
  const h = 72;
  const path = f.getPath(label, 26, 54, size).toPathData(2);
  const fill = t.selo.bg2 ? "url(#selo)" : t.selo.bg;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs>
  <linearGradient id="selo" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0.45" stop-color="${t.selo.bg}"/><stop offset="0.55" stop-color="${t.selo.bg2 ?? t.selo.bg}"/>
  </linearGradient>
</defs>
<rect x="0" y="0" width="${w}" height="${h}" rx="12" fill="${fill}"/>
<path d="${path}" fill="${t.selo.text}"/>
</svg>`;
  return { svg, w, h };
}

/**
 * Logo pronto para fundo escuro. PNG com transparência entra como está. Sem
 * transparência (fundo branco chapado), o branco vira transparente e o
 * traço escuro que não está colado no amarelo (as letras) vira branco — o
 * microfone, dentro do quadrado amarelo, continua preto.
 */
export async function prepareLogo(logo: Buffer): Promise<Buffer> {
  const meta = await sharp(logo).metadata();
  if (meta.hasAlpha) return sharp(logo).trim().resize({ width: LOGO_W }).png().toBuffer();

  const { data, info } = await sharp(logo).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const yellow = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    yellow[i] = r > 180 && g > 120 && b < 110 ? 255 : 0;
  }
  // "Perto do amarelo" = amarelo dilatado ~3% da largura.
  const near = await sharp(yellow, { raw: { width: w, height: h, channels: 1 } })
    .blur(Math.max(2, w * 0.03))
    .extractChannel(0)
    .raw()
    .toBuffer();

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const a = 255 - Math.max(0, Math.min(255, (Math.min(r, g, b) - 200) * 5));
    if (Math.max(r, g, b) < 90 && near[i] < 8) r = g = b = 245;
    out.set([r, g, b, a], i * 4);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim().resize({ width: LOGO_W }).png().toBuffer();
}

/** As pessoas recortadas, já tratadas e na escala da thumb. */
export async function preparePeople(m: Matte, rim: string) {
  const { x0, y0, x1, y1 } = m.box;
  const bw = x1 - x0 + 1;
  const bh = y1 - y0 + 1;
  const cut = await sharp(m.rgba).extract({ left: x0, top: y0, width: bw, height: bh }).png().toBuffer();

  // Do peito para cima: acima da faixa do texto aparece ~55% da altura delas.
  const s = Math.min(1240 / bw, (H * 0.8) / (bh * 0.55), 2.2);
  const top = 18;
  const pw = Math.round(bw * s);
  const scaled = await sharp(cut).resize(pw, Math.round(bh * s)).png().toBuffer();
  // Ampliadas para o peito-para-cima, elas passam da altura da thumb; o que
  // sobra embaixo ficaria atrás da faixa do texto, e o composite do sharp
  // recusa camada maior que o fundo.
  const ph = Math.min(Math.round(bh * s), H - top);
  const people = await sharp(scaled)
    .extract({ left: 0, top: 0, width: pw, height: ph })
    .linear(1.12, -12)
    .modulate({ saturation: 1.08, brightness: 1.03 })
    .png()
    .toBuffer();

  // Contorno de luz na cor do quadro por baixo do recorte: separa do fundo e disfarça a borda.
  const glowA = await sharp(people).extractChannel(3).blur(5).linear(1.6, 0).toBuffer();
  const glow = await sharp({ create: { width: pw, height: ph, channels: 3, background: rim } })
    .joinChannel(glowA)
    .png()
    .toBuffer();

  return { people, glow, left: Math.round((W - pw) / 2), top };
}

/** Thumb final: JPEG 1280×720 abaixo de 2 MB (limite do thumbnails.set). */
export async function composeThumb(
  plate: Buffer,
  people: Awaited<ReturnType<typeof preparePeople>>,
  logo: Buffer | null,
  h: Headline,
  theme: QuadroTheme
): Promise<Buffer> {
  const selo = seloSvg(theme);
  const layers: OverlayOptions[] = [
    { input: people.glow, left: people.left, top: people.top },
    { input: people.people, left: people.left, top: people.top },
    { input: Buffer.from(headlineSvg(h, theme)), left: 0, top: 0 },
    { input: Buffer.from(selo.svg), left: 26, top: 24 },
  ];
  if (logo) layers.push({ input: logo, left: W - LOGO_W - 26, top: 22 });

  const flat = await sharp(plate).resize(W, H, { fit: "cover" }).composite(layers).png().toBuffer();
  for (const quality of [90, 82, 72]) {
    const out = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length < 2_000_000) return out;
  }
  throw new Error("Thumb acima de 2 MB mesmo comprimida.");
}
