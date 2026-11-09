import "server-only";
import { X509Certificate } from "crypto";
import http from "http";
import https from "https";
import tls from "tls";
import { getConfig } from "@/lib/producao/store";

/**
 * Notícias dos sites das prefeituras para a pauta do PFC News. É de lá que
 * sai a maior parte do que o apresentador usa (zeladoria, obras, saúde,
 * Refis, concursos), com a foto oficial de cada notícia.
 *
 * Lê só o que o site publica para qualquer visitante: a lista de notícias e
 * a exportação em texto de cada uma, com um User-Agent que diz quem somos.
 * Site atrás de desafio anti-robô (Cloudflare "Just a moment...") não é
 * contornado: vira erro explicado, e a fonte dessa prefeitura fica sendo o
 * Instagram oficial.
 */

export const SITES_KEY = "news_sites";
export const SITES_PADRAO = ["https://mogiguacu.sp.gov.br/", "https://www.mogimirim.sp.gov.br/"];

const UA = "PFCNewsBot/1.0 (+https://www.pfctv.com.br)";
/** Notícias lidas por site: mais que isso numa semana é agenda de evento, não pauta. */
const MAX_POR_SITE = 25;

export type ArtigoSite = { id: string; site: string; url: string; titulo: string; data: string; texto: string; imagem: string | null };

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 200);

/** "https://www.mogimirim.sp.gov.br/x" → "https://www.mogimirim.sp.gov.br" */
function origem(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    return u.protocol === "https:" || u.protocol === "http:" ? u.origin : null;
  } catch {
    return null;
  }
}

export async function sitesNews(): Promise<string[]> {
  const v = await getConfig(SITES_KEY);
  const lista = v ? v.split(/[\s,]+/) : SITES_PADRAO;
  return Array.from(new Set(lista.map(origem).filter((o): o is string => !!o)));
}

/** O host sem "www.": é como a fonte aparece no GC ("mogimirim.sp.gov.br"). */
export const nomeDoSite = (url: string) => new URL(url).hostname.replace(/^www\./, "");

class Bloqueado extends Error {}

/** Os sites das prefeituras misturam UTF-8 e ISO-8859-1 conforme a página. */
function decodificar(buf: ArrayBuffer, contentType: string | null): string {
  const cs = contentType?.match(/charset=([\w-]+)/i)?.[1]?.toLowerCase();
  if (cs && cs !== "utf-8" && cs !== "utf8") return new TextDecoder(cs).decode(buf);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("iso-8859-1").decode(buf);
  }
}

type Resposta = { status: number; headers: http.IncomingHttpHeaders; corpo: Buffer };

function pedir(url: string, ca?: string[]): Promise<Resposta> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": UA, "Accept-Language": "pt-BR" }, timeout: 15_000, ...(ca ? { ca } : {}) }, (res) => {
      const partes: Buffer[] = [];
      res.on("data", (c: Buffer) => partes.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, corpo: Buffer.concat(partes) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
    req.on("error", reject);
  });
}

/** Cadeia completa por host, para servidor que não manda o certificado intermediário. */
const cadeias = new Map<string, string[]>();

/**
 * Servidor que só manda o próprio certificado (o de Mogi Mirim) quebra no
 * Node, que não busca o intermediário como o navegador e o curl do Windows
 * fazem. Aqui se faz o mesmo que eles: lê no certificado o endereço do
 * emissor (AIA, "CA Issuers"), baixa o intermediário e refaz o pedido com
 * a verificação ligada, só que com a cadeia completa. A conexão que lê o
 * certificado não envia nada: só serve para saber de onde vem o emissor.
 */
async function cadeiaPorAia(host: string): Promise<string[]> {
  const cache = cadeias.get(host);
  if (cache) return cache;
  const aia = await new Promise<string | null>((resolve, reject) => {
    const s = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false }, () => {
      const info = s.getPeerCertificate().infoAccess?.["CA Issuers - URI"]?.[0] ?? null;
      s.end();
      resolve(info);
    });
    s.setTimeout(10_000, () => s.destroy(new Error("tempo esgotado")));
    s.on("error", reject);
  });
  if (!aia || !/^https?:\/\//.test(aia)) throw new Error("certificado do site incompleto e sem o endereço do emissor");
  const der = await new Promise<Buffer>((resolve, reject) => {
    (aia.startsWith("https") ? https : http)
      .get(aia, { timeout: 10_000 }, (res) => {
        const partes: Buffer[] = [];
        res.on("data", (c: Buffer) => partes.push(c));
        res.on("end", () => resolve(Buffer.concat(partes)));
      })
      .on("error", reject);
  });
  const cadeia = [...tls.rootCertificates, new X509Certificate(der).toString()];
  cadeias.set(host, cadeia);
  return cadeia;
}

async function responder(url: string): Promise<Resposta> {
  const host = new URL(url).hostname;
  try {
    return await pedir(url, cadeias.get(host));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "UNABLE_TO_VERIFY_LEAF_SIGNATURE") throw e;
    return pedir(url, await cadeiaPorAia(host));
  }
}

/** Foto de uma notícia do site (o mesmo caminho de certificado das páginas). */
export async function baixarImagem(url: string): Promise<{ buf: Buffer; mime: string } | null> {
  const r = await responder(url);
  const mime = String(r.headers["content-type"] ?? "").split(";")[0];
  return r.status === 200 && mime.startsWith("image/") ? { buf: r.corpo, mime } : null;
}

