import "server-only";
import { randomUUID } from "crypto";
import sharp, { type OverlayOptions } from "sharp";
import { CAP, anton, fit, lineSvg, prepareLogo, seloSvg, textDefs } from "@/lib/producao/compose";
import { isGeminiConfigured, renderPlate } from "@/lib/producao/gemini";
import { matte } from "@/lib/producao/matte";
import { isQuadroId, quadroLogoPath, themeOf, type QuadroTheme } from "@/lib/producao/quadros";
import { LOGO_PATH, download, upload, type Headline } from "@/lib/producao/store";
import { gerarCenas, jpegFinal, type Img, type PessoaCena, type RefCena } from "./cena";
import { imagemDe } from "./materiais";
import {
  WEEKDAYS,
  TZ,
  apresentadoresDoEpisodio,
  brtDate,
  db,
  materiaisDe,
  type Apresentador,
  type Arte,
  type ArteModo,
  type Convidado,
  type Episodio,
  type Material,
} from "./store";

/**
 * Artes de divulgação do episódio. Dois modos: "ia" (o Gemini desenha a
 * cena inteira com as fotos reais — ver cena.ts) e "recorte", abaixo, no
 * acabamento das thumbs dos cortes:
 * fundo de estúdio do Gemini, o convidado recortado da foto dele (MODNet,
 * rosto real), selo e cor do quadro, headline do tema, nome e @ do
 * convidado e a data da live.
 *
 * Três formatos de uma vez: feed 4:5 (post collab), 9:16 (Story, Reels e
 * TikTok) e 16:9 (thumb da live no YouTube).
 */
type Formato = {
  key: "feed" | "story" | "thumb";
  w: number;
  h: number;
  /** Faixas que a interface do Instagram cobre no Story. */
  safeTop: number;
  safeBottom: number;
  big: number;
  small: number;
  /** Na thumb não cabe o nome: a data vai no alto, numa faixa. */
  nomes: boolean;
};

const FORMATOS: Formato[] = [
  { key: "feed", w: 1080, h: 1350, safeTop: 36, safeBottom: 48, big: 150, small: 78, nomes: true },
  { key: "story", w: 1080, h: 1920, safeTop: 230, safeBottom: 300, big: 160, small: 82, nomes: true },
  { key: "thumb", w: 1280, h: 720, safeTop: 22, safeBottom: 36, big: 104, small: 58, nomes: false },
];

function platePrompt(theme: QuadroTheme, vertical: boolean): string {
  return `Photographic background plate for a podcast episode announcement, ${vertical ? "vertical 9:16" : "16:9"}.
An EMPTY professional podcast studio: absolutely no people, no text, no letters, no logos, no microphones in the foreground.
Cinematic look: deep black and navy blue, ${theme.light}, shallow depth of field, subtle haze, fine film grain.
The center stays dark and uncluttered (a person will be composited there later). The bottom 45% fades to almost black.
High contrast, dense blacks, no artificial HDR, no oversaturation.`;
}

/** Sem Gemini, um fundo escuro com a luz do quadro — a arte sai, só mais simples. */
function fallbackPlate(w: number, h: number, t: QuadroTheme): Buffer {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><radialGradient id="g" cx="0.5" cy="0.3" r="0.8">
<stop offset="0" stop-color="${t.glow}" stop-opacity="0.35"/><stop offset="0.6" stop-color="#050b1a"/><stop offset="1" stop-color="#000"/>
</radialGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/></svg>`);
}

/** "QUINTA · 06/11 · 19H" ("HOJE · 06/11 · 19H" na chamada do dia) */
function dataLabel(iso: string, hoje = false): string {
  const d = new Date(iso);
  const wd = WEEKDAYS[new Date(`${brtDate(d)}T12:00:00-03:00`).getUTCDay()];
  const dia = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const [hh, mm] = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":");
  return `${hoje ? "hoje" : wd} · ${dia} · ${hh}H${mm === "00" ? "" : mm}`.toUpperCase();
}

type Pessoa = { rgba: Buffer; w: number; h: number };

/** Recorte da foto do convidado, justo na pessoa. */
async function recorte(foto: Buffer): Promise<Pessoa> {
  const m = await matte(await sharp(foto).rotate().resize(1600, 1600, { fit: "inside" }).jpeg().toBuffer());
  const { x0, y0, x1, y1 } = m.box;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const rgba = await sharp(m.rgba).extract({ left: x0, top: y0, width: w, height: h }).png().toBuffer();
  return { rgba, w, h };
}

/** Foto enviada pelo convidado; sem ela, a do perfil do Instagram (pequena, mas serve). */
async function fotoDe(c: Convidado): Promise<Buffer | null> {
  if (c.foto_path) {
    const b = await download(c.foto_path);
    if (b) return b;
  }
  const pic = c.ig_perfil?.picture;
  if (!pic) return null;
  const res = await fetch(pic, { cache: "no-store" }).catch(() => null);
  return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
}

/** Máscara que apaga os últimos 22% da pessoa (fullH = altura inteira dela na arte). */
function fadeMask(w: number, h: number, fullH: number): Buffer {
  const start = Math.max(0, Math.min(1, (fullH * 0.78) / h));
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
<stop offset="${start.toFixed(3)}" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
</linearGradient></defs><rect width="${w}" height="${h}" fill="url(#f)"/></svg>`);
}

