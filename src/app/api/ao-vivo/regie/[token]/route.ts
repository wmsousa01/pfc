import { NextResponse } from "next/server";
import { acaoRegie, estadoRegie, iniciarSessao, quadroDaRegie, type AcaoRegie } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

type Ctx = { params: { token: string } };

const erro = (e: unknown, status = 400) =>
  NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status });

export async function GET(_req: Request, { params }: Ctx) {
  const quadro = await quadroDaRegie(params.token);
  if (!quadro) return erro("Link inválido.", 404);
  try {
    return NextResponse.json(await estadoRegie(quadro), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return erro(e, 500);
  }
}

function acaoValida(b: Record<string, unknown>): AcaoRegie | null {
  switch (b.acao) {
    case "segurar":
      return typeof b.valor === "boolean" ? { acao: "segurar", valor: b.valor } : null;
    case "agora":
    case "pular":
    case "tirar":
      return typeof b.id === "string" ? { acao: b.acao, id: b.id } : null;
    case "encerramento":
    case "encerrar":
      return { acao: b.acao };
    default:
      return null;
  }
}

/**
 * { acao: "iniciar", modalidade?, episodio_id?, duracao_min, titulo? } começa a live;
 * as outras ações (segurar, agora, pular, tirar, encerramento, encerrar) mexem nela.
 * Quem tem o link da régie controla, como no espelho.
 */
export async function POST(req: Request, { params }: Ctx) {
  const quadro = await quadroDaRegie(params.token);
  if (!quadro) return erro("Link inválido.", 404);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return erro("Pedido vazio.");
  try {
    if (b.acao === "iniciar") {
      const str = (k: string) => (typeof b[k] === "string" && (b[k] as string).trim() ? (b[k] as string).trim().slice(0, 200) : null);
      await iniciarSessao(quadro, {
        modalidade: str("modalidade"),
        episodio_id: str("episodio_id"),
        titulo: str("titulo"),
        duracao_min: Number(b.duracao_min) || 60,
        por: "régie",
      });
    } else {
      const a = acaoValida(b);
      if (!a) return erro("Ação desconhecida.");
      await acaoRegie(quadro, a);
    }
    return NextResponse.json(await estadoRegie(quadro), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return erro(e);
  }
}
