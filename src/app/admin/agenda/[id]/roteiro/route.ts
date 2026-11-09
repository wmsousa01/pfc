import { requireAdmin } from "@/lib/auth";
import { roteiroTexto } from "@/lib/agenda/roteiro";
import { getEpisodio, quandoLongo } from "@/lib/agenda/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";

export const dynamic = "force-dynamic";

/** O roteiro do espelho em .txt, no formato do documento do apresentador. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  await requireAdmin();
  const ep = await getEpisodio(params.id);
  if (!ep?.roteiro) return new Response("Sem roteiro.", { status: 404 });
  const quadro = isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro;
  const titulo = `${quadro} – ${quandoLongo(ep.inicio)}`;
  const nome = `${quadro} ${ep.inicio.slice(0, 10)}.txt`;
  return new Response(roteiroTexto(titulo, ep.roteiro.materias), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
    },
  });
}