/**
 * As pessoas lado a lado, todas na mesma altura, com o contorno de luz do
 * quadro. A base delas fica escondida atrás da faixa escura do texto.
 */
async function camadasPessoas(
  pessoas: Pessoa[],
  f: Formato,
  t: QuadroTheme,
  top: number,
  bottom: number
): Promise<OverlayOptions[]> {
  if (pessoas.length === 0) return [];
  const alvoH = bottom - top;
  const gap = -Math.round(f.w * 0.04); // um pouco sobrepostas, como na bancada
  let escala = pessoas.map((p) => Math.min(alvoH / p.h, 2.6));
  const larguraTotal = () => pessoas.reduce((s, p, i) => s + p.w * escala[i], 0) + gap * (pessoas.length - 1);
  const maxW = f.w * (pessoas.length === 1 ? 0.92 : 0.98);
  if (larguraTotal() > maxW) {
    const k = maxW / larguraTotal();
    escala = escala.map((s) => s * k);
  }

  const out: OverlayOptions[] = [];
  let left = Math.round((f.w - larguraTotal()) / 2);
  for (let i = 0; i < pessoas.length; i++) {
    const p = pessoas[i];
    const pw = Math.max(1, Math.round(p.w * escala[i]));
    const ph = Math.max(1, Math.round(p.h * escala[i]));
    const y = bottom - ph;
    // O composite do sharp recusa camada que passa da borda: corta o excesso.
    const cutTop = Math.max(0, -y);
    const cutLeft = Math.max(0, -left);
    const visW = Math.min(pw - cutLeft, f.w - Math.max(0, left));
    const visH = Math.min(ph - cutTop, f.h - Math.max(0, y));
    if (visW > 0 && visH > 0) {
      const img = await sharp(p.rgba)
        .resize(pw, ph)
        .extract({ left: cutLeft, top: cutTop, width: visW, height: visH })
        .linear(1.1, -10)
        .modulate({ saturation: 1.06, brightness: 1.03 })
        // A base da foto some aos poucos em vez de acabar numa linha reta.
        .composite([{ input: fadeMask(visW, visH, ph - cutTop), blend: "dest-in" }])
        .png()
        .toBuffer();
      const glowA = await sharp(img).extractChannel(3).blur(6).linear(1.6, 0).toBuffer();
      const glow = await sharp({ create: { width: visW, height: visH, channels: 3, background: t.rim } })
        .joinChannel(glowA)
        .png()
        .toBuffer();
      const pos = { left: Math.max(0, left), top: Math.max(0, y) };
      out.push({ input: glow, ...pos }, { input: img, ...pos });
    }
    left += pw + gap;
  }
  return out;
}

type Texto = { svg: string; headlineTop: number };

