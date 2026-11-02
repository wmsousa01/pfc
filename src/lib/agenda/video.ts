import "server-only";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { once } from "events";
import http from "http";
import type { AddressInfo } from "net";
import { promisify } from "util";
import { isGeminiConfigured, pickBestFrame } from "@/lib/producao/gemini";
import { triggerLiveCuts } from "@/lib/producao/lives";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { download, getConfig, upload } from "@/lib/producao/store";
import {
  addToPlaylist,
  connectedChannel,
  listPlaylists,
  publishVideo,
  putChunk,
  queryUpload,
  setThumbnail,
  startResumableUpload,
  unscheduleVideo,
  updateVideoSnippet,
  videoState,
} from "@/lib/producao/youtube-api";
import { db, getArte, getEpisodio, logAgenda, updateEpisodio, type Episodio } from "./store";

/**
 * Episódio gravado (PFC Visita): o arquivo pronto fica numa pasta pública do
 * Drive, com vários GB. Nada disso passa inteiro pela função da Vercel:
 * - frames: o ffmpeg lê só os trechos que precisa, por Range, direto do link;
 * - YouTube: o vídeo vai em pedaços de 64 MB (Drive por Range → upload
 *   retomável do YouTube), e cada rodada do cron empurra o que cabe em ~4 min.
 */

const AUTOMACAO = "automação";
export const PASTA_KEY = "visita_drive_pasta";
/** A pasta que a equipe já usa para os episódios do PFC Visita. */
export const PASTA_PADRAO = "12Y5m3y4GRU-9nGFxhcndogaAO9AAC5bx";
/** Múltiplo de 256 KiB, como o upload retomável exige. */
const CHUNK = 64 * 1024 * 1024;
const MAX_FALHAS = 6;

const run = promisify(execFile);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

export type YtUpload = { session: string; offset: number; total: number; falhas?: number };

export const driveUrl = (id: string) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

/** Link do Drive (…/file/d/<id>/…, ?id=<id>) ou o id puro. */
export function driveIdDe(v: string): string | null {
  const s = v.trim();
  const m = /\/file\/d\/([A-Za-z0-9_-]{20,})/.exec(s) ?? /[?&]id=([A-Za-z0-9_-]{20,})/.exec(s);
  if (m) return m[1];
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : null;
}

export async function pastaDrive(): Promise<string> {
  return (await getConfig(PASTA_KEY)) ?? PASTA_PADRAO;
}

export type ArquivoDrive = { id: string; nome: string };

/**
 * Os arquivos da pasta pública. A API do Drive não aceita a chave do Gemini,
 * e pedir escopo do Drive no OAuth exigiria verificação do app; a visão
 * embutida da pasta lista o mesmo sem login.
 */
