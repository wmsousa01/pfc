import { notFound } from "next/navigation";
import { thumbDoDia } from "@/lib/ao-vivo/em-instantes";
import { quadroDaTela } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

/**
 * Thumb do episódio do dia num endereço fixo: a URL assinada do Storage muda a
 * cada pedido, e a imagem trocaria (e piscaria) a cada atualização da cena.
 */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const quadro = await quadroDaTela(params.token);
  if (!quadro) notFound();
  const img = await thumbDoDia(quadro);
  if (!img) notFound();
  const png = img[0] === 0x89 && img[1] === 0x50;
  return new Response(new Uint8Array(img), {
    headers: { "Content-Type": png ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=300" },
  });
}
