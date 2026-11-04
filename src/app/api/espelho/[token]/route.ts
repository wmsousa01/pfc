import { NextResponse } from "next/server";
import { episodioPorEspelho, escolherTela, imagemNaTela, materiaisDoEspelho, moverEspelho, revisaoEspelho } from "@/lib/agenda/espelho";

export const dynamic = "force-dynamic";

type Ctx = { params: { token: string } };

/**
 * O bloco no ar, a imagem na tela do OBS e a revisão do roteiro: o espelho
 * e a tela consultam a cada poucos segundos.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const ep = await episodioPorEspelho(params.token);
  if (!ep) return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  const materiais = await materiaisDoEspelho(ep.id);
  return NextResponse.json(
    { atual: ep.espelho_atual, tela: imagemNaTela(ep, materiais), rev: revisaoEspelho(ep, materiais) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * { atual: número do bloco | null } põe o bloco no ar; { imagem: id | "nenhuma" | null }
 * escolhe o que a tela do OBS mostra. Quem está com o link controla os dois.
 */
export async function POST(req: Request, { params }: Ctx) {
  const body = (await req.json().catch(() => null)) as { atual?: unknown; imagem?: unknown } | null;
  try {
    if (body && "imagem" in body) {
      await escolherTela(params.token, typeof body.imagem === "string" ? body.imagem : null);
      return NextResponse.json({ ok: true });
    }
    const atual = typeof body?.atual === "number" ? body.atual : null;
    return NextResponse.json({ atual: await moverEspelho(params.token, atual) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