export async function listarPasta(pastaId: string): Promise<ArquivoDrive[]> {
  const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${pastaId}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Drive ${res.status}: a pasta precisa estar compartilhada com "qualquer pessoa com o link".`);
  const html = await res.text();
  const out: ArquivoDrive[] = [];
  const re = /file\/d\/([A-Za-z0-9_-]+)[\s\S]*?flip-entry-title">([^<]+)</g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (!out.some((a) => a.id === m![1])) out.push({ id: m[1], nome: m[2].replace(/&amp;/g, "&").trim() });
  }
  return out;
}

function ffmpeg(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const p = require("ffmpeg-static") as string | null;
  if (!p) throw new Error("ffmpeg indisponível neste servidor.");
  return p;
}

/** Janela de cada leitura no Drive pelo proxy. */
const JANELA = 4 * 1024 * 1024;

/**
 * O ffmpeg pede "Range: bytes=N-" (até o fim). No link público o Drive conta
 * isso como download do arquivo inteiro e, passada a cota, responde com a
 * página "Quota exceeded" no lugar do vídeo; pedido com início e fim continua
 * valendo. Este servidor local recebe os pedidos do ffmpeg e lê do Drive em
 * janelas fechadas, só enquanto o ffmpeg estiver lendo.
 */
async function comProxy<T>(id: string, total: number, fn: (url: string) => Promise<T>): Promise<T> {
  const server = http.createServer(async (req, res) => {
    const m = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? "");
    let start = m ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), total - 1) : total - 1;
    if (start > end) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` }).end();
      return;
    }
    res.writeHead(m ? 206 : 200, {
      "Content-Type": "video/mp4",
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      ...(m ? { "Content-Range": `bytes ${start}-${end}/${total}` } : {}),
    });
    let fechado = false;
    res.on("close", () => (fechado = true));
    try {
      while (start <= end && !fechado) {
        const e = Math.min(start + JANELA - 1, end);
        const r = await fetch(driveUrl(id), { headers: { Range: `bytes=${start}-${e}` }, cache: "no-store" });
        if (r.status !== 206) throw new Error(`Drive ${r.status}`);
        const buf = Buffer.from(await r.arrayBuffer());
        if (!res.write(buf)) await once(res, "drain");
        start = e + 1;
      }
      res.end();
    } catch {
      res.destroy();
    }
  });
  await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
  try {
    return await fn(`http://127.0.0.1:${(server.address() as AddressInfo).port}/video.mp4`);
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

/** Tamanho pelo Content-Range e duração pelo cabeçalho do MP4 (o ffmpeg lê só o índice). */
async function infoVideo(id: string): Promise<{ tamanho: number; duracao: number }> {
  const res = await fetch(driveUrl(id), { headers: { Range: "bytes=0-0" }, cache: "no-store" });
  const total = Number(/\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1] ?? 0);
  const tipo = res.headers.get("content-type") ?? "";
  await res.body?.cancel().catch(() => null);
  if (!total || !tipo.startsWith("video/")) throw new Error("Não consegui abrir o vídeo: confira se o arquivo é MP4 e está com link público.");
  const r = await comProxy(id, total, (url) =>
    run(ffmpeg(), ["-hide_banner", "-i", url], { timeout: 60_000 }).catch((e: { stderr?: string }) => ({ stderr: e.stderr ?? "" }))
  );
  const d = /Duration: (\d+):(\d+):(\d+)/.exec(r.stderr ?? "");
  return { tamanho: total, duracao: d ? Number(d[1]) * 3600 + Number(d[2]) * 60 + Number(d[3]) : 0 };
}

export async function ligarVideo(epId: string, link: string, nome: string | null, actor: string): Promise<void> {
  const id = driveIdDe(link);
  if (!id) throw new Error("Link do Drive inválido.");
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  if (ep.yt_status === "enviando" || ep.yt_status === "enviado") throw new Error("O vídeo já foi para o YouTube; não dá para trocar o arquivo.");
  const { tamanho, duracao } = await infoVideo(id);
  await updateEpisodio(ep.id, { video_drive_id: id, video_nome: nome, video_tamanho: tamanho, video_duracao_s: duracao || null, yt_erro: null });
  await logAgenda(ep.id, actor, "ligou o vídeo do Drive", `${nome ?? id} (${(tamanho / 1e9).toFixed(1)} GB)`);
}

/** Um frame em `seg` segundos. O Drive às vezes falha uma leitura: tenta de novo uma vez. */
async function frameEm(id: string, total: number, seg: number): Promise<Buffer> {
  return comProxy(id, total, (url) => lerFrame(url, seg).catch(() => lerFrame(url, seg)));
}

/** JPEG 1080p lido por Range, sem baixar o resto do vídeo. */
async function lerFrame(url: string, seg: number): Promise<Buffer> {
  const r = await run(
    ffmpeg(),
    ["-hide_banner", "-loglevel", "error", "-ss", String(seg), "-i", url, "-frames:v", "1", "-vf", "scale=-2:1080", "-q:v", "3", "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1"],
    { timeout: 90_000, encoding: "buffer", maxBuffer: 20 * 1024 * 1024 }
  );
  const buf = r.stdout as unknown as Buffer;
  if (!buf?.length) throw new Error(`Sem frame em ${seg}s.`);
  return buf;
}

