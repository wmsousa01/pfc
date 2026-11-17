import { NextResponse } from "next/server";
import { estadoTela, quadroDaTela } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

/** O que a fonte do OBS mostra agora. Cada consulta também roda o relógio da live. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const quadro = await quadroDaTela(params.token);
  if (!quadro) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  try {
    return NextResponse.json(await estadoTela(quadro), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
