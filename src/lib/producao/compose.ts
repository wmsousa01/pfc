import "server-only";
import path from "path";
import sharp, { type OverlayOptions } from "sharp";
import opentype from "opentype.js";
import type { Matte } from "./matte";
import type { QuadroTheme } from "./quadros";
import type { Headline } from "./store";

const W = 1280;
const H = 720;
/** Caixa do logo: quadrado sai 120×120; largo (ícone + nome, como o do PFC) até 220 de largura. */
const LOGO_BOX = { width: 220, height: 120, fit: "inside" } as const;

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

/** Altura das maiúsculas da Anton, em fração do tamanho da fonte. */
const CAP = 0.86;

/**
 * Uma linha da headline no acabamento das thumbs da equipe: volume 3D
 * (cópias escuras empilhadas para baixo), contorno grosso, letra engrossada
 * (a Anton pura fica fina e espaçada perto da arte da equipe), preenchimento
 * metálico, brilho no topo e textura de metal arranhado. O path fica sem
 * estilo nos defs: atributo no path original não deixa o <use> trocar a cor.
 */
function lineSvg(id: string, d: string, fill: string, extrude: string, depth: number, bold: number): string {
  const outline = bold * 2 + 9;
  const shape = (paint: string) => `fill="${paint}" stroke="${paint}" stroke-width="${bold * 2}" stroke-linejoin="round"`;
  const layers = Array.from({ length: depth }, (_, i) => `<use xlink:href="#${id}" y="${i + 1}"/>`).join("");
  return `<defs><path id="${id}" d="${d}"/></defs>
<g filter="url(#shadow)"><g fill="${extrude}" stroke="${extrude}" stroke-width="${outline}" stroke-linejoin="round">${layers}</g></g>
<use xlink:href="#${id}" fill="#050505" stroke="#050505" stroke-width="${outline}" stroke-linejoin="round"/>
<use xlink:href="#${id}" ${shape(fill)}/>
<use xlink:href="#${id}" ${shape("url(#sheen)")}/>
<use xlink:href="#${id}" ${shape("#000")} filter="url(#grunge)"/>`;
}

