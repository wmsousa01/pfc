import { NextResponse, type NextRequest } from "next/server";
import { getPartnerByPanelToken } from "@/lib/partner-leads";
import { getPanelExtras } from "@/lib/client-area";
import { fetchChatAttachment } from "@/lib/jira";

export const dynamic = "force-dynamic";

/**
 * Arquivo que o time anexou na conversa do Jira. O anexo do Jira exige login,
 * então o site baixa com o token dele e repassa — só se o anexo for da
 * conversa DESTE cliente.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const q = request.nextUrl.searchParams;
  const partner = await getPartnerByPanelToken(q.get("token") ?? "");
  const id = q.get("id") ?? "";
  if (!partner || partner.slug !== params.slug || !/^\d+$/.test(id)) {
    return new NextResponse("Não encontrado", { status: 404 });
  }
  const { jiraChat } = await getPanelExtras(partner.id);
  const res = jiraChat ? await fetchChatAttachment(jiraChat, id) : null;
  if (!res?.body) return new NextResponse("Não encontrado", { status: 404 });

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition": res.headers.get("content-disposition") ?? "attachment",
      "Cache-Control": "private, no-store",
    },
  });
}
