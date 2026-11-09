import { NextResponse } from "next/server";
import { sugerir } from "@/lib/agenda/sugestoes";

export const dynamic = "force-dynamic";

/** Sugestão de edição ou comentário de quem abriu o roteiro pelo link. */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  try {
    await sugerir(params.token, {
      materia: body?.materia,
      campo: body?.campo,
      proposta: body?.proposta,
      comentario: body?.comentario,
      autor: body?.autor,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
