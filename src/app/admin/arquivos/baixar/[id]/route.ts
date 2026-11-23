import { NextResponse } from "next/server";
import { requireAcesso } from "@/lib/auth";
import { getArquivo, linkDeDownload } from "@/lib/arquivos/store";

export const dynamic = "force-dynamic";

/** Baixar da central de arquivos: confere o login e manda para o link do R2 (salva com o nome original). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAcesso("arquivos.ver");
  const a = await getArquivo(params.id);
  if (!a || a.status !== "pronto") return new NextResponse("Não encontrado", { status: 404 });
  return NextResponse.redirect(await linkDeDownload(a, 1));
}
