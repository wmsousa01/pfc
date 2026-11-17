import "server-only";
import QRCode from "qrcode";
import sharp, { type OverlayOptions } from "sharp";
import { site } from "@/lib/config";
import { anton, fit } from "@/lib/producao/compose";
import { download, signedUrls, upload } from "./arte-io";
import type { Oferta } from "./store";

/**
 * Story da oferta (1080×1920). Feito por código, não por IA: o card leva o
 * texto que o cliente escreveu e a logo dele, sem nada inventado — o gerador
 * de imagem já pôs logo e pessoa que não existiam nas thumbs.
 *
 * Zona segura: o Instagram cobre ~250 px no topo (perfil) e ~250 px na base
 * (campo de resposta). Tudo que importa fica entre y=290 e y=1670. A logo do
 * PFC não entra: o próprio story já mostra o perfil do PFC no topo.
 */

const W = 1080;
const H = 1920;
const GOLD = "#FFD700";
const MX = 90;

export const linkCurto = (codigo: string) => `${site.url}/o/${codigo}`;
const linkCurtoLabel = (codigo: string) => `${site.url.replace(/^https?:\/\/(www\.)?/, "").toUpperCase()}/O/${codigo.toUpperCase()}`;

function texto(t: string, x: number, y: number, size: number, fill: string, opts: { maxW?: number; center?: boolean } = {}) {
  const s = opts.maxW ? fit(t, opts.maxW, size).size : size;
  const f = anton();
  const w = f.getAdvanceWidth(t, s);
  const x0 = opts.center ? x - w / 2 : x;
  return `<path d="${f.getPath(t, x0, y, s).toPathData(2)}" fill="${fill}"/>`;
}

/** Quebra o texto em até `max` linhas que cabem em `maxW`; corta com reticências. */
function linhas(t: string, maxW: number, size: number, max: number): string[] {
  const f = anton();
  const out: string[] = [];
  let atual = "";
  // "R$ 49,90" não quebra no meio: o espaço depois do R$ vira não separável.
  const palavras = t.replace(/R\$\s+/gi, "R$\u00a0").split(/[ \t\n]+/).filter(Boolean);
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (f.getAdvanceWidth(tentativa, size) <= maxW) atual = tentativa;
    else {
      if (atual) out.push(atual);
      atual = p;
    }
  }
  if (atual) out.push(atual);
  if (out.length > max) {
    const cortadas = out.slice(0, max);
    cortadas[max - 1] = `${cortadas[max - 1].replace(/[.,;:!?]?$/, "")}…`;
    return cortadas;
  }
  return out;
}

const corValida = (c: string | null) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : GOLD);

export async function renderStory(o: Oferta): Promise<Buffer> {
  const cor = corValida(o.cor);
  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#0a0a0a"/>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="20" fill="${cor}"/>`);
  parts.push(texto("OFERTA DA SEMANA", W / 2, 345, 64, GOLD, { center: true }));
  parts.push(texto("NO PFC · PODCAST FORA DA CAIXA", W / 2, 400, 32, "#ffffff80", { center: true }));

  // Logo da marca num círculo; sem logo, a inicial na cor dela.
  const LOGO_Y = 445;
  const LOGO_D = 210;
  parts.push(`<circle cx="${W / 2}" cy="${LOGO_Y + LOGO_D / 2}" r="${LOGO_D / 2 + 8}" fill="${cor}"/>`);
  parts.push(`<circle cx="${W / 2}" cy="${LOGO_Y + LOGO_D / 2}" r="${LOGO_D / 2}" fill="#ffffff"/>`);
  const logoRaw = o.logo_path ? await download(o.logo_path).catch(() => null) : null;
  if (!logoRaw) parts.push(texto(o.empresa.slice(0, 1).toUpperCase(), W / 2, LOGO_Y + LOGO_D / 2 + 50, 140, cor, { center: true }));

  parts.push(texto(o.empresa.toUpperCase(), W / 2, 740, 54, "#ffffff", { maxW: W - 2 * MX, center: true }));
  if (o.instagram) parts.push(texto(`@${o.instagram}`.toUpperCase(), W / 2, 788, 30, "#ffffff80", { center: true }));

  // Título da oferta, grande, em até 3 linhas.
  const tamTitulo = 92;
  const tl = linhas(o.titulo.toUpperCase(), W - 2 * MX, tamTitulo, 3);
  tl.forEach((l, i) => parts.push(texto(l, W / 2, 900 + i * (tamTitulo + 12), tamTitulo, cor === GOLD ? GOLD : "#ffffff", { center: true, maxW: W - 2 * MX })));
  const yDesc = 900 + (tl.length - 1) * (tamTitulo + 12) + 75;
  // Título em 3 linhas deixa só 2 para os detalhes, para o QR caber na zona segura.
  const dl = linhas(o.descricao.toUpperCase(), W - 2 * MX, 36, tl.length >= 3 ? 2 : 3);
  dl.forEach((l, i) => parts.push(texto(l, W / 2, yDesc + i * 48, 36, "#ffffffb3", { center: true })));

  // QR + link curto (o clique é contado em /o/{codigo}), logo abaixo do texto
  // e nunca abaixo de y=1640 (faixa de resposta do story).
  const QR = 220;
  const QR_Y = Math.min(1298, yDesc + (dl.length - 1) * 48 + 75);
  parts.push(`<rect x="${(W - QR) / 2 - 18}" y="${QR_Y - 18}" width="${QR + 36}" height="${QR + 36}" rx="22" fill="#ffffff"/>`);
  parts.push(texto("APONTE A CÂMERA OU ACESSE", W / 2, QR_Y + QR + 72, 30, "#ffffff99", { center: true }));
  parts.push(texto(linkCurtoLabel(o.codigo), W / 2, QR_Y + QR + 122, 40, GOLD, { center: true, maxW: W - 2 * MX }));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  const layers: OverlayOptions[] = [];
  const qr = await QRCode.toBuffer(linkCurto(o.codigo), { width: QR, margin: 0, errorCorrectionLevel: "M" });
  layers.push({ input: qr, left: (W - QR) / 2, top: QR_Y });
  if (logoRaw) {
    const inner = LOGO_D - 40;
    const logo = await sharp(logoRaw).resize(inner, inner, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).png().toBuffer();
    const mask = Buffer.from(`<svg width="${inner}" height="${inner}"><circle cx="${inner / 2}" cy="${inner / 2}" r="${inner / 2}" fill="#fff"/></svg>`);
    const redonda = await sharp(logo).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
    layers.push({ input: redonda, left: (W - inner) / 2, top: LOGO_Y + 20 });
  }
  return sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 90 }).toBuffer();
}

/** Gera, guarda e devolve o caminho da arte. */
export async function gerarArte(o: Oferta): Promise<string> {
  const path = `ads/${o.semana}/${o.id}.jpg`;
  await upload(path, await renderStory(o), "image/jpeg");
  return path;
}

export async function urlAssinada(path: string | null): Promise<string | null> {
  if (!path) return null;
  return (await signedUrls([path])).get(path) ?? null;
}
