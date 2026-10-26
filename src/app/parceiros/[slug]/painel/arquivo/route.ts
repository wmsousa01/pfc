import { NextResponse, type NextRequest } from "next/server";
import { getPartnerByPanelToken } from "@/lib/partner-leads";
import { getClientFile, signedDownloadUrl } from "@/lib/client-area";

export const dynamic = "force-dynamic";

/** Download de um arquivo que o próprio cliente enviou (link de 5 min). */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const q = request.nextUrl.searchParams;
  const partner = await getPartnerByPanelToken(q.get("token") ?? "");
  const file = await getClientFile(q.get("id") ?? "");
  if (!partner || partner.slug !== params.slug || !file || file.partner_id !== partner.id) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  const url = await signedDownloadUrl(file);
  return url
    ? NextResponse.redirect(url)
    : new NextResponse("Indisponível", { status: 503 });
}
