import "server-only";
import sharp, { type OverlayOptions } from "sharp";
import { anton, fit, prepareLogo } from "@/lib/producao/compose";
import { LOGO_PATH, db, download, getConfig, setConfig, signedUrls, upload } from "@/lib/producao/store";
import { analyticsReport, channelStatisticsMine, videoTitles } from "@/lib/producao/youtube-api";
import { MetaError, igContainerStatus, igCreateImage, igPublish } from "./meta";
import { horaBrasilia, limitesDaSemana, segundaDe } from "./ritmo";
import { activeConnection, revokeConnection } from "./store";

/**
 * "Números da semana": um post por semana mostrando a performance do canal.
 *
 * Toda terça a partir das 10h a fila (cron social) gera o rascunho da semana
 * anterior (segunda a domingo) com os números do YouTube Analytics. A arte e
 * a legenda ficam em /admin/marketing/semana para alguém revisar e programar.
 * Nada vai ao ar sem aprovação. Terça porque o Analytics leva ~2 dias para
 * fechar um dia.
 *
 * O estado fica em producao_config (`numeros_semana:<segunda>`), sem tabela nova.
 */

export type Metricas = { views: number; horas: number; ganhos: number; perdidos: number; likes: number; shares: number };

export type NumerosSemana = {
  segunda: string;
  /** "08 a 14/11" */
  periodo: string;
  /** O Analytics ainda não fechou todos os dias da semana. */
  parcial: boolean;
  atual: Metricas;
  anterior: Metricas;
  inscritosTotal: number | null;
  top: { id: string; titulo: string; views: number }[];
  /** Fatia das views que veio de Shorts (0–100). */
  shortsPct: number | null;
};

export type EstadoNumeros = {
  status: "rascunho" | "agendado" | "publicando" | "publicado" | "erro";
  numeros: NumerosSemana | null;
  arte_path: string | null;
  legenda: string;
  publicar_em: string | null;
  post_url: string | null;
  erro: string | null;
  gerado_em: string;
};

const DIA = 86_400_000;
const chave = (segunda: string) => `numeros_semana:${segunda}`;
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10);
const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Variação em % (null sem base de comparação). */
export function variacao(atual: number, anterior: number): number | null {
  return anterior > 0 ? ((atual - anterior) / anterior) * 100 : null;
}

/** Semana fechada mais recente (a anterior à atual). */
export function semanaPassada(now = Date.now()): string {
  return ymd(new Date(`${segundaDe(now)}T12:00:00Z`).getTime() - 7 * DIA);
}

function periodoLabel(segunda: string): string {
  const ini = new Date(`${segunda}T12:00:00Z`);
  const fim = new Date(ini.getTime() + 6 * DIA);
  const dd = (d: Date) => String(d.getUTCDate()).padStart(2, "0");
  const mm = (d: Date) => String(d.getUTCMonth() + 1).padStart(2, "0");
  return ini.getUTCMonth() === fim.getUTCMonth()
    ? `${dd(ini)} a ${dd(fim)}/${mm(fim)}`
    : `${dd(ini)}/${mm(ini)} a ${dd(fim)}/${mm(fim)}`;
}

