import { NextResponse } from "next/server";
import { urlMaterialEspelho } from "@/lib/agenda/espelho";

export const dynamic = "force-dynamic";

/**
 * Endereço fixo de cada imagem do espelho: a URL assinada do Storage vence
 * em 1 h e muda a cada pedido, esta não. Serve para o <img> da página e para
 * a fonte de imagem/navegador do OBS ou vMix. ?baixar=1 baixa o arquivo.
 */
export async function GET(req: Request, { params }: { params: { token: string; id: string } }) {
  const baixar = new URL(req.url).searchParams.get("baixar") === "1";
  const url = await urlMaterialEspelho(params.token, params.id, baixar);
  if (!url) return new NextResponse("Não encontrado.", { status: 404 });
  return NextResponse.redirect(url, { headers: { "Cache-Control": "private, max-age=1800" } });
}