async function baixar(url: string): Promise<string> {
  const r = await responder(url);
  const corpo = decodificar(new Uint8Array(r.corpo).buffer, (r.headers["content-type"] as string | undefined) ?? null);
  if (r.status === 403 || r.status === 503) {
    if (/Just a moment|cf-chl|challenge-platform/i.test(corpo) || String(r.headers.server).toLowerCase() === "cloudflare") {
      throw new Bloqueado("o site está atrás de proteção anti-robô (Cloudflare) e não deixa a leitura automática");
    }
  }
  if (r.status >= 300 && r.status < 400 && r.headers.location) return baixar(new URL(r.headers.location, url).toString());
  if (r.status < 200 || r.status >= 300) throw new Error(`HTTP ${r.status}`);
  return corpo;
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "6 de novembro de 2026" → "2026-11-06T12:00:00-03:00" */
function dataPorExtenso(s: string): string | null {
  const m = s.toLowerCase().match(/(\d{1,2}) de ([a-zç]+) de (\d{4})/);
  const mes = m ? MESES.indexOf(m[2]) : -1;
  if (!m || mes < 0) return null;
  return `${m[3]}-${String(mes + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}T12:00:00-03:00`;
}

const semTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const meta = (html: string, nome: string) =>
  html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${nome}["'][^>]*content=["']([^"']*)["']`, "i"))?.[1] ??
  html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${nome}["']`, "i"))?.[1] ??
  null;

/**
 * Uma notícia avulsa de qualquer site, para a equipe pôr no roteiro: título,
 * foto (og:image) e o texto dos parágrafos. Mesma regra dos sites das
 * prefeituras: o que o site mostra para qualquer visitante, e site com
 * bloqueio anti-robô vira erro pedindo para colar o texto.
 */
export async function lerPagina(url: string): Promise<{ titulo: string | null; imagem: string | null; texto: string }> {
  const html = await baixar(url);
  const titulo = semTags(meta(html, "og:title") ?? html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || null;
  const img = meta(html, "og:image");
  const corpo = html.replace(/<(script|style|nav|header|footer|aside)[\s\S]*?<\/\1>/gi, " ");
  const paragrafos = Array.from(corpo.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((m) => semTags(m[1]))
    .filter((p) => p.length > 40);
  const texto = (paragrafos.join("\n\n") || semTags(meta(html, "og:description") ?? "")).slice(0, 8000);
  return { titulo, imagem: img ? new URL(img, url).toString() : null, texto };
}

/**
 * Portal DynamikaWeb (o de Mogi Mirim e de várias prefeituras paulistas):
 * /noticia/index?page=N lista 20 por página com id, título, data e foto;
 * /noticia/exportar-txt?id=N dá o texto puro, com título, secretaria e data
 * no cabeçalho.
 */
async function dynamika(base: string, desde: number): Promise<ArtigoSite[]> {
  const site = nomeDoSite(base);
  const itens: Omit<ArtigoSite, "texto">[] = [];
  for (let page = 1; page <= 3 && itens.length < MAX_POR_SITE; page++) {
    const html = await baixar(`${base}/noticia/index?page=${page}`);
    const blocos = html.split(/data-key="/).slice(1);
    if (page === 1 && blocos.length === 0) throw new Error("formato do site não reconhecido (não é um portal com /noticia/index)");
    let antigas = 0;
    for (const b of blocos) {
      const id = b.match(/^(\d+)"/)?.[1];
      const href = b.match(/href="(\/noticia\/view\/\d+\/[^"]*)"/)?.[1];
      const titulo = semTags(b.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] ?? "");
      const data = dataPorExtenso(semTags(b.match(/<\/h4>([\s\S]{0,200})/)?.[1] ?? ""));
      if (!id || !href || !titulo || !data) continue;
      if (new Date(data).getTime() < desde) {
        antigas++;
        continue;
      }
      // Na lista vem a foto média; a "maior" é a mesma do og:image da notícia.
      const img = b.match(/<img[^>]+src="([^"]+)"/)?.[1]?.replace("/media_", "/maior_");
      itens.push({ id, site, url: `${base}${href}`, titulo, data, imagem: img ? new URL(img, base).toString() : null });
    }
    if (antigas > 0) break;
  }
  const out: ArtigoSite[] = [];
  for (const it of itens.slice(0, MAX_POR_SITE)) {
    try {
      const txt = await baixar(`${base}/noticia/exportar-txt?id=${it.id}`);
      // Cabeçalho: título, linha em branco, "Secretarias: ...", "Data de Publicação: ...".
      const texto = txt
        .split(/\r?\n/)
        .filter((l, i) => i > 0 && !/^(Secretarias?|Data de Publica\S*):/i.test(l.trim()))
        .join("\n")
        .trim();
      out.push({ ...it, texto: texto || it.titulo });
    } catch {
      out.push({ ...it, texto: it.titulo });
    }
  }
  return out;
}

/** Notícias dos últimos `dias` de cada site. Site que falha não derruba os outros. */
export async function coletarSites(dias: number): Promise<{ artigos: ArtigoSite[]; erros: string[] }> {
  const desde = Date.now() - dias * 86_400_000;
  const artigos: ArtigoSite[] = [];
  const erros: string[] = [];
  for (const base of await sitesNews()) {
    try {
      artigos.push(...(await dynamika(base, desde)));
    } catch (e) {
      erros.push(`${nomeDoSite(base)}: ${msg(e)}${e instanceof Bloqueado ? "; a fonte dessa prefeitura fica sendo o Instagram oficial" : ""}`);
    }
  }
  return { artigos, erros };
}