/**
 * Tira `n` frames espalhados pelo episódio (pulando abertura e encerramento)
 * e grava como material. O melhor, escolhido pelo Gemini, já entra na arte.
 */
export async function tirarFrames(epId: string, actor: string, n = 9): Promise<number> {
  const ep = await getEpisodio(epId);
  if (!ep?.video_drive_id || !ep.video_tamanho) throw new Error("Ligue o vídeo do Drive primeiro.");
  const dur = ep.video_duracao_s || 600;
  const tempos = Array.from({ length: n }, (_, i) => Math.round(dur * (0.08 + (0.84 * i) / Math.max(1, n - 1))));
  const frames: { seg: number; buf: Buffer }[] = [];
  // Três de cada vez: cada um abre uma conexão com o Drive.
  for (let i = 0; i < tempos.length; i += 3) {
    const lote = await Promise.all(tempos.slice(i, i + 3).map((seg) => frameEm(ep.video_drive_id!, ep.video_tamanho!, seg).then((buf) => ({ seg, buf })).catch(() => null)));
    frames.push(...lote.filter((f): f is { seg: number; buf: Buffer } => !!f));
  }
  if (frames.length === 0) throw new Error("O ffmpeg não conseguiu ler o vídeo.");

  const melhor = isGeminiConfigured() ? await pickBestFrame(frames.map((f) => f.buf)).then((r) => r.index).catch(() => 0) : 0;
  const mmss = (s: number) => `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  const rows = [];
  for (let i = 0; i < frames.length; i++) {
    const path = `agenda/${ep.id}/materiais/frame-${randomUUID().slice(0, 8)}-${mmss(frames[i].seg)}.jpg`;
    await upload(path, frames[i].buf, "image/jpeg");
    rows.push({
      episodio_id: ep.id,
      tipo: "frame",
      path,
      nome: `Frame ${mmss(frames[i].seg)}`,
      mime: "image/jpeg",
      tamanho: frames[i].buf.length,
      usar_na_arte: i === melhor,
      enviado_por: actor,
    });
  }
  const { error } = await db().from("agenda_materiais").insert(rows);
  if (error) throw new Error(error.message);
  await logAgenda(ep.id, actor, "tirou frames do vídeo", `${frames.length} frames`);
  return frames.length;
}

// ---- YouTube ----

function metaDe(ep: Episodio) {
  const quadro = isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro;
  return {
    title: ep.briefing?.titulo_live || `${quadro}${ep.tema ? ` | ${ep.tema}` : ""}`,
    description: ep.briefing?.descricao_yt || `${quadro}${ep.tema ? ` — ${ep.tema}` : ""}`,
    publishAt: new Date(ep.inicio),
  };
}

/** Abre a sessão no YouTube e já empurra a primeira leva; o resto vai no cron. */
export async function enviarVideo(epId: string, actor: string, budgetMs: number): Promise<void> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  if (ep.status !== "confirmado") throw new Error("Confirme o episódio antes de enviar.");
  if (!ep.video_drive_id || !ep.video_tamanho) throw new Error("Ligue o vídeo do Drive primeiro.");
  if (ep.yt_status === "enviando" || ep.yt_status === "enviado") return;
  if (!(await connectedChannel())) throw new Error("Canal do YouTube não conectado (/admin/producao/config).");
  if (new Date(ep.inicio).getTime() < Date.now() + 15 * 60_000) throw new Error("A data do episódio já passou ou está em cima: remarque para quando ele deve estrear.");

  const session = await startResumableUpload(metaDe(ep), ep.video_tamanho);
  const up: YtUpload = { session, offset: 0, total: ep.video_tamanho, falhas: 0 };
  await updateEpisodio(ep.id, { yt_status: "enviando", yt_upload: up, yt_erro: null });
  await logAgenda(ep.id, actor, "começou a enviar o vídeo ao YouTube", `${(ep.video_tamanho / 1e9).toFixed(1)} GB`);
  await empurrar(ep.id, budgetMs);
}

/** Só uma rodada por vez mexe na sessão de upload do episódio. */
async function travar(epId: string, ms: number): Promise<Episodio | null> {
  const agora = new Date();
  const { data } = await db()
    .from("agenda_episodios")
    .update({ yt_lock_ate: new Date(agora.getTime() + ms + 60_000).toISOString() })
    .eq("id", epId)
    .eq("yt_status", "enviando")
    .or(`yt_lock_ate.is.null,yt_lock_ate.lt."${agora.toISOString()}"`)
    .select("*");
  return ((data ?? [])[0] as Episodio) ?? null;
}

/** Empurra pedaços até acabar o tempo. Retomável: o que já foi fica no YouTube. */
async function empurrar(epId: string, budgetMs: number): Promise<void> {
  const ep = await travar(epId, budgetMs);
  if (!ep?.yt_upload || !ep.video_drive_id) return;
  const up = ep.yt_upload as YtUpload;
  const fim = Date.now() + budgetMs;
  try {
    // A rodada anterior pode ter caído no meio de um pedaço: pergunta onde parou.
    let r = await queryUpload(up.session, up.total);
    while (!r.done && Date.now() < fim) {
      const start = r.next;
      const end = Math.min(start + CHUNK, up.total) - 1;
      const res = await fetch(driveUrl(ep.video_drive_id), { headers: { Range: `bytes=${start}-${end}` }, cache: "no-store" });
      if (res.status !== 206) throw new Error(`Drive ${res.status} ao ler o trecho ${start}.`);
      const chunk = new Uint8Array(await res.arrayBuffer());
      r = await putChunk(up.session, chunk, start, up.total);
      up.offset = r.done ? up.total : r.next;
      up.falhas = 0;
      await updateEpisodio(ep.id, { yt_upload: up });
    }
    if (r.done) await concluir(ep, r.videoId);
  } catch (e) {
    up.falhas = (up.falhas ?? 0) + 1;
    const desistiu = up.falhas >= MAX_FALHAS || /404|410/.test(msg(e));
    await updateEpisodio(ep.id, { yt_upload: up, yt_erro: msg(e), ...(desistiu ? { yt_status: "erro" } : {}) });
    if (desistiu) await logAgenda(ep.id, AUTOMACAO, "parou o envio ao YouTube", msg(e));
  } finally {
    await db().from("agenda_episodios").update({ yt_lock_ate: null }).eq("id", ep.id);
  }
}

/** Vídeo no canal: thumb da arte escolhida, playlist do quadro, link no episódio. */
async function concluir(ep: Episodio, videoId: string): Promise<void> {
  await updateEpisodio(ep.id, { yt_video_id: videoId, yt_status: "enviado", yt_erro: null });
  await logAgenda(ep.id, AUTOMACAO, "terminou de enviar o vídeo", `agendado para ${new Date(ep.inicio).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`);
  await aplicarThumb(ep, videoId);
  if (isQuadroId(ep.quadro)) {
    const titulo = QUADROS[ep.quadro].episodes.toLowerCase();
    await listPlaylists()
      .then((pls) => pls.find((p) => p.title.trim().toLowerCase() === titulo))
      .then((pl) => (pl ? addToPlaylist(pl.id, videoId) : undefined))
      .catch((e) => logAgenda(ep.id, AUTOMACAO, "falhou ao pôr na playlist", msg(e)));
  }
}

async function aplicarThumb(ep: Episodio, videoId: string): Promise<void> {
  const arte = ep.arte_id ? await getArte(ep.arte_id) : null;
  const jpeg = arte ? await download(arte.thumb_path) : null;
  if (jpeg) await setThumbnail(videoId, jpeg).catch((e) => logAgenda(ep.id, AUTOMACAO, "falhou na thumb do vídeo", msg(e)));
}

/** Título, descrição, data e thumb atuais do episódio para o vídeo já enviado. */
export async function atualizarVideo(epId: string, actor: string): Promise<void> {
  const ep = await getEpisodio(epId);
  if (!ep?.yt_video_id) throw new Error("O vídeo ainda não terminou de subir.");
  const m = metaDe(ep);
  await updateVideoSnippet(ep.yt_video_id, m.title, m.description);
  if (m.publishAt.getTime() > Date.now()) await publishVideo(ep.yt_video_id, m.publishAt);
  await aplicarThumb(ep, ep.yt_video_id);
  await logAgenda(ep.id, actor, "atualizou o vídeo no YouTube");
}

/** Episódio remarcado: a estreia acompanha. */
export async function reagendarVideo(ep: Episodio, inicio: Date): Promise<void> {
  if (ep.yt_video_id && inicio.getTime() > Date.now()) await publishVideo(ep.yt_video_id, inicio);
}

/** Episódio cancelado: o vídeo fica privado, sem estrear sozinho. Upload no meio para. */
export async function suspenderVideo(ep: Episodio): Promise<void> {
  if (ep.yt_status === "enviando") await updateEpisodio(ep.id, { yt_status: "erro", yt_erro: "Episódio cancelado." });
  if (ep.yt_video_id) await unscheduleVideo(ep.yt_video_id);
}

export async function liberarEnvio(epId: string): Promise<void> {
  const ep = await getEpisodio(epId);
  if (!ep || ep.yt_status !== "erro") return;
  // Sessão ainda viva continua de onde parou; morta, começa do zero.
  const up = ep.yt_upload as YtUpload | null;
  await updateEpisodio(ep.id, up && ep.status === "confirmado" ? { yt_status: "enviando", yt_erro: null, yt_upload: { ...up, falhas: 0 } } : { yt_status: "nenhum", yt_upload: null, yt_erro: null });
}

// ---- Cortes no Contenta ----

/**
 * Depois da estreia o vídeo é público e o Contenta consegue baixar: entra em
 * producao_lives (o mesmo painel e a mesma trava de cortes das lives) e dispara.
 */
async function cortarSePublico(ep: Episodio): Promise<boolean> {
  const st = await videoState(ep.yt_video_id!);
  if (!st || st.privacy !== "public" || !st.processed) return false;
  const { data: existente } = await db().from("producao_lives").select("id").eq("youtube_id", ep.yt_video_id).maybeSingle();
  let liveId = existente?.id as string | undefined;
  if (!liveId) {
    const { data, error } = await db()
      .from("producao_lives")
      .insert({
        youtube_id: ep.yt_video_id,
        title: metaDe(ep).title,
        privacy: "public",
        duration_sec: ep.video_duracao_s,
        ended_at: ep.inicio,
        status: "detectada",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    liveId = data.id as string;
  }
  await updateEpisodio(ep.id, { cortes_live_id: liveId });
  await triggerLiveCuts(liveId, AUTOMACAO);
  await logAgenda(ep.id, AUTOMACAO, "mandou cortar no Contenta");
  return true;
}

/** Rodada do cron: continua os envios e manda cortar o que já estreou. */
export async function runVideoQueue(budgetMs: number): Promise<{ envios: number; cortes: number }> {
  const fim = Date.now() + budgetMs;
  const { data: enviando } = await db().from("agenda_episodios").select("id").eq("yt_status", "enviando").limit(3);
  let envios = 0;
  for (const e of enviando ?? []) {
    const resta = fim - Date.now() - 30_000;
    if (resta < 30_000) break;
    await empurrar(e.id, resta);
    envios++;
  }

  const { data: estreados } = await db()
    .from("agenda_episodios")
    .select("*")
    .eq("yt_status", "enviado")
    .is("cortes_live_id", null)
    .in("status", ["confirmado", "realizado"])
    .lt("inicio", new Date(Date.now() - 20 * 60_000).toISOString())
    .limit(3);
  let cortes = 0;
  for (const ep of (estreados ?? []) as Episodio[]) {
    const ok = await cortarSePublico(ep).catch((e) => logAgenda(ep.id, AUTOMACAO, "falhou ao mandar cortar", msg(e)).then(() => false));
    if (ok) cortes++;
  }
  return { envios, cortes };
}
