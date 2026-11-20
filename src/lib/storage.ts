import "server-only";
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  NotFound,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { site } from "@/lib/config";

/**
 * Todos os arquivos do site ficam no Cloudflare R2, num bucket só. Cada área
 * guarda sob o nome do antigo bucket do Supabase (`producao/…`,
 * `client-files/…`, `partner-assets/…`), então os caminhos gravados no banco
 * continuam valendo do jeito que estão.
 */
export type Area = "producao" | "client-files" | "partner-assets";

/** Áreas que qualquer um pode ler pela rota /arquivos (logos e capas dos parceiros). */
export const AREAS_PUBLICAS: Area[] = ["partner-assets"];

let cliente: S3Client | null = null;

function s3(): S3Client {
  if (cliente) return cliente;
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) throw new Error("R2 sem credenciais (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).");
  cliente = new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    // O R2 não aceita os checksums CRC32 que o SDK manda por padrão em URL assinada.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return cliente;
}

function bucket(): string {
  const b = process.env.R2_BUCKET?.trim();
  if (!b) throw new Error("R2_BUCKET ausente.");
  return b;
}

/** Caminho relativo à área → chave no R2. Barra caminho com `..` ou vazio. */
export function chave(area: Area, path: string): string {
  const p = path.replace(/^\/+/, "");
  if (!p || p.split("/").includes("..")) throw new Error(`Caminho inválido: ${path}`);
  return `${area}/${p}`;
}

const naoAchou = (e: unknown) =>
  e instanceof NoSuchKey || e instanceof NotFound || (e as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode === 404;

export async function upload(area: Area, path: string, body: Buffer | Uint8Array | string, contentType: string): Promise<void> {
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: chave(area, path), Body: body, ContentType: contentType }));
}

export async function download(area: Area, path: string): Promise<{ buf: Buffer; mime: string | null } | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: chave(area, path) }));
    if (!r.Body) return null;
    return { buf: Buffer.from(await r.Body.transformToByteArray()), mime: r.ContentType ?? null };
  } catch (e) {
    if (naoAchou(e)) return null;
    throw e;
  }
}

/** O arquivo como stream (para repassar sem carregar na memória). */
export async function abrir(area: Area, path: string): Promise<{ stream: ReadableStream<Uint8Array>; tamanho: number | null; mime: string | null; etag: string | null } | null> {
  try {
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: chave(area, path) }));
    if (!r.Body) return null;
    return {
      stream: r.Body.transformToWebStream() as ReadableStream<Uint8Array>,
      tamanho: r.ContentLength ?? null,
      mime: r.ContentType ?? null,
      etag: r.ETag ?? null,
    };
  } catch (e) {
    if (naoAchou(e)) return null;
    throw e;
  }
}

/** Tamanho e tipo do arquivo, ou null se ele não existe. */
export async function info(area: Area, path: string): Promise<{ tamanho: number; mime: string | null } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: chave(area, path) }));
    return { tamanho: r.ContentLength ?? 0, mime: r.ContentType ?? null };
  } catch (e) {
    if (naoAchou(e)) return null;
    throw e;
  }
}

export async function remover(area: Area, paths: (string | null | undefined)[]): Promise<void> {
  const keys = paths.filter((p): p is string => !!p).map((p) => ({ Key: chave(area, p) }));
  for (let i = 0; i < keys.length; i += 1000) {
    await s3().send(new DeleteObjectsCommand({ Bucket: bucket(), Delete: { Objects: keys.slice(i, i + 1000), Quiet: true } }));
  }
}

/** Nome do arquivo no Content-Disposition, com acento (RFC 5987). */
function disposicao(nome: string): string {
  const ascii = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]|["\\]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/** Link de leitura que expira. Com `baixar`, o navegador salva com esse nome em vez de abrir. */
export async function urlAssinada(area: Area, path: string, segundos: number, baixar?: string): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: chave(area, path), ResponseContentDisposition: baixar ? disposicao(baixar) : undefined }),
    { expiresIn: segundos }
  );
}

export async function urlsAssinadas(area: Area, paths: string[], segundos: number): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(paths.filter(Boolean))).map(async (p) => out.set(p, await urlAssinada(area, p, segundos)))
  );
  return out;
}

/**
 * Link para o navegador subir o arquivo direto no R2 (PUT), sem passar pela
 * função da Vercel, que recusa corpo acima de 4,5 MB. O Content-Type entra na
 * assinatura: o envio tem de mandar o mesmo. Exige CORS liberado no bucket.
 */
export async function urlDeEnvio(area: Area, path: string, contentType: string, segundos = 3600): Promise<string> {
  return getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: chave(area, path), ContentType: contentType }), {
    expiresIn: segundos,
    // Sem isto o presigner deixa o Content-Type fora da assinatura e o envio aceita qualquer tipo.
    signableHeaders: new Set(["content-type"]),
  });
}

/**
 * Confere o arquivo que o navegador disse ter enviado: existe e não passa do
 * limite (a URL de envio não trava o tamanho; o que passar é apagado).
 */
export async function conferirEnvio(area: Area, path: string, max: number): Promise<{ tamanho: number; mime: string | null }> {
  const i = await info(area, path);
  if (!i) throw new Error("O arquivo não chegou. Tente enviar de novo.");
  if (i.tamanho > max) {
    await remover(area, [path]);
    throw new Error(`Arquivo acima de ${Math.round(max / 1024 / 1024)} MB.`);
  }
  return i;
}

/** URL pública e permanente de uma área pública (servida pela rota /arquivos). */
export function urlPublica(area: Area, path: string): string {
  if (!AREAS_PUBLICAS.includes(area)) throw new Error(`Área ${area} não é pública.`);
  const base = process.env.R2_PUBLIC_BASE?.trim().replace(/\/+$/, "") || `${site.url}/arquivos`;
  return `${base}/${chave(area, path)}`;
}
