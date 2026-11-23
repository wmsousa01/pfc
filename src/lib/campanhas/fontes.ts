import "server-only";
import { randomUUID } from "crypto";
import { driveIdDe, listarPasta, type ArquivoDrive } from "@/lib/agenda/video";
import { listJobCuts } from "@/lib/producao/contenta";
import { BUCKET, getConfig } from "@/lib/producao/store";
import { conferirEnvio, urlDeEnvio } from "@/lib/storage";
import { CAMPANHAS_DIR, FORMATOS, addCriativo, db, type Criativo, type Formato } from "./store";

/**
 * De onde vêm os criativos já gravados e editados: pasta pública do Drive,
 * upload direto no painel (Storage, por URL assinada) ou corte pronto do
 * Contenta (MP4 público no R2).
 */
export const PASTA_KEY = "campanhas_drive_pasta";
/**
 * Teto do envio direto. Vídeo vai do R2 para o Gemini em stream e a Meta baixa
 * pela URL, então não passa inteiro pela memória da função; imagem vai em bytes.
 */
export const MAX_UPLOAD_VIDEO = 1024 * 1024 * 1024;
export const MAX_UPLOAD_IMAGEM = 50 * 1024 * 1024;
const maxDe = (mime: string) => (mime.startsWith("video/") ? MAX_UPLOAD_VIDEO : MAX_UPLOAD_IMAGEM);

const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const IMAGEM = /\.(jpe?g|png|webp)$/i;

const MIME: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const ext = (nome: string) => nome.split(".").pop()?.toLowerCase() ?? "";

export const formatoDe = (v: string | null | undefined): Formato | null =>
  v && (FORMATOS as string[]).includes(v) ? (v as Formato) : null;

/** "Reels 9x16.mp4", "feed_4-5.png" → formato, quando o nome diz. */
function formatoDoNome(nome: string): Formato | null {
  const m = /(9|4|1|16)\s*[x:_-]\s*(16|5|1|9)/.exec(nome);
  return m ? formatoDe(`${m[1]}:${m[2]}`) : null;
}

export async function pastaCampanhas(): Promise<string | null> {
  return getConfig(PASTA_KEY);
}

/** Vídeos e imagens da pasta, com o que já está na biblioteca marcado. */
export async function arquivosDaPasta(pasta: string): Promise<(ArquivoDrive & { tipo: "video" | "imagem"; importado: boolean })[]> {
  const id = driveIdDe(pasta) ?? /folders\/([A-Za-z0-9_-]{20,})/.exec(pasta)?.[1] ?? pasta.trim();
  const arquivos = (await listarPasta(id)).filter((a) => VIDEO.test(a.nome) || IMAGEM.test(a.nome));
  const { data } = await db().from("mkt_criativos").select("ref").eq("origem", "drive").eq("arquivado", false).in("ref", arquivos.map((a) => a.id));
  const ja = new Set((data ?? []).map((d) => d.ref));
  return arquivos.map((a) => ({ ...a, tipo: VIDEO.test(a.nome) ? "video" : "imagem", importado: ja.has(a.id) }));
}

export async function importarDoDrive(arquivos: { id: string; nome: string }[], actor: string): Promise<number> {
  let n = 0;
  for (const a of arquivos) {
    const tipo = VIDEO.test(a.nome) ? "video" : IMAGEM.test(a.nome) ? "imagem" : null;
    if (!tipo) continue;
    await addCriativo({
      nome: a.nome.replace(/\.[^.]+$/, "").slice(0, 120),
      tipo,
      origem: "drive",
      ref: a.id,
      // Miniatura pública do Drive: funciona para arquivo com link aberto.
      thumb_url: `https://drive.google.com/thumbnail?id=${a.id}&sz=w480`,
      mime: MIME[ext(a.nome)] ?? null,
      tamanho: null,
      duracao_s: null,
      formato: formatoDoNome(a.nome),
      gerado_com: null,
      created_by: actor,
    });
    n++;
  }
  return n;
}

/** Os cortes escolhidos de um job pronto do Contenta (o vertical sai 9:16, o longo 16:9). */
export async function importarDoContenta(jobId: string, files: string[], actor: string): Promise<number> {
  if (!/^job_\d{13,16}$/.test(jobId)) throw new Error("Job inválido.");
  const { outputFormat, items } = await listJobCuts(jobId);
  const formato: Formato | null = outputFormat === "portrait" ? "9:16" : outputFormat === "landscape" ? "16:9" : null;
  let n = 0;
  for (const cut of items.filter((c) => files.includes(c.file))) {
    await addCriativo({
      nome: (cut.title ?? cut.file).slice(0, 120),
      tipo: "video",
      origem: "contenta",
      ref: cut.url,
      thumb_url: cut.thumbUrl,
      mime: "video/mp4",
      tamanho: null,
      duracao_s: cut.durationSec ? Math.round(cut.durationSec) : null,
      formato,
      gerado_com: null,
      created_by: actor,
    });
    n++;
  }
  return n;
}

const UPLOAD_DIR = `${CAMPANHAS_DIR}/uploads/`;

function nomeSeguro(nome: string): string {
  const s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return s || "arquivo";
}

/** URL assinada para o navegador subir o criativo direto no R2. */
export async function pedirUploadCriativo(nome: string, mime: string, tamanho: number): Promise<{ path: string; url: string }> {
  if (!/^(image|video)\//.test(mime)) throw new Error("Mande vídeo ou imagem.");
  if (tamanho > maxDe(mime)) throw new Error(mime.startsWith("video/") ? "Vídeo acima de 1 GB: coloque na pasta do Drive e importe por lá." : "Imagem acima de 50 MB.");
  const path = `${UPLOAD_DIR}${randomUUID().slice(0, 8)}-${nomeSeguro(nome)}`;
  return { path, url: await urlDeEnvio(BUCKET, path, mime) };
}

/** Registra o upload, conferindo que o arquivo chegou. */
export async function registrarUpload(path: string, nome: string, mime: string, formato: string, actor: string): Promise<Criativo> {
  if (!path.startsWith(UPLOAD_DIR) || path.includes("..")) throw new Error("Arquivo fora da pasta de criativos.");
  const { tamanho } = await conferirEnvio(BUCKET, path, maxDe(mime));
  return addCriativo({
    nome: nome.replace(/\.[^.]+$/, "").slice(0, 120),
    tipo: mime.startsWith("video/") ? "video" : "imagem",
    origem: "upload",
    ref: path,
    thumb_url: null,
    mime,
    tamanho,
    duracao_s: null,
    formato: formatoDe(formato) ?? formatoDoNome(nome),
    gerado_com: null,
    created_by: actor,
  });
}
