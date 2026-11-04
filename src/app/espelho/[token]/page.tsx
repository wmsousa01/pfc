import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EspelhoAoVivo from "@/components/agenda/EspelhoAoVivo";
import { blocoDa, blocosDoEspelho, episodioPorEspelho, imagemNaTela, materiaisDoEspelho, revisaoEspelho } from "@/lib/agenda/espelho";
import { apresentadoresDoEpisodio, quandoLongo } from "@/lib/agenda/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";

export const dynamic = "force-dynamic";

// Link da equipe técnica: fora dos buscadores.
export const metadata: Metadata = { title: "Espelho | Fora da Caixa", robots: { index: false, follow: false } };

export default async function EspelhoPage({ params }: { params: { token: string } }) {
  const ep = await episodioPorEspelho(params.token);
  if (!ep) notFound();
  const [materiais, hosts] = await Promise.all([materiaisDoEspelho(ep.id), apresentadoresDoEpisodio(ep)]);
  const blocos = blocosDoEspelho(ep.briefing, ep.roteiro);

  return (
    <EspelhoAoVivo
      token={params.token}
      quadro={isQuadroId(ep.quadro) ? QUADROS[ep.quadro].name : ep.quadro}
      quando={quandoLongo(ep.inicio)}
      tema={ep.tema}
      equipe={hosts.map((h) => ({ nome: h.nome, papel: h.papel }))}
      cuidados={ep.briefing?.cuidados || null}
      blocos={blocos}
      imagens={materiais.map((m) => ({ id: m.id, nome: m.nome, mime: m.mime, bloco: blocoDa(m, blocos.length) }))}
      atual={ep.espelho_atual}
      naTela={imagemNaTela(ep, materiais)?.id ?? null}
      rev={revisaoEspelho(ep, materiais)}
    />
  );
}
