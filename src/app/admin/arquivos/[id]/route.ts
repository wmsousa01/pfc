import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getClientFile, signedDownloadUrl } from "@/lib/client-area";

export const dynamic = "force-dynamic";

/**
 * Link que vai no comentário do Jira para o time baixar o arquivo do cliente.
 * O bucket é privado: exige login de admin e gera um link de 5 minutos.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const file = await getClientFile(params.id);
  const url = file ? await signedDownloadUrl(file) : null;
  return url
    ? NextResponse.redirect(url)
    : new NextResponse("Não encontrado", { status: 404 });
}