function headlineSvg(h: Headline, t: QuadroTheme): string {
  const [r, g, b] = rgb01(t.glow).split(" ");
  const f = anton();
  // Linha 1 menor (o gancho), linha 2 bem maior na cor do quadro e, quando
  // há, linha 3 do mesmo tamanho em prata — a hierarquia das thumbs da equipe.
  const three = !!h.l3;
  const big = three ? 164 : 196;
  const f1 = fit(h.l1, 1080, three ? 84 : 100);
  const f2 = fit(h.l2, 1170, big);
  const f3 = three ? fit(h.l3!, 1170, big) : null;
  const base3 = H - 44;
  const base2 = f3 ? base3 - f3.size * CAP - 22 : base3;
  const base1 = base2 - f2.size * CAP - 26;
  const last = f3 ? base3 : base2;
  const p1 = f.getPath(h.l1, (W - f1.width) / 2, base1, f1.size).toPathData(2);
  const p2 = f.getPath(h.l2, (W - f2.width) / 2, base2, f2.size).toPathData(2);
  const p3 = f3 ? f.getPath(h.l3!, (W - f3.width) / 2, base3, f3.size).toPathData(2) : null;
  // Itálico (PFC News): inclina cada linha a partir da própria base, sem sair do centro.
  const skew = (base: number) => (t.italic ? ` transform="translate(${W / 2} ${base}) skewX(-9) translate(${-W / 2} ${-base})"` : "");
  const accent = t.split
    ? `<linearGradient id="accent" gradientUnits="userSpaceOnUse" x1="${(W - f2.width) / 2}" y1="0" x2="${(W + f2.width) / 2}" y2="0">
    <stop offset="0.46" stop-color="${t.split[0]}"/><stop offset="0.54" stop-color="${t.split[1]}"/>
  </linearGradient>`
    : `<linearGradient id="accent" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${t.accent[0]}"/><stop offset="0.45" stop-color="${t.accent[1]}"/><stop offset="0.8" stop-color="${t.accent[2]}"/><stop offset="1" stop-color="${t.accent[1]}"/>
  </linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
<defs>
  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="${three ? 0.34 : 0.44}" stop-color="#03060f" stop-opacity="0"/>
    <stop offset="${three ? 0.52 : 0.6}" stop-color="#03060f" stop-opacity="0.92"/>
    <stop offset="1" stop-color="#000000" stop-opacity="1"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#ffffff"/><stop offset="0.4" stop-color="#f1f1f1"/><stop offset="0.62" stop-color="#b9b9b9"/><stop offset="0.82" stop-color="#ececec"/><stop offset="1" stop-color="#a3a3a3"/>
  </linearGradient>
  ${accent}
  <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity="0.7"/><stop offset="0.3" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.18"/>
  </linearGradient>
  <filter id="grunge" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.55 0.12" numOctaves="4" seed="7" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -3.2 0 0 0 1.55" result="spots"/>
    <feComposite in="spots" in2="SourceAlpha" operator="in" result="s"/>
    <feComponentTransfer in="s"><feFuncA type="linear" slope="0.2"/></feComponentTransfer>
  </filter>
  <filter id="shadow" x="-10%" y="-20%" width="120%" height="160%">
    <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity="0.95"/>
  </filter>
  <filter id="glow" x="-10%" y="-30%" width="120%" height="180%">
    <feGaussianBlur stdDeviation="14" result="b"/>
    <feColorMatrix in="b" type="matrix" values="0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 0.6 0"/>
    <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="streak" x="-20%" y="-400%" width="140%" height="900%"><feGaussianBlur stdDeviation="7 3"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#band)"/>
<ellipse cx="${W / 2}" cy="${last + 22}" rx="560" ry="7" fill="${t.glow}" opacity="0.9" filter="url(#streak)"/>
<ellipse cx="${W / 2}" cy="${last + 22}" rx="320" ry="2" fill="#fff" opacity="0.9" filter="url(#streak)"/>
<g${skew(base1)}>${lineSvg("l1", p1, "url(#silver)", "#2a2a2a", 6, 2)}</g>
<g filter="url(#glow)"><g${skew(base2)}>${lineSvg("l2", p2, "url(#accent)", t.stroke, 11, 3.5)}</g></g>
${p3 ? `<g${skew(base3)}>${lineSvg("l3", p3, "url(#silver)", "#2a2a2a", 11, 3.5)}</g>` : ""}
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
 * Logo pronto para fundo escuro. PNG com fundo transparente entra como está.
 * Com fundo branco chapado (mesmo em PNG com canal alfa), o branco vira
 * transparente e o traço escuro fora do amarelo (as letras) vira branco — o
 * microfone, dentro do quadrado amarelo, continua preto. Com fundo escuro
 * chapado (logo do Lado A Lado B), só esse fundo some.
 */
export async function prepareLogo(logo: Buffer): Promise<Buffer> {
  if (await transparentCorners(logo)) return sharp(logo).trim().resize(LOGO_BOX).png().toBuffer();

  const { data, info } = await sharp(logo).flatten({ background: "#ffffff" }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (Math.max(data[0], data[1], data[2]) < 60) return removeDarkBackground(data, w, h);
  // Escuro "dentro do amarelo" = tem amarelo à esquerda, à direita, em cima e
  // embaixo (o microfone). As letras ao lado do quadrado — mesmo debaixo da
  // seta do logo do PFC — não ficam cercadas.
  const isYellow = (i: number) => data[i * 3] > 180 && data[i * 3 + 1] > 120 && data[i * 3 + 2] < 110;
  const row = new Uint8Array(w * h);
  const inside = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let first = -1, last = -1;
    for (let x = 0; x < w; x++) if (isYellow(y * w + x)) (first < 0 && (first = x), (last = x));
    for (let x = first + 1; x < last; x++) row[y * w + x] = 1;
  }
  for (let x = 0; x < w; x++) {
    let first = -1, last = -1;
    for (let y = 0; y < h; y++) if (isYellow(y * w + x)) (first < 0 && (first = y), (last = y));
    for (let y = first + 1; y < last; y++) inside[y * w + x] = row[y * w + x];
  }

  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const a = 255 - Math.max(0, Math.min(255, (Math.min(r, g, b) - 200) * 5));
    if (Math.max(r, g, b) < 90 && !inside[i]) r = g = b = 245;
    out.set([r, g, b, a], i * 4);
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim().resize(LOGO_BOX).png().toBuffer();
}

/**
 * Fundo escuro: apaga a partir das bordas o que for parecido com a cor do
 * canto (quase exata: os sulcos do disco do Lado A Lado B são quase do mesmo
 * tom). Só o que está ligado à borda some, então o escuro de dentro do logo fica.
 */
async function removeDarkBackground(data: Buffer, w: number, h: number): Promise<Buffer> {
  const [br, bg, bb] = [data[0], data[1], data[2]];
  const isBg = (i: number) =>
    Math.abs(data[i * 3] - br) + Math.abs(data[i * 3 + 1] - bg) + Math.abs(data[i * 3 + 2] - bb) < 8;
  const mask = Buffer.alloc(w * h, 255);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop()!;
    if (mask[i] === 0 || !isBg(i)) continue;
    mask[i] = 0;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  // Borda suave, sem serrilhado.
  const alpha = await sharp(mask, { raw: { width: w, height: h, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
  // Em dois passos: no mesmo pipeline o sharp corta (trim) antes de juntar o alfa.
  const rgba = await sharp(data, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  return sharp(rgba).trim().resize(LOGO_BOX).png().toBuffer();
}

async function transparentCorners(logo: Buffer): Promise<boolean> {
  const meta = await sharp(logo).metadata();
  if (!meta.hasAlpha) return false;
  const { data, info } = await sharp(logo).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  return [0, w - 1, (h - 1) * w, h * w - 1].every((i) => data[i] < 20);
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
  if (logo) {
    const { width = 0 } = await sharp(logo).metadata();
    layers.push({ input: logo, left: W - width - 26, top: 22 });
  }

  const flat = await sharp(plate).resize(W, H, { fit: "cover" }).composite(layers).png().toBuffer();
  for (const quality of [90, 82, 72]) {
    const out = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length < 2_000_000) return out;
  }
  throw new Error("Thumb acima de 2 MB mesmo comprimida.");
}
