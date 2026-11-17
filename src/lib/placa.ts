import "server-only";
import path from "path";
import { isValidElement, type ReactElement, type ReactNode } from "react";
import opentype from "opentype.js";
import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import { SparkIcon, partnerIcons } from "@/components/partner/icons";
import { site } from "@/lib/config";
import { anton } from "@/lib/producao/compose";
import { trackingUrl } from "@/lib/qr";
import type { Partner, PartnerPerk } from "@/lib/types";

/**
 * Placa do QR: a arte vertical que vai na tela durante a live, no mesmo
 * molde para todo parceiro (logo, gancho, destaque, até 3 benefícios,
 * chamada e QR). Muda só o que é do parceiro: logo, cores e textos.
 *
 * O QR é gerado aqui, de verdade: as artes feitas no GPT trazem um QR
 * desenhado, que não leva a lugar nenhum. Ele aponta para /go/{slug}?src=qr
 * no domínio canônico (nunca o host do preview), então cada leitura conta
 * como acesso do parceiro.
 *
 * 1080×1920 (9:16), fundo transparente fora do cartão: serve de overlay no
 * OBS e também de Story. Mesmo método das artes da agenda: texto vetorizado
 * pelo opentype (não depende de fonte instalada) e PNG final pelo sharp.
 */
export const PLACA_W = 1080;
export const PLACA_H = 1920;

const INSET = 28; // margem transparente em volta do cartão
const PAD_X = 72;
const PAD_TOP = 64;
const PAD_BOTTOM = 56;
const X0 = INSET + PAD_X;
const CW = PLACA_W - 2 * X0; // largura útil: 880

