import sharp from "sharp";
import { isQuadroId, quadroLogoPath } from "@/lib/producao/quadros";
import { LOGO_PATH, download } from "@/lib/producao/store";

/**
 * Logo do quadro para o site inteiro, lido do mesmo lugar que o admin usa
 * (/admin/producao/config). Sem logo próprio, vale o do PFC, a mesma regra das
 * thumbs. Aceita o id do quadro ou o slug do site ("papo-fora-da-caixa").
 */
export const dynamic = "force-dynamic";

const SLUG_PARA_ID: Record<string, string> = { "papo-fora-da-caixa": "fora-da-caixa" };

/**
 * Padroniza logos enviados de jeitos diferentes (com fundo branco sobrando,
 * largos, transparentes): corta a borda vazia e centraliza num quadrado de
 * 256 px com a cor do próprio fundo do logo (branco quando é transparente).
 */
async function selo(original: Buffer): Promise<Buffer> {
  const canto = await sharp(original).ensureAlpha().extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();
  const fundo = canto[3] < 128 ? { r: 255, g: 255, b: 255, alpha: 1 } : { r: canto[0], g: canto[1], b: canto[2], alpha: 1 };
  const recortado = await sharp(original)
    .trim({ threshold: 20 })
    .toBuffer()
    .catch(() => original); // logo sem borda para cortar
  return sharp(recortado)
    .resize(212, 212, { fit: "contain", background: fundo })
    .extend({ top: 22, bottom: 22, left: 22, right: 22, background: fundo })
    .flatten({ background: fundo })
    .webp({ quality: 90 })
    .toBuffer();
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = SLUG_PARA_ID[params.id] ?? params.id;
  if (!isQuadroId(id)) return new Response("Quadro desconhecido", { status: 404 });
  try {
    const original = (await download(quadroLogoPath(id))) ?? (await download(LOGO_PATH));
    if (!original) return new Response("Sem logo", { status: 404 });
    const img = await selo(original);
    return new Response(new Uint8Array(img), {
      headers: {
        "Content-Type": "image/webp",
        // Troca de logo no admin aparece em até 10 min.
        "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Erro ao ler o logo", { status: 502 });
  }
}
