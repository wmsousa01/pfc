import "server-only";
import path from "path";
import opentype from "opentype.js";
import sharp, { type OverlayOptions } from "sharp";
import { site, social, youtube } from "@/lib/config";
import { anton, prepareLogo } from "@/lib/producao/compose";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { LOGO_PATH, download } from "@/lib/producao/store";
import { TAMANHOS, type FormatoPost, type NumerosPost, type PedidoPost } from "./tipos";

/**
 * Artes dos posts estáticos, no mesmo método das outras artes do site: texto
 * vetorizado pelo opentype (o servidor não tem fonte instalada) e imagem
 * final pelo sharp. A cor de destaque e o selo vêm do quadro escolhido.
 */

const MX = 84;
const OURO = "#FFD700";
const FUNDO = "#0a0a0a";

let noto: opentype.Font | null = null;
function corpo(): opentype.Font {
  noto ??= opentype.loadSync(path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"));
  return noto;
}

type Fonte = "titulo" | "corpo";
const fonte = (f: Fonte) => (f === "titulo" ? anton() : corpo());

/** Sem emoji: as fontes não têm os desenhos e sairia um quadradinho. */
function limpo(t: string): string {
  return t.replace(new RegExp("[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}]", "gu"), "").replace(/\s+/g, " ").trim();
}

function quebrar(f: Fonte, texto: string, tam: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of limpo(texto).split(" ").filter(Boolean)) {
    const prox = atual ? `${atual} ${palavra}` : palavra;
    if (atual && fonte(f).getAdvanceWidth(prox, tam) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else atual = prox;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Maior tamanho em que o texto cabe em `maxLinhas` linhas, sem palavra estourando a largura. */
function caber(f: Fonte, texto: string, max: number, min: number, largura: number, maxLinhas: number) {
  for (let tam = max; tam > min; tam -= 4) {
    const linhas = quebrar(f, texto, tam, largura);
    const larga = linhas.some((l) => fonte(f).getAdvanceWidth(l, tam) > largura);
    if (linhas.length <= maxLinhas && !larga) return { tam, linhas };
  }
  return { tam: min, linhas: quebrar(f, texto, min, largura).slice(0, maxLinhas) };
}

function linha(f: Fonte, t: string, x: number, y: number, tam: number, cor: string, alinhar: "start" | "end" | "middle" = "start") {
  const fo = fonte(f);
  const w = fo.getAdvanceWidth(t, tam);
  const x0 = alinhar === "end" ? x - w : alinhar === "middle" ? x - w / 2 : x;
  return `<path d="${fo.getPath(t, x0, y, tam).toPathData(2)}" fill="${cor}"/>`;
}

/** Bloco de várias linhas; devolve o SVG e onde o bloco termina. */
function bloco(f: Fonte, linhas: string[], x: number, y: number, tam: number, cor: string, entre = 1.15) {
  const partes = linhas.map((l, i) => linha(f, l, x, y + i * tam * entre, tam, cor));
  return { svg: partes.join(""), fim: y + (linhas.length - 1) * tam * entre };
}

type Tema = { destaque: string; nome: string; seloFundo: string; seloTexto: string };

function tema(quadro: string): Tema {
  if (!isQuadroId(quadro)) return { destaque: OURO, nome: site.brand, seloFundo: OURO, seloTexto: "#111111" };
  const q = QUADROS[quadro];
  return { destaque: q.accent[1], nome: q.name, seloFundo: q.selo.bg, seloTexto: q.selo.text };
}

const inteiro = (n: number) => Math.round(n).toLocaleString("pt-BR");
function compacto(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MI`;
  if (n >= 10_000) return `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MIL`;
  return inteiro(n);
}

/** Moldura comum: faixa de cor, selo do quadro, rodapé com o perfil e a contagem do carrossel. */
function moldura(t: Tema, w: number, h: number, pagina: string | null) {
  const selo = t.nome.toUpperCase();
  const tamSelo = 30;
  const larg = anton().getAdvanceWidth(selo, tamSelo) + 44;
  return [
    `<rect x="0" y="0" width="${w}" height="14" fill="${t.destaque}"/>`,
    `<rect x="${MX}" y="70" width="${larg}" height="56" rx="10" fill="${t.seloFundo}"/>`,
    linha("titulo", selo, MX + 22, 110, tamSelo, t.seloTexto),
    `<rect x="${MX}" y="${h - 118}" width="${w - 2 * MX}" height="2" fill="#ffffff22"/>`,
    linha("corpo", social.instagramHandle, MX, h - 62, 32, "#ffffffaa"),
    pagina ? linha("corpo", pagina, w - MX, h - 62, 32, "#ffffff77", "end") : "",
  ].join("");
}

async function finalizar(w: number, h: number, partes: string[], fundo: OverlayOptions[] = []): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${partes.join("")}</svg>`;
  const camadas: OverlayOptions[] = [...fundo, { input: Buffer.from(svg), left: 0, top: 0 }];
  const logoBruto = await download(LOGO_PATH).catch(() => null);
  if (logoBruto) {
    const logo = await prepareLogo(logoBruto).catch(() => null);
    if (logo) {
      const { width = 0, height = 0 } = await sharp(logo).metadata();
      const escala = Math.min(1, 150 / Math.max(1, width), 76 / Math.max(1, height));
      const pequeno = await sharp(logo).resize(Math.round(width * escala), Math.round(height * escala)).png().toBuffer();
      camadas.push({ input: pequeno, left: w - MX - Math.round(width * escala), top: 60 });
    }
  }
  return sharp({ create: { width: w, height: h, channels: 3, background: FUNDO } }).composite(camadas).jpeg({ quality: 92 }).toBuffer();
}

/** Brilho suave da cor do quadro no fundo, para a arte sem foto não ficar chapada. */
function brilho(t: Tema, w: number, h: number, cx: number, cy: number) {
  return `<defs><radialGradient id="b" cx="${cx}" cy="${cy}" r="0.75"><stop offset="0" stop-color="${t.destaque}" stop-opacity="0.28"/><stop offset="1" stop-color="${t.destaque}" stop-opacity="0"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#b)"/>`;
}

function variacaoTexto(v: number | null): string | null {
  if (v == null || Math.abs(v) < 1) return null;
  return `${v > 0 ? "+" : ""}${Math.round(v)}% sobre o período anterior`;
}

// ---------------------------------------------------------------- números do canal

async function slidesNumeros(p: Extract<PedidoPost, { tipo: "numeros" }>): Promise<Buffer[]> {
  const { w, h } = TAMANHOS["4:5"];
  const t = tema(p.quadro);
  const n: NumerosPost = p.numeros;
  const largura = w - 2 * MX;

  const telas: ((pag: string) => string[])[] = [];

  if (p.slides.capa) {
    telas.push((pag) => {
      const per = caber("titulo", n.periodo.toUpperCase(), 140, 70, largura, 2);
      const topo = 560;
      const b = bloco("titulo", per.linhas, MX, topo + 150, per.tam, t.destaque, 1.05);
      return [
        brilho(t, w, h, 0.2, 0.35),
        moldura(t, w, h, pag),
        linha("titulo", "NÚMEROS DO CANAL", MX, topo, 96, "#ffffff"),
        b.svg,
        linha("corpo", "Arraste para ver como foi", MX, b.fim + 110, 38, "#ffffffaa"),
      ];
    });
  }

  const numero = (rotulo: string, valor: string, sub: string | null, extra: string | null) => (pag: string) => {
    const v = caber("titulo", valor, 300, 120, largura, 1);
    const partes = [brilho(t, w, h, 0.85, 0.2), moldura(t, w, h, pag), linha("corpo", rotulo.toUpperCase(), MX, 470, 40, "#ffffffaa")];
    partes.push(linha("titulo", v.linhas[0] ?? valor, MX, 470 + 40 + v.tam * 0.92, v.tam, t.destaque));
    let y = 470 + 40 + v.tam * 0.92 + 100;
    if (sub) {
      partes.push(`<rect x="${MX}" y="${y - 50}" width="${corpo().getAdvanceWidth(sub, 36) + 48}" height="70" rx="35" fill="#ffffff14"/>`);
      partes.push(linha("corpo", sub, MX + 24, y, 36, "#ffffff"));
      y += 110;
    }
    if (extra) partes.push(bloco("corpo", quebrar("corpo", extra, 40, largura), MX, y, 40, "#ffffffaa").svg);
    return partes;
  };

  if (p.slides.views) telas.push(numero("Views no YouTube", compacto(n.views), variacaoTexto(n.viewsVar), n.shortsPct != null ? `${Math.round(n.shortsPct)}% delas vieram dos Shorts.` : null));
  if (p.slides.horas) telas.push(numero("Horas assistidas", `${inteiro(n.horas)} H`, variacaoTexto(n.horasVar), "Tempo que vocês passaram com a gente no canal."));
  if (p.slides.inscritos) {
    telas.push(
      n.novosInscritos > 0
        ? numero("Novos inscritos", `+${inteiro(n.novosInscritos)}`, null, n.inscritosTotal ? `Já somos ${inteiro(n.inscritosTotal)} no canal. Obrigado!` : "Obrigado por chegar!")
        : numero("Inscritos no canal", inteiro(n.inscritosTotal ?? 0), null, "Obrigado por acompanhar!")
    );
  }
  if (p.slides.top && n.top.length) {
    telas.push((pag) => {
      const partes = [moldura(t, w, h, pag), linha("titulo", "OS MAIS VISTOS", MX, 300, 96, "#ffffff")];
      let y = 420;
      n.top.slice(0, 3).forEach((v, i) => {
        partes.push(linha("titulo", String(i + 1), MX, y + 120, 150, t.destaque));
        const texto = caber("corpo", v.titulo, 44, 32, largura - 150, 3);
        const b = bloco("corpo", texto.linhas, MX + 150, y + 50, texto.tam, "#ffffff");
        partes.push(b.svg);
        partes.push(linha("corpo", `${inteiro(v.views)} views`, MX + 150, b.fim + 56, 32, "#ffffff88"));
        y = Math.max(y + 230, b.fim + 110);
      });
      return partes;
    });
  }
  if (p.slides.fechamento) {
    telas.push((pag) => {
      const c = caber("titulo", (p.chamada || "Obrigado por assistir").toUpperCase(), 150, 80, largura, 3);
      const b = bloco("titulo", c.linhas, MX, 560, c.tam, "#ffffff", 1.05);
      return [
        brilho(t, w, h, 0.5, 0.45),
        moldura(t, w, h, pag),
        b.svg,
        linha("corpo", `youtube.com/${youtube.handle}`, MX, b.fim + 120, 40, t.destaque),
        linha("corpo", "Link na bio", MX, b.fim + 180, 36, "#ffffffaa"),
      ];
    });
  }

  if (!telas.length) throw new Error("Escolha pelo menos um slide.");
  return Promise.all(telas.map((tela, i) => finalizar(w, h, tela(telas.length > 1 ? `${i + 1}/${telas.length}` : ""))));
}

// ---------------------------------------------------------------- cartaz (datas e avisos)

async function cartaz(p: Extract<PedidoPost, { tipo: "cartaz" }>): Promise<Buffer> {
  const { w, h } = TAMANHOS[p.formato as FormatoPost] ?? TAMANHOS["4:5"];
  const t = tema(p.quadro);
  const largura = w - 2 * MX;
  const fundo: OverlayOptions[] = [];
  const partes: string[] = [];

  const foto = p.foto?.startsWith("data:image/") ? Buffer.from(p.foto.slice(p.foto.indexOf(",") + 1), "base64") : null;
  if (foto) {
    fundo.push({ input: await sharp(foto).rotate().resize(w, h, { fit: "cover", position: "attention" }).toBuffer(), left: 0, top: 0 });
  } else {
    partes.push(brilho(t, w, h, 0.25, 0.3));
  }

  const titulo = caber("titulo", (p.titulo || " ").toUpperCase(), h > 1400 ? 190 : 160, 70, largura, 4);
  const mensagem = p.mensagem ? caber("corpo", p.mensagem, 44, 32, largura, 5) : { tam: 44, linhas: [] as string[] };
  const altTitulo = titulo.linhas.length * titulo.tam * 1.02;
  const altMensagem = mensagem.linhas.length ? 50 + mensagem.linhas.length * mensagem.tam * 1.3 : 0;
  const altAssinatura = p.assinatura ? 90 : 0;
  // Com foto, o texto mora embaixo; sem foto, fica no meio da arte.
  const base = foto ? h - 170 : Math.round(h / 2 + (altTitulo + altMensagem) / 2);
  let y = base - altAssinatura - altMensagem - altTitulo + titulo.tam * 0.9;

  if (foto) {
    // Escurece a partir de onde o texto começa: legível mesmo com título longo,
    // sem cobrir o rosto no alto da foto.
    const topoTexto = Math.max(0, y - titulo.tam * 0.9 - (p.chapeu ? 130 : 40));
    const ini = Math.max(0, topoTexto - 260);
    partes.push(
      `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${ini}" x2="0" y2="${h}"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="${((topoTexto - ini) / (h - ini)).toFixed(3)}" stop-color="#000" stop-opacity="0.78"/><stop offset="1" stop-color="#000" stop-opacity="0.95"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>`
    );
  }

  if (p.chapeu) {
    partes.push(`<rect x="${MX}" y="${y - titulo.tam * 0.9 - 92}" width="70" height="6" fill="${t.destaque}"/>`);
    partes.push(linha("corpo", limpo(p.chapeu).toUpperCase(), MX, y - titulo.tam * 0.9 - 30, 34, foto ? "#ffffff" : t.destaque));
  }
  const b = bloco("titulo", titulo.linhas, MX, y, titulo.tam, "#ffffff", 1.02);
  partes.push(b.svg);
  y = b.fim + 50 + mensagem.tam;
  if (mensagem.linhas.length) {
    const m = bloco("corpo", mensagem.linhas, MX, y, mensagem.tam, "#ffffffdd", 1.3);
    partes.push(m.svg);
    y = m.fim;
  }
  if (p.assinatura) partes.push(linha("corpo", limpo(p.assinatura), MX, y + 90, 34, t.destaque));
  partes.push(moldura(t, w, h, null));
  return finalizar(w, h, partes, fundo);
}

// ---------------------------------------------------------------- carrossel de texto

async function slidesTexto(p: Extract<PedidoPost, { tipo: "texto" }>): Promise<Buffer[]> {
  const { w, h } = TAMANHOS["4:5"];
  const t = tema(p.quadro);
  const largura = w - 2 * MX;
  const itens = p.itens.filter((i) => i.titulo.trim() || i.texto.trim());
  const telas: ((pag: string) => string[])[] = [];

  telas.push((pag) => {
    const c = caber("titulo", (p.titulo || " ").toUpperCase(), 170, 80, largura, 4);
    const b = bloco("titulo", c.linhas, MX, 470, c.tam, "#ffffff", 1.02);
    const partes = [brilho(t, w, h, 0.2, 0.3), moldura(t, w, h, pag), b.svg];
    if (p.subtitulo) partes.push(bloco("corpo", caber("corpo", p.subtitulo, 44, 32, largura, 3).linhas, MX, b.fim + 110, 42, t.destaque, 1.3).svg);
    if (itens.length) partes.push(linha("corpo", "Arraste para o lado", MX, h - 190, 34, "#ffffff88"));
    return partes;
  });

  itens.forEach((item, i) => {
    telas.push((pag) => {
      const tit = caber("titulo", (item.titulo || " ").toUpperCase(), 100, 56, largura, 3);
      const partes = [moldura(t, w, h, pag), linha("titulo", String(i + 1).padStart(2, "0"), MX, 400, 170, t.destaque)];
      const b = bloco("titulo", tit.linhas, MX, 400 + 60 + tit.tam, tit.tam, "#ffffff", 1.04);
      partes.push(b.svg);
      if (item.texto) {
        const tx = caber("corpo", item.texto, 46, 32, largura, 9);
        partes.push(bloco("corpo", tx.linhas, MX, b.fim + 70 + tx.tam, tx.tam, "#ffffffcc", 1.35).svg);
      }
      return partes;
    });
  });

  if (p.chamada) {
    telas.push((pag) => {
      const c = caber("titulo", p.chamada.toUpperCase(), 140, 70, largura, 3);
      return [brilho(t, w, h, 0.5, 0.45), moldura(t, w, h, pag), bloco("titulo", c.linhas, MX, 600, c.tam, "#ffffff", 1.05).svg];
    });
  }

  return Promise.all(telas.map((tela, i) => finalizar(w, h, tela(telas.length > 1 ? `${i + 1}/${telas.length}` : ""))));
}

export async function renderPost(p: PedidoPost): Promise<Buffer[]> {
  if (p.tipo === "numeros") return slidesNumeros(p);
  if (p.tipo === "texto") return slidesTexto(p);
  return [await cartaz(p)];
}
