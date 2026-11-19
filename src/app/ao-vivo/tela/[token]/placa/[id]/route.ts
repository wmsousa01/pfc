import { notFound } from "next/navigation";
import { parceiroDaPlaca } from "@/lib/ao-vivo/store";
import { renderPlaca } from "@/lib/placa";

export const dynamic = "force-dynamic";

/** PNG da placa do QR para a tela do OBS. Só responde a inserção de QR deste link. */
export async function GET(_req: Request, { params }: { params: { token: string; id: string } }) {
  const parceiro = await parceiroDaPlaca(params.token, params.id);
  if (!parceiro) notFound();
  const png = await renderPlaca(parceiro);
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=21600" },
  });
}