/** Título de Short sem as hashtags. */
function limpaTitulo(t: string): string {
  // Sem hashtags e sem emoji (a Anton não tem os glifos: viraria quadradinho na arte).
  const semEmoji = t.replace(new RegExp("[\\p{Extended_Pictographic}\\u{FE0F}\\u{200D}]", "gu"), "");
  return semEmoji.replace(/#[^\s#]+/g, "").replace(/\s+/g, " ").trim() || t.trim();
}

async function metricas(ini: string, fim: string): Promise<Metricas> {
  const rows = await analyticsReport({
    startDate: ini,
    endDate: fim,
    metrics: "views,estimatedMinutesWatched,subscribersGained,subscribersLost,likes,shares",
  });
  const [views = 0, minutos = 0, ganhos = 0, perdidos = 0, likes = 0, shares = 0] = ((rows[0] ?? []) as number[]).map(Number);
  return { views, horas: minutos / 60, ganhos, perdidos, likes, shares };
}

/** Lê os números da semana (segunda a domingo) e da anterior no YouTube Analytics. */
export async function lerNumeros(segunda: string): Promise<NumerosSemana> {
  const { ini } = limitesDaSemana(segunda);
  const domingo = ymd(new Date(`${segunda}T12:00:00Z`).getTime() + 6 * DIA);
  const antes = ymd(new Date(`${segunda}T12:00:00Z`).getTime() - 7 * DIA);
  const antesFim = ymd(new Date(`${segunda}T12:00:00Z`).getTime() - DIA);
  // O Analytics fecha o dia com ~2 dias de atraso.
  // Na terça de manhã o domingo já costuma estar fechado; antes disso, parcial.
  const parcial = ini + 7 * DIA > Date.now() - 30 * 3_600_000;

  const [atual, anterior, stats, topRows, tipos] = await Promise.all([
    metricas(segunda, domingo),
    metricas(antes, antesFim),
    channelStatisticsMine().catch(() => null),
    analyticsReport({ startDate: segunda, endDate: domingo, metrics: "views", dimensions: "video", sort: "-views", maxResults: "5" }),
    analyticsReport({ startDate: segunda, endDate: domingo, metrics: "views", dimensions: "creatorContentType" }).catch(() => []),
  ]);
  if (atual.views === 0 && anterior.views === 0) {
    throw new Error("O YouTube Analytics não devolveu números. Confira a conexão do canal em /admin/producao/config.");
  }

  const ids = (topRows as [string, number][]).map((r) => r[0]);
  const titulos = await videoTitles(ids).catch(() => new Map<string, string>());
  const top = (topRows as [string, number][]).map(([id, v]) => ({ id, titulo: limpaTitulo(titulos.get(id) ?? id), views: Number(v) }));

  const porTipo = tipos as [string, number][];
  const totalTipo = porTipo.reduce((s, [, v]) => s + Number(v), 0);
  const shorts = porTipo.find(([k]) => k === "shorts")?.[1];

  return {
    segunda,
    periodo: periodoLabel(segunda),
    parcial,
    atual,
    anterior,
    inscritosTotal: stats?.subscribers ?? null,
    top,
    shortsPct: totalTipo > 0 && shorts != null ? (Number(shorts) / totalTipo) * 100 : null,
  };
}

/** Legenda padrão do post. A equipe edita antes de programar. */
export function legendaPadrao(n: NumerosSemana): string {
  const v = variacao(n.atual.views, n.anterior.views);
  const vh = variacao(n.atual.horas, n.anterior.horas);
  const liquido = n.atual.ganhos - n.atual.perdidos;
  const linhas = [
    `Números da semana do Fora da Caixa 📈 (${n.periodo})`,
    "",
    `▶️ ${int(n.atual.views)} views no YouTube${v != null && v >= 1 ? ` (+${Math.round(v)}% sobre a semana anterior)` : ""}`,
    `⏱️ ${int(n.atual.horas)} horas assistidas${vh != null && vh >= 1 ? ` (+${Math.round(vh)}%)` : ""}`,
    liquido > 0
      ? `🙌 +${int(liquido)} inscritos${n.inscritosTotal ? `, já somos ${int(n.inscritosTotal)}` : ""}`
      : n.inscritosTotal
        ? `🙌 ${int(n.inscritosTotal)} inscritos no canal`
        : null,
    "",
    n.top[0] ? `O mais visto: "${n.top[0].titulo}". Já assistiu? Link na bio.` : null,
    "",
    "Sua marca pode aparecer para esse público. Patrocínio por quadro: pfctv.com.br/parcerias",
    "",
    "#foradacaixa #podcast #mogiguaçu #moji",
  ];
  return linhas.filter((l) => l !== null).join("\n");
}

/* ------------------------------------------------------------------ Arte */

const W = 1080;
const H = 1350;
const GOLD = "#FFD700";
const MX = 80;

/** Texto vetorizado na Anton (o servidor da Vercel não tem fonte instalada). */
function texto(t: string, x: number, y: number, size: number, fill: string, opts: { maxW?: number; anchor?: "start" | "end" } = {}) {
  const s = opts.maxW ? fit(t, opts.maxW, size).size : size;
  const f = anton();
  const w = f.getAdvanceWidth(t, s);
  const x0 = opts.anchor === "end" ? x - w : x;
  return `<path d="${f.getPath(t, x0, y, s).toPathData(2)}" fill="${fill}"/>`;
}

/** Arte 4:5 (1080×1350) do feed do Instagram. */
export async function renderArte(n: NumerosSemana): Promise<Buffer> {
  const v = variacao(n.atual.views, n.anterior.views);
  const liquido = n.atual.ganhos - n.atual.perdidos;
  const compacto = (x: number) =>
    x >= 1000 ? `${(x / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MIL` : int(x);

  // Destaque = o maior crescimento (views ou horas) a partir de 10%; sem isso, as views da semana.
  const vh = variacao(n.atual.horas, n.anterior.horas);
  const hero =
    vh != null && vh >= 10 && vh > (v ?? -Infinity)
      ? { valor: `+${Math.round(vh)}%`, label: "DE HORAS ASSISTIDAS NO YOUTUBE", sub: `${int(n.atual.horas)} HORAS NA SEMANA` }
      : v != null && v >= 10
        ? { valor: `+${Math.round(v)}%`, label: "DE VIEWS NO YOUTUBE", sub: `${int(n.atual.views)} VIEWS NA SEMANA` }
        : { valor: compacto(n.atual.views), label: "VIEWS NO YOUTUBE NA SEMANA", sub: null };

  const cards: { valor: string; label: string }[] = [
    hero.label.includes("HORAS")
      ? { valor: int(n.atual.views), label: "VIEWS NA SEMANA" }
      : { valor: `${int(n.atual.horas)} H`, label: "HORAS ASSISTIDAS" },
    liquido > 0 ? { valor: `+${int(liquido)}`, label: "NOVOS INSCRITOS" } : { valor: int(n.atual.likes), label: "CURTIDAS" },
    n.inscritosTotal ? { valor: int(n.inscritosTotal), label: "INSCRITOS NO CANAL" } : { valor: int(n.atual.shares), label: "COMPARTILHAMENTOS" },
    n.shortsPct != null ? { valor: `${Math.round(n.shortsPct)}%`, label: "DAS VIEWS VÊM DE SHORTS" } : { valor: int(n.atual.likes), label: "CURTIDAS" },
  ];

  const parts: string[] = [];
  parts.push(`<rect width="${W}" height="${H}" fill="#0a0a0a"/>`);
  parts.push(`<rect x="0" y="0" width="${W}" height="14" fill="${GOLD}"/>`);
  parts.push(texto("NÚMEROS DA SEMANA", MX, 190, 72, GOLD, { maxW: 700 }));
  parts.push(texto(n.periodo.toUpperCase(), MX, 250, 40, "#ffffff99"));

  parts.push(texto(hero.valor, MX, 520, 240, GOLD, { maxW: W - 2 * MX }));
  parts.push(texto(hero.label, MX, 590, 54, "#ffffff", { maxW: W - 2 * MX }));
  if (hero.sub) parts.push(texto(hero.sub, MX, 645, 36, "#ffffff80"));

  const cw = (W - 2 * MX - 32) / 2;
  cards.forEach((c, i) => {
    const x = MX + (i % 2) * (cw + 32);
    const y = 700 + Math.floor(i / 2) * 190;
    parts.push(`<rect x="${x}" y="${y}" width="${cw}" height="166" rx="18" fill="#161616" stroke="#2a2a2a" stroke-width="2"/>`);
    parts.push(texto(c.valor, x + 32, y + 92, 72, "#ffffff", { maxW: cw - 64 }));
    parts.push(texto(c.label, x + 32, y + 138, 28, "#ffffff80", { maxW: cw - 64 }));
  });

  if (n.top[0]) {
    parts.push(texto("MAIS VISTO DA SEMANA", MX, 1135, 32, GOLD));
    parts.push(texto(n.top[0].titulo, MX, 1195, 52, "#ffffff", { maxW: W - 2 * MX }));
  }
  parts.push(`<rect x="${MX}" y="1240" width="${W - 2 * MX}" height="2" fill="#2a2a2a"/>`);
  parts.push(texto("YOUTUBE.COM/@PAPOFORADACAIXA  ·  PFCTV.COM.BR", MX, 1295, 30, "#ffffff80"));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join("")}</svg>`;
  const layers: OverlayOptions[] = [];
  const logoRaw = await download(LOGO_PATH).catch(() => null);
  if (logoRaw) {
    const logo = await prepareLogo(logoRaw).catch(() => null);
    if (logo) {
      const { width = 0 } = await sharp(logo).metadata();
      layers.push({ input: logo, left: W - MX - width, top: 120 });
    }
  }
  return sharp(Buffer.from(svg)).composite(layers).jpeg({ quality: 92 }).toBuffer();
}

/* ------------------------------------------------------------------ Estado */

export async function getEstado(segunda: string): Promise<EstadoNumeros | null> {
  const raw = await getConfig(chave(segunda));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as EstadoNumeros;
  } catch {
    return null;
  }
}

async function salvar(segunda: string, e: EstadoNumeros) {
  await setConfig(chave(segunda), JSON.stringify(e));
}

/** URL assinada (1 h) da arte, para o painel e para a Meta baixar. */
export async function urlDaArte(e: EstadoNumeros | null): Promise<string | null> {
  if (!e?.arte_path) return null;
  return (await signedUrls([e.arte_path])).get(e.arte_path) ?? null;
}

/** Lê os números, gera a arte e grava como rascunho. Legenda editada é mantida. */
export async function gerarNumeros(segunda: string, opts: { manterLegenda?: boolean } = {}): Promise<EstadoNumeros> {
  const atual = await getEstado(segunda);
  if (atual && ["agendado", "publicando", "publicado"].includes(atual.status)) {
    throw new Error("Esse post já foi programado ou publicado. Cancele o agendamento para gerar de novo.");
  }
  const numeros = await lerNumeros(segunda);
  const arte = await renderArte(numeros);
  const path = `social/numeros/${segunda}-${Date.now()}.jpg`;
  await upload(path, arte, "image/jpeg");
  const e: EstadoNumeros = {
    status: "rascunho",
    numeros,
    arte_path: path,
    legenda: opts.manterLegenda && atual?.legenda ? atual.legenda : legendaPadrao(numeros),
    publicar_em: null,
    post_url: null,
    erro: null,
    gerado_em: new Date().toISOString(),
  };
  await salvar(segunda, e);
  return e;
}

export async function programarNumeros(segunda: string, legenda: string, quando: Date | null): Promise<void> {
  const e = await getEstado(segunda);
  if (!e?.arte_path) throw new Error("Gere a arte primeiro.");
  if (e.status === "publicado" || e.status === "publicando") throw new Error("Esse post já saiu.");
  if (!(await activeConnection("instagram"))) throw new Error("Instagram não conectado (aba Contas).");
  await salvar(segunda, { ...e, legenda, status: "agendado", publicar_em: (quando ?? new Date()).toISOString(), erro: null });
  if (!quando) await publicar(segunda);
}

export async function salvarLegenda(segunda: string, legenda: string): Promise<void> {
  const e = await getEstado(segunda);
  if (!e) throw new Error("Gere a arte primeiro.");
  if (e.status === "publicado" || e.status === "publicando") throw new Error("Esse post já saiu.");
  await salvar(segunda, { ...e, legenda });
}

export async function cancelarNumeros(segunda: string): Promise<void> {
  const e = await getEstado(segunda);
  if (!e || e.status !== "agendado") return;
  await salvar(segunda, { ...e, status: "rascunho", publicar_em: null });
}

/** Marca "publicando" só se ainda estiver agendado: cron e botão não publicam duas vezes. */
async function claim(segunda: string): Promise<EstadoNumeros | null> {
  const raw = await getConfig(chave(segunda));
  if (!raw) return null;
  const e = JSON.parse(raw) as EstadoNumeros;
  if (e.status !== "agendado") return null;
  const novo: EstadoNumeros = { ...e, status: "publicando" };
  const { data } = await db()
    .from("producao_config")
    .update({ value: JSON.stringify(novo), updated_at: new Date().toISOString() })
    .eq("key", chave(segunda))
    .eq("value", raw)
    .select("key");
  return data && data.length > 0 ? novo : null;
}

async function publicar(segunda: string): Promise<void> {
  const e = await claim(segunda);
  if (!e) return;
  const conn = await activeConnection("instagram");
  try {
    if (!conn) throw new Error("Instagram não conectado (aba Contas).");
    const url = await urlDaArte(e);
    if (!url) throw new Error("Não consegui assinar a URL da arte.");
    const container = await igCreateImage(conn.accountId, conn.token, url, { caption: e.legenda });
    for (let i = 0; i < 6; i++) {
      const st = await igContainerStatus(container, conn.token);
      if (st.code === "FINISHED") break;
      if (st.code === "ERROR" || st.code === "EXPIRED") throw new Error(`Instagram recusou a arte: ${st.detail ?? st.code}`);
      await sleep(5_000);
    }
    const r = await igPublish(conn.accountId, conn.token, container);
    await salvar(segunda, { ...e, status: "publicado", post_url: r.url, erro: null });
  } catch (err) {
    if (err instanceof MetaError && err.tokenDead && conn) await revokeConnection(conn.id);
    await salvar(segunda, { ...e, status: "erro", erro: msg(err) });
  }
}

/**
 * Rodada do cron: a partir de terça 10h gera o rascunho da semana passada (uma
 * vez: se falhar, fica o erro no painel) e publica o que foi programado e venceu.
 */
export async function runNumerosQueue(now = Date.now()): Promise<string | null> {
  const segunda = semanaPassada(now);
  let e = await getEstado(segunda);
  const dow = new Date(now - 3 * 3_600_000).getUTCDay(); // 0 = domingo, em Brasília
  const depoisDeTerca10h = dow === 0 || dow > 2 || (dow === 2 && horaBrasilia(now) >= 10);
  if (!e && depoisDeTerca10h) {
    try {
      e = await gerarNumeros(segunda);
      return "rascunho gerado";
    } catch (err) {
      await salvar(segunda, {
        status: "erro",
        numeros: null,
        arte_path: null,
        legenda: "",
        publicar_em: null,
        post_url: null,
        erro: `Rascunho automático: ${msg(err)}`,
        gerado_em: new Date().toISOString(),
      });
      return "erro no rascunho";
    }
  }
  // Publica o que venceu: o da semana passada ou, se alguém programou cedo, o da atual.
  for (const s of [segunda, segundaDe(now)]) {
    const x = s === segunda ? e : await getEstado(s);
    if (x?.status === "agendado" && x.publicar_em && Date.parse(x.publicar_em) <= now) {
      await publicar(s);
      return "publicado";
    }
  }
  return null;
}

/** O post da semana passada pede atenção (rascunho esperando aprovação ou erro). */
export async function numerosDaSemanaPendente(): Promise<boolean> {
  const e = await getEstado(semanaPassada());
  return e?.status === "rascunho" || e?.status === "erro";
}
