import { AREAS_PUBLICAS, abrir, type Area } from "@/lib/storage";

/**
 * Arquivos públicos do R2 (logos e capas dos parceiros) servidos pelo site:
 * o bucket é privado e o domínio do PFC não está na Cloudflare. Cada upload
 * ganha nome novo, então o cache pode ser longo e imutável.
 */
export async function GET(_req: Request, { params }: { params: { chave: string[] } }) {
  const [area, ...resto] = params.chave ?? [];
  if (!AREAS_PUBLICAS.includes(area as Area) || resto.length === 0) return new Response("Não encontrado", { status: 404 });
  let arq;
  try {
    arq = await abrir(area as Area, resto.join("/"));
  } catch {
    return new Response("Não encontrado", { status: 404 });
  }
  if (!arq) return new Response("Não encontrado", { status: 404 });
  const headers = new Headers({
    "content-type": arq.mime ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  });
  if (arq.tamanho != null) headers.set("content-length", String(arq.tamanho));
  if (arq.etag) headers.set("etag", arq.etag);
  // SVG enviado no admin: sem script rodando no domínio do site.
  if (arq.mime === "image/svg+xml") headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'");
  return new Response(arq.stream, { headers });
}