let noto: opentype.Font | null = null;
function notoSans(): opentype.Font {
  // Noto Sans (SIL OFL 1.1), copiada do pacote do next/og.
  noto ??= opentype.loadSync(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
  return noto;
}

// ---------------------------------------------------------------- cores

function hex6(hex: string | null | undefined, fallback: string): string {
  let h = (hex ?? "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h}` : fallback;
}

// ---------------------------------------------------------------- texto

/** Quebra em linhas que cabem em `maxW`. Palavra maior que a linha fica sozinha. */
function wrap(font: opentype.Font, text: string, size: number, maxW: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && font.getAdvanceWidth(next, size) > maxW) {
      lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Corta em `max` linhas, com reticências na última. */
function clamp(font: opentype.Font, lines: string[], max: number, size: number, maxW: number): string[] {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  let last = `${out[max - 1]}…`;
  while (last.length > 2 && font.getAdvanceWidth(last, size) > maxW) {
    last = `${last.slice(0, -2).trimEnd()}…`;
  }
  out[max - 1] = last;
  return out;
}

/** Maior tamanho (de `max` para baixo) em que o texto cabe em `maxLines` linhas. */
function fitLines(font: opentype.Font, text: string, maxW: number, max: number, min: number, maxLines: number) {
  for (let size = max; size >= min; size -= 4) {
    const lines = wrap(font, text, size, maxW);
    if (lines.length <= maxLines && lines.every((l) => font.getAdvanceWidth(l, size) <= maxW)) {
      return { size, lines };
    }
  }
  return { size: min, lines: clamp(font, wrap(font, text, min, maxW), maxLines, min, maxW) };
}

function textPath(font: opentype.Font, text: string, x: number, baseline: number, size: number, fill: string): string {
  return `<path d="${font.getPath(text, x, baseline, size).toPathData(2)}" fill="${fill}"/>`;
}

// ---------------------------------------------------------------- ícones

/**
 * Serializa o ícone da página do parceiro (componente React de <svg>) em
 * markup SVG, sem react-dom/server (o Next não deixa importar no servidor do
 * app router). Os ícones são só <svg>/<path>/<rect>/<circle> com props simples.
 */
function svgOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(svgOf).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node) || typeof node.type !== "string") return "";
  const { children, className: _c, ...props } = node.props as Record<string, unknown>;
  const attrs = Object.entries(props)
    .filter(([, v]) => v != null && typeof v !== "object" && typeof v !== "function")
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}="${String(v)}"`)
    .join(" ");
  return `<${node.type} ${attrs}>${svgOf(children as ReactNode)}</${node.type}>`;
}

function iconSvg(name: string | undefined, x: number, y: number, size: number, color: string): string {
  const Cmp = (name && partnerIcons[name]) || SparkIcon;
  const el = Cmp({}) as ReactElement<{ children?: ReactNode }>;
  const inner = svgOf(el.props.children).replace(/currentColor/g, color);
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

// ---------------------------------------------------------------- logo

async function logoPng(url: string | null, maxW: number, maxH: number) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // trim: logo com margem própria sumiria de tão pequeno na caixa.
    const trimmed = await sharp(buf, { density: 300 }).trim().png().toBuffer().catch(() => buf);
    const { data, info } = await sharp(trimmed)
      .resize(maxW, maxH, { fit: "inside" })
      .png()
      .toBuffer({ resolveWithObject: true });
    return { data, w: info.width, h: info.height };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- placa

type Item = { perk: PartnerPerk; title: string[]; body: string[]; h: number };

export async function renderPlaca(partner: Partner): Promise<Buffer> {
  const A = anton();
  const N = notoSans();
  const accent = hex6(partner.accent, "#FFD700");
  const bg = hex6(partner.color_bg, "#0a0a0a");
  const placa = partner.content?.placa ?? {};

  // O nome já está no logo: o destaque padrão é a tagline, não o nome.
  const titulo = (placa.titulo ?? "").trim().toUpperCase();
  const destaque = (placa.destaque || partner.tagline || partner.name).trim().toUpperCase();
  const chamada = (placa.chamada || partner.cta_label || "Escaneie e confira").trim().toUpperCase();
  const proprios = partner.content?.placa_itens ?? [];
  const perks =
    placa.itens === false ? [] : (proprios.length ? proprios : partner.content?.perks ?? []).slice(0, 3);

  // --- medidas de cada bloco
  const lh = (s: number) => Math.round(s * 1.04);
  const tituloFit = titulo ? fitLines(A, titulo, CW, 84, 56, 2) : null;

  const ICON_BOX = 132;
  const TX = X0 + ICON_BOX + 32;
  const TW = CW - ICON_BOX - 32;
  const items: Item[] = perks.map((perk) => {
    const title = clamp(A, wrap(A, perk.title.toUpperCase(), 52, TW), 2, 52, TW);
    const body = perk.body ? clamp(N, wrap(N, perk.body, 31, TW), 2, 31, TW) : [];
    const textH = title.length * lh(52) + (body.length ? 8 + body.length * 40 : 0);
    return { perk, title, body, h: Math.max(ICON_BOX, textH) };
  });
  const ITEM_GAP = 24;
  const itemsH = items.reduce((s, i) => s + i.h, 0) + Math.max(0, items.length - 1) * ITEM_GAP;

  const chamadaFit = fitLines(A, chamada, CW, 76, 48, 2);
  const chamadaH = chamadaFit.lines.length * lh(chamadaFit.size);
  const FOOTER = 30;

  const logoMaxH = items.length === 3 ? 220 : 300;
  // Símbolo no lugar do logo (ex.: câmera do fotógrafo, cuja "logo" é uma
  // foto pequena demais na tela): ícone grande num círculo + nome e @ embaixo,
  // para a placa não perder quem é o parceiro.
  const simbolo = placa.simbolo?.trim() || null;
  const CIRCLE = items.length === 3 ? 190 : 230;
  const nomeFit = fitLines(A, partner.name.toUpperCase(), CW, 64, 40, 1);
  const handle = partner.instagram ? `@${partner.instagram}` : "";
  const logo = simbolo ? null : await logoPng(partner.logo_url, 760, logoMaxH);
  const logoH = simbolo
    ? CIRCLE + 22 + lh(nomeFit.size) + (handle ? 42 : 0)
    : logo
      ? logo.h
      : lh(96);
  const logoBlock = logoH + 40; // + linha de brilho

  const innerTop = INSET + PAD_TOP;
  const innerH = PLACA_H - 2 * INSET - PAD_TOP - PAD_BOTTOM;
  const blocks = items.length ? 4 : 3;
  const MIN_GAP = 36;
  const QR_PAD = 26;
  const QR_MIN = 400; // abaixo disso o QR fica difícil de ler pela tela da live
  const QR_MAX = 620;

  // O QR tem prioridade: o destaque desce de tamanho até o QR caber com pelo
  // menos QR_MIN; o que sobra depois vira respiro entre os blocos.
  const rest = logoBlock + itemsH + chamadaH + 28 + 2 * QR_PAD + 26 + FOOTER + (blocks - 1) * MIN_GAP;
  const tituloH = tituloFit ? tituloFit.lines.length * lh(tituloFit.size) + 6 : 0;
  let destaqueFit = fitLines(A, destaque, CW, 128, 56, 3);
  for (let max = 120; max >= 56; max -= 8) {
    const h = tituloH + destaqueFit.lines.length * lh(destaqueFit.size);
    if (innerH - rest - h >= QR_MIN) break;
    destaqueFit = fitLines(A, destaque, CW, max, 56, 3);
  }
  const headH = tituloH + destaqueFit.lines.length * lh(destaqueFit.size);

  const fixed = rest - (blocks - 1) * MIN_GAP + headH;
  const qrSize = Math.max(300, Math.min(QR_MAX, innerH - fixed - (blocks - 1) * MIN_GAP));
  const gap = Math.max(MIN_GAP, (innerH - fixed - qrSize) / (blocks - 1));

  // --- desenho
  const parts: string[] = [];
  const overlays: OverlayOptions[] = [];
  let y = innerTop;

  // Logo + linha de brilho
  if (simbolo) {
    const r = CIRCLE / 2;
    const cx = PLACA_W / 2;
    parts.push(
      `<circle cx="${cx}" cy="${y + r}" r="${r + 10}" fill="${accent}" opacity="0.45" filter="url(#glow)"/>`,
      `<circle cx="${cx}" cy="${y + r}" r="${r}" fill="#000000" fill-opacity="0.55" stroke="${accent}" stroke-width="6"/>`,
      iconSvg(simbolo, cx - CIRCLE * 0.3, y + r - CIRCLE * 0.3, CIRCLE * 0.6, accent)
    );
    let ny = y + CIRCLE + 22 + lh(nomeFit.size);
    const nw = A.getAdvanceWidth(nomeFit.lines[0], nomeFit.size);
    parts.push(textPath(A, nomeFit.lines[0], (PLACA_W - nw) / 2, ny - lh(nomeFit.size) * 0.14, nomeFit.size, "#ffffff"));
    if (handle) {
      ny += 42;
      const hw = N.getAdvanceWidth(handle, 32);
      parts.push(textPath(N, handle, (PLACA_W - hw) / 2, ny - 6, 32, "rgba(255,255,255,0.7)"));
    }
  } else if (logo) {
    overlays.push({ input: logo.data, left: Math.round((PLACA_W - logo.w) / 2), top: Math.round(y) });
  } else {
    const nm = fitLines(A, partner.name.toUpperCase(), CW, 96, 48, 1);
    const w = A.getAdvanceWidth(nm.lines[0], nm.size);
    parts.push(textPath(A, nm.lines[0], (PLACA_W - w) / 2, y + nm.size * 0.86, nm.size, "#ffffff"));
  }
  y += logoH + 36;
  parts.push(`<rect x="${PLACA_W * 0.15}" y="${y}" width="${PLACA_W * 0.7}" height="4" rx="2" fill="url(#line)"/>`);
  y += 4 + gap;

  // Gancho + destaque
  if (tituloFit) {
    for (const line of tituloFit.lines) {
      y += lh(tituloFit.size);
      parts.push(textPath(A, line, X0, y - lh(tituloFit.size) * 0.14, tituloFit.size, "#ffffff"));
    }
    y += 6;
  }
  for (const line of destaqueFit.lines) {
    y += lh(destaqueFit.size);
    parts.push(textPath(A, line, X0, y - lh(destaqueFit.size) * 0.14, destaqueFit.size, accent));
  }
  y += gap;

  // Benefícios
  for (const it of items) {
    const top = y + (it.h - ICON_BOX) / 2;
    parts.push(
      `<rect x="${X0}" y="${top}" width="${ICON_BOX}" height="${ICON_BOX}" rx="28" fill="#ffffff" fill-opacity="0.05" stroke="${accent}" stroke-opacity="0.75" stroke-width="3"/>`,
      iconSvg(it.perk.icon, X0 + (ICON_BOX - 76) / 2, top + (ICON_BOX - 76) / 2, 76, "#ffffff")
    );
    const textH = it.title.length * lh(52) + (it.body.length ? 8 + it.body.length * 40 : 0);
    let ty = y + (it.h - textH) / 2;
    for (const line of it.title) {
      ty += lh(52);
      parts.push(textPath(A, line, TX, ty - lh(52) * 0.12, 52, accent));
    }
    if (it.body.length) ty += 8;
    for (const line of it.body) {
      ty += 40;
      parts.push(textPath(N, line, TX, ty - 9, 31, "rgba(255,255,255,0.86)"));
    }
    y += it.h + ITEM_GAP;
  }
  if (items.length) y += gap - ITEM_GAP;

  // Chamada
  for (const line of chamadaFit.lines) {
    y += lh(chamadaFit.size);
    const w = A.getAdvanceWidth(line, chamadaFit.size);
    parts.push(textPath(A, line, (PLACA_W - w) / 2, y - lh(chamadaFit.size) * 0.14, chamadaFit.size, "#ffffff"));
  }
  y += 28;

  // QR (com brilho na cor da marca)
  const box = qrSize + 2 * QR_PAD;
  const bx = (PLACA_W - box) / 2;
  parts.push(
    `<rect x="${bx}" y="${y}" width="${box}" height="${box}" rx="36" fill="${accent}" filter="url(#glow)" opacity="0.8"/>`,
    `<rect x="${bx}" y="${y}" width="${box}" height="${box}" rx="36" fill="#ffffff" stroke="${accent}" stroke-width="6"/>`
  );
  const qr = await QRCode.toBuffer(trackingUrl(site.url, partner.slug), {
    width: qrSize,
    margin: 0,
    errorCorrectionLevel: "Q",
    color: { dark: "#000000", light: "#FFFFFF" },
  });
  const qrFit = await sharp(qr).resize(qrSize, qrSize, { kernel: "nearest" }).png().toBuffer();
  overlays.push({ input: qrFit, left: Math.round(bx + QR_PAD), top: Math.round(y + QR_PAD) });
  y += box + 26;

  // Rodapé
  const foot = "PARCEIRO PFC  ·  pfctv.com.br";
  const fw = N.getAdvanceWidth(foot, FOOTER);
  parts.push(textPath(N, foot, (PLACA_W - fw) / 2, y + FOOTER * 0.8, FOOTER, "rgba(255,255,255,0.6)"));

  const cardW = PLACA_W - 2 * INSET;
  const cardH = PLACA_H - 2 * INSET;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PLACA_W}" height="${PLACA_H}">
<defs>
  <radialGradient id="top" cx="0.5" cy="0" r="0.75">
    <stop offset="0" stop-color="${accent}" stop-opacity="0.3"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0.4" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.55"/>
  </linearGradient>
  <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="${accent}" stop-opacity="0"/><stop offset="0.5" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/>
  </linearGradient>
  <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
  <clipPath id="card"><rect x="${INSET}" y="${INSET}" width="${cardW}" height="${cardH}" rx="56"/></clipPath>
</defs>
<rect x="${INSET}" y="${INSET}" width="${cardW}" height="${cardH}" rx="56" fill="${accent}" opacity="0.55" filter="url(#glow)"/>
<g clip-path="url(#card)">
  <rect x="0" y="0" width="${PLACA_W}" height="${PLACA_H}" fill="${bg}"/>
  <rect x="0" y="0" width="${PLACA_W}" height="${PLACA_H}" fill="url(#top)"/>
  <rect x="0" y="0" width="${PLACA_W}" height="${PLACA_H}" fill="url(#fade)"/>
</g>
<rect x="${INSET + 2}" y="${INSET + 2}" width="${cardW - 4}" height="${cardH - 4}" rx="54" fill="none" stroke="${accent}" stroke-opacity="0.9" stroke-width="4"/>
${parts.join("\n")}
</svg>`;

  return sharp(Buffer.from(svg)).composite(overlays).png().toBuffer();
}
