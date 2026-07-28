import { NextResponse, type NextRequest } from "next/server";
import { getResellerByCode } from "@/lib/shop";

export const dynamic = "force-dynamic";

/**
 * Link de divulgação do revendedor: /r/{slug}
 * Manda para a loja já com o cupom aplicado e guarda a atribuição em cookie,
 * para o pedido continuar creditado a ele mesmo que o cliente navegue antes
 * de finalizar.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const reseller = await getResellerByCode(params.slug);

  const url = request.nextUrl.clone();
  url.search = "";
  url.pathname = "/loja";
  if (reseller) url.searchParams.set("ref", reseller.slug);

  const response = NextResponse.redirect(url);
  if (reseller) {
    response.cookies.set("pfc_ref", reseller.slug, {
      maxAge: 60 * 60 * 24 * 30, // 30 dias
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });
  }
  return response;
}