/** Faixa escura, headline, nomes e a data — tudo de baixo para cima. */
function textoSvg(f: Formato, t: QuadroTheme, h: Headline, nomes: string, handles: string, data: string): Texto {
  const font = anton();
  const { w: W, h: H } = f;
  const maxW = W - 90;
  const three = !!h.l3;
  const big = three ? f.big : f.big + 24;
  const f1 = fit(h.l1, maxW - 60, three ? f.small : f.small + 12);
  const f2 = fit(h.l2, maxW, big);
  const f3 = three ? fit(h.l3!, maxW, big) : null;

  let y = H - f.safeBottom;
  const parts: string[] = [];
  const pill = (label: string, cy: number, size: number) => {
    const tw = font.getAdvanceWidth(label, size);
    const pw = tw + size * 1.6 + 28;
    const ph = size * 1.55;
    const x = (W - pw) / 2;
    const path = font.getPath(label, x + size * 1.2 + 14, cy + size * CAP * 0.5, size).toPathData(2);
    return `<rect x="${x}" y="${cy - ph / 2}" width="${pw}" height="${ph}" rx="${ph / 2}" fill="${t.selo.bg}"/>
<circle cx="${x + size * 0.75 + 4}" cy="${cy}" r="${size * 0.28}" fill="#e11d2a"/>
<path d="${path}" fill="${t.selo.text}"/>`;
  };

  if (f.nomes) {
    const ds = 46;
    parts.push(pill(`AO VIVO · ${data}`, y - ds * 0.78, ds));
    y -= ds * 1.55 + 26;
    if (handles) {
      const hs = fit(handles, maxW, 40);
      parts.push(`<path d="${font.getPath(handles, (W - hs.width) / 2, y, hs.size).toPathData(2)}" fill="${t.accent[1]}"/>`);
      y -= hs.size * CAP + 18;
    }
    const nm = fit(nomes, maxW, 64);
    parts.push(`<path d="${font.getPath(nomes, (W - nm.width) / 2, y, nm.size).toPathData(2)}" fill="#ffffff"/>`);
    y -= nm.size * CAP + 40;
  } else {
    // Na altura do selo, entre ele e o logo.
    parts.push(pill(`AO VIVO · ${data}`, f.safeTop + 36, 30));
  }

  const base3 = y;
  const base2 = f3 ? base3 - f3.size * CAP - 22 : base3;
  const base1 = base2 - f2.size * CAP - 26;
  const headlineTop = base1 - f1.size * CAP;
  const skew = (base: number) => (t.italic ? ` transform="translate(${W / 2} ${base}) skewX(-9) translate(${-W / 2} ${-base})"` : "");
  const p1 = font.getPath(h.l1, (W - f1.width) / 2, base1, f1.size).toPathData(2);
  const p2 = font.getPath(h.l2, (W - f2.width) / 2, base2, f2.size).toPathData(2);
  const p3 = f3 ? font.getPath(h.l3!, (W - f3.width) / 2, base3, f3.size).toPathData(2) : null;

  // Engrossamento e volume proporcionais: na headline pequena (16:9) o fixo embola as letras.
  const k = Math.min(1, f2.size / 160);
  // A faixa escura começa um pouco acima da headline e cobre a base das pessoas.
  const fadeFrom = Math.max(0, headlineTop - H * 0.16) / H;
  const fadeTo = Math.min(1, headlineTop / H + 0.02);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
<defs>
  <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
    <stop offset="${fadeFrom.toFixed(3)}" stop-color="#03060f" stop-opacity="0"/>
    <stop offset="${fadeTo.toFixed(3)}" stop-color="#03060f" stop-opacity="0.94"/>
    <stop offset="1" stop-color="#000" stop-opacity="1"/>
  </linearGradient>
  ${textDefs(t, [(W - f2.width) / 2, (W + f2.width) / 2])}
</defs>
<rect width="${W}" height="${H}" fill="url(#band)"/>
<g${skew(base1)}>${lineSvg("l1", p1, "url(#silver)", "#2a2a2a", 5, 2 * k)}</g>
<g filter="url(#glow)"><g${skew(base2)}>${lineSvg("l2", p2, "url(#accent)", t.stroke, Math.round(10 * k), 3.5 * k)}</g></g>
${p3 ? `<g${skew(base3)}>${lineSvg("l3", p3, "url(#silver)", "#2a2a2a", Math.round(10 * k), 3.5 * k)}</g>` : ""}
${parts.join("\n")}
</svg>`;
  return { svg, headlineTop };
}

async function compor(
  f: Formato,
  plate: Buffer,
  pessoas: Pessoa[],
  logo: Buffer | null,
  t: QuadroTheme,
  h: Headline,
  nomes: string,
  handles: string,
  data: string
): Promise<Buffer> {
  const texto = textoSvg(f, t, h, nomes, handles, data);
  const selo = seloSvg(t);
  const topoPessoas = f.safeTop + selo.h + (f.nomes ? 30 : 16);
  // A pessoa desce para trás da headline: a faixa escura e o esmaecimento escondem o corte.
  // Na 16:9 desce mais, como nas thumbs dos cortes, senão fica pequena.
  const basePessoas = Math.min(f.h, Math.round(texto.headlineTop + f.h * (f.nomes ? 0.06 : 0.3)));
  const layers: OverlayOptions[] = [
    ...(await camadasPessoas(pessoas, f, t, topoPessoas, basePessoas)),
    { input: Buffer.from(texto.svg), left: 0, top: 0 },
    { input: Buffer.from(selo.svg), left: 30, top: f.safeTop },
  ];
  if (logo) {
    const { width = 0 } = await sharp(logo).metadata();
    layers.push({ input: logo, left: f.w - width - 30, top: f.safeTop });
  }
  const flat = await sharp(plate).resize(f.w, f.h, { fit: "cover" }).composite(layers).png().toBuffer();
  return jpegFinal(flat, f.w, f.h);
}

export type ArteInput = {
  quadro: string;
  inicio: string;
  convidados: { nome: string; instagram: string | null }[];
  fotos: (Buffer | null)[];
  /** Logo cru, como está no Storage. */
  logo: Buffer | null;
  headline: Headline;
  /** Fundos 16:9 e 9:16; sem eles, o fundo simples do quadro. */
  plates?: { h: Buffer; v: Buffer };
  hoje?: boolean;
};

/** Renderiza o conjunto, sem banco nem Storage. */
export async function renderArtes(a: ArteInput): Promise<{ feed: Buffer; story: Buffer; thumb: Buffer }> {
  const t = themeOf(a.quadro);
  const pessoas: Pessoa[] = [];
  for (const foto of a.fotos) {
    if (!foto) continue;
    // Foto sem gente reconhecível (logo, paisagem) fica de fora da arte.
    const p = await recorte(foto).catch(() => null);
    if (p) pessoas.push(p);
  }
  const logo = a.logo ? await prepareLogo(a.logo) : null;
  const plates = a.plates ?? { h: fallbackPlate(1280, 720, t), v: fallbackPlate(1080, 1920, t) };
  const nomes = `COM ${a.convidados.map((c) => c.nome.trim()).join(" E ")}`.toUpperCase();
  const handles = a.convidados.filter((c) => c.instagram).map((c) => `@${c.instagram}`).join("  ");
  const data = dataLabel(a.inicio, a.hoje);

  const [feed, story, thumb] = await Promise.all(
    FORMATOS.map((f) => compor(f, f.key === "thumb" ? plates.h : plates.v, pessoas, logo, t, a.headline, nomes, handles, data))
  );
  return { feed, story, thumb };
}

/** Foto do apresentador neste episódio: a que a equipe subiu para ele, senão a do cadastro. */
function fotoApresentador(a: Apresentador, materiais: Material[]): string | null {
  const m = materiais.find((x) => x.tipo === "apresentador" && x.apresentador_id === a.id && x.usar_na_arte);
  return m?.path ?? a.foto_path;
}

/** Foto do convidado: a principal do briefing, senão a primeira que ele mandou nos materiais, senão a do Instagram. */
async function imagemConvidado(c: Convidado, materiais: Material[]): Promise<Img | null> {
  const m = materiais.find((x) => x.tipo === "foto" && x.convidado_id === c.id && x.usar_na_arte);
  for (const path of [c.foto_path, m?.path]) {
    if (!path) continue;
    const img = await imagemDe(path);
    if (img) return img;
  }
  const raw = await fotoDe(c);
  return raw ? { buf: raw, mime: "image/jpeg" } : null;
}

export type OpcoesArte = { modo: ArteModo; hoje: boolean };

/** Logo do quadro (Configurar da Produção); sem ele, o do PFC. */
export async function logoDoQuadro(quadro: string): Promise<Buffer | null> {
  return (await (isQuadroId(quadro) ? download(quadroLogoPath(quadro)) : Promise.resolve(null))) ?? download(LOGO_PATH);
}

/** Pessoas da arte, apresentadores primeiro (ficam à esquerda). */
/**
 * Pessoas da arte, apresentadores primeiro (ficam à esquerda). Quem não tem
 * foto fica de fora — a não ser que o episódio tenha frames marcados: aí a
 * pessoa entra sem foto e a IA a tira dos frames (PFC Visita).
 */
export async function pessoasDaArte(ep: Episodio, convidados: Convidado[], materiais: Material[]): Promise<PessoaCena[]> {
  const hosts = await apresentadoresDoEpisodio(ep);
  const comFrames = materiais.some((m) => m.tipo === "frame" && m.usar_na_arte);
  const out: PessoaCena[] = [];
  for (const a of hosts) {
    const path = fotoApresentador(a, materiais);
    const img = path ? await imagemDe(path) : null;
    if (img || comFrames) out.push({ nome: a.nome, papel: a.papel, host: true, img });
  }
  for (const c of convidados.slice(0, 3)) {
    const img = await imagemConvidado(c, materiais);
    if (img || comFrames) out.push({ nome: c.nome, papel: c.cargo || "CONVIDADO", host: false, img });
  }
  return out;
}

/** Frames do episódio marcados para a arte (até 3). */
async function framesDaArte(materiais: Material[]): Promise<Img[]> {
  const out: Img[] = [];
  for (const m of materiais.filter((x) => x.tipo === "frame" && x.usar_na_arte).slice(0, 3)) {
    const img = await imagemDe(m.path);
    if (img) out.push(img);
  }
  return out;
}

/** Gera o conjunto nos três formatos e grava em agenda_artes. */
export async function gerarArtes(ep: Episodio, convidados: Convidado[], h: Headline, actor: string, opts: OpcoesArte): Promise<Arte> {
  const t = themeOf(ep.quadro);
  const lista = convidados.slice(0, 3);
  const materiais = await materiaisDe(ep.id);
  const [pessoas, logoRaw] = await Promise.all([pessoasDaArte(ep, lista, materiais), logoDoQuadro(ep.quadro)]);

  let out: { feed: Buffer; story: Buffer; thumb: Buffer };
  if (opts.modo === "ia") {
    if (!isGeminiConfigured()) throw new Error("A arte por IA precisa do Gemini (GOOGLE_AI_API_KEY).");
    const refs: RefCena[] = [];
    for (const m of materiais.filter((x) => (x.tipo === "logo" || x.tipo === "referencia") && x.usar_na_arte).slice(0, 4)) {
      const img = await imagemDe(m.path);
      if (img) refs.push({ legenda: m.tipo === "logo" ? `logo enviado pelo convidado (${m.nome}) — pode aparecer pequeno, perto do nome dele` : `referência enviada para o cenário (${m.nome})`, img });
    }
    const a = ep.briefing?.arte;
    out = await gerarCenas({
      frames: await framesDaArte(materiais),
      gravado: !!ep.video_drive_id,
      quadro: t,
      inicio: ep.inicio,
      hoje: opts.hoje,
      pessoas,
      logo: logoRaw ? { buf: logoRaw, mime: "image/png" } : null,
      refs,
      headline: h,
      topicos: a?.topicos || null,
      sub: a?.sub || null,
      cena: a?.cena || null,
      tema: ep.tema,
    });
  } else {
    const plates = isGeminiConfigured()
      ? await Promise.all([renderPlate(platePrompt(t, false), "16:9"), renderPlate(platePrompt(t, true), "9:16")]).then(([h, v]) => ({ h, v }))
      : undefined;
    out = await renderArtes({
      quadro: ep.quadro,
      inicio: ep.inicio,
      convidados: lista.length ? lista : pessoas.map((p) => ({ nome: p.nome, instagram: null })),
      // O recorte precisa de foto de cada pessoa; quem só está nos frames fica de fora.
      fotos: pessoas.map((p) => p.img?.buf ?? null),
      logo: logoRaw,
      headline: h,
      plates,
      hoje: opts.hoje,
    });
  }

  const id = randomUUID();
  const dir = `agenda/${ep.id}/${id}`;
  await Promise.all([
    upload(`${dir}/feed.jpg`, out.feed, "image/jpeg"),
    upload(`${dir}/story.jpg`, out.story, "image/jpeg"),
    upload(`${dir}/thumb.jpg`, out.thumb, "image/jpeg"),
  ]);
  const row = {
    id,
    episodio_id: ep.id,
    feed_path: `${dir}/feed.jpg`,
    story_path: `${dir}/story.jpg`,
    thumb_path: `${dir}/thumb.jpg`,
    l1: h.l1,
    l2: h.l2,
    l3: h.l3 ?? null,
    modo: opts.modo,
    created_by: actor,
  };
  const { data: saved, error } = await db().from("agenda_artes").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return saved as Arte;
}
