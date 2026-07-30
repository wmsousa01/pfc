import { NextResponse, type NextRequest } from "next/server";
import { recordClick } from "@/lib/partners";

export const dynamic = "force-dynamic";

/**
 * Destino do QR code exibido durante o episódio: /go/{slug}?src=qr
 * Registra o acesso e redireciona para a landing do parceiro.
 * Se o parceiro não existir/estiver inativo, cai na página de parcerias.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const source = request.nextUrl.searchParams.get("src") ?? "qr";
  const partner = await recordClick(params.slug, {
    source,
    referer: request.headers.get("referer"),
    userAgent: request.headers.get("user-agent"),
  });

  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = partner ? `/parceiros/${params.slug}` : "/parcerias";
  // Leva a origem adiante: a triagem da landing marca de onde veio o lead
  // (a página segue estática — quem lê o parâmetro é o formulário, no cliente).
  if (partner) url.searchParams.set("src", source);
  return NextResponse.redirect(url);
}
