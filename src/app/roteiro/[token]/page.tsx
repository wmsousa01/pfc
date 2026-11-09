import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RoteiroRevisao from "@/components/agenda/RoteiroRevisao";
import { episodioPorEspelho } from "@/lib/agenda/espelho";
import { apresentadoresDoEpisodio, quandoLongo } from "@/lib/agenda/store";
import { sugestoesDe } from "@/lib/agenda/sugestoes";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";

export const dynamic = "force-dynamic";

// Link da equipe e do apresentador: fora dos buscadores.
export const metadata: Metadata = { title: "Roteiro para revisão | Fora da Caixa", robots: { index: false, follow: false } };

/** O roteiro para o apresentador e a equipe lerem antes do programa e sugerirem ajustes. */
export default async function RoteiroPage({ params }: { params: { token: string } }) {
  const ep = await episodioPorEspelho(params.token);
  if (!ep) notFound();
  const [sugestoes, hosts] = await Promise.all([sugestoesDe(ep.id), apresentadoresDoEpisodio(ep)]);
  return (
    <RoteiroRevisao
      token={params.token}
      quadro={isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro}
      quando={quandoLongo(ep.inicio)}
      equipe={hosts.map((h) => h.nome)}
      materias={ep.roteiro?.materias ?? []}
      sugestoes={sugestoes.map((s) => ({
        id: s.id,
        materia: s.materia,
        campo: s.campo,
        original: s.original,
        proposta: s.proposta,
        comentario: s.comentario,
        autor: s.autor,
        status: s.status,
        created_at: s.created_at,
      }))}
    />
  );
}
