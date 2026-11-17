import { NextResponse, type NextRequest } from "next/server";
import { registrarClique } from "@/lib/ads/store";

export const dynamic = "force-dynamic";

/**
 * Link rastreado da Oferta da semana (/o/{codigo}): conta o clique e leva
 * para o WhatsApp do anunciante com a mensagem já escrita — é a prova de
 * resultado que o cliente recebe.
 */
export async function GET(req: NextRequest, { params }: { params: { codigo: string } }) {
  const destino = await registrarClique(params.codigo.toLowerCase()).catch(() => null);
  if (!destino) return NextResponse.redirect(new URL("/ofertas", req.url), 302);
  const msg = `Oi! Vi a oferta "${destino.titulo}" no PFC e quero saber mais.`;
  return NextResponse.redirect(`https://wa.me/${destino.whatsapp}?text=${encodeURIComponent(msg)}`, 302);
}
