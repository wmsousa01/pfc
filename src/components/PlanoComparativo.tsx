import { COMPARATIVO, PLACEMENT_IDS } from "@/lib/placements";
import { plans } from "@/lib/planos";
import { PlacementGallery } from "@/components/PlacementMockup";

/**
 * /parcerias: "o que cada plano inclui" em tabela, e a galeria de mockups de
 * onde a marca aparece. Cada linha da tabela leva ao mockup correspondente.
 */

function Celula({ v }: { v: boolean | string }) {
  if (v === true) return <span className="text-gold-500 font-black">✓</span>;
  if (v === false) return <span className="text-white/20">—</span>;
  return <span className="text-white/80 text-xs font-semibold">{v}</span>;
}

export default function PlanoComparativo() {
  const cols = ["apoio", "patrocinador", "master"] as const;
  const nome = (id: string) => plans.find((p) => p.id === id)?.name ?? id;

  return (
    <section id="o-que-inclui" className="section-py bg-[#0a0a0a]">
      <div className="container-px">
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <span className="section-tag">O que cada plano inclui</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Lado a lado, <span className="text-gradient-gold">sem letra miúda</span>
          </h2>
          <p className="text-white/50 mt-4 leading-relaxed">
            Cada plano tem tudo do anterior e mais um pouco. Clique em um item para ver como ele aparece na tela.
          </p>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 max-w-4xl mx-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr>
                <th className="text-left text-white/35 text-[11px] font-bold uppercase tracking-widest pb-4 pr-4">Item</th>
                {cols.map((c) => (
                  <th key={c} className={`pb-4 px-3 text-center font-black ${c === "patrocinador" ? "text-gold-500" : "text-white"}`}>
                    {nome(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARATIVO.map((r) => (
                <tr key={r.item} className="border-t border-[#222]">
                  <td className="py-3 pr-4 text-white/75">
                    {r.placement ? (
                      <a href={`#placement-${r.placement}`} className="underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-gold-500">
                        {r.item}
                      </a>
                    ) : (
                      r.item
                    )}
                  </td>
                  {cols.map((c) => (
                    <td key={c} className={`py-3 px-3 text-center ${c === "patrocinador" ? "bg-gold-500/[0.04]" : ""}`}>
                      <Celula v={r[c]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-20 text-center mb-10 max-w-2xl mx-auto">
          <span className="section-tag">Onde sua marca aparece</span>
          <h3 className="text-2xl sm:text-3xl font-black mt-3 leading-tight">
            Veja antes de contratar, <span className="text-gradient-gold">tela por tela</span>
          </h3>
          <p className="text-white/50 mt-3 leading-relaxed text-sm">
            Ilustrações de cada entrega. No{" "}
            <a href="/monte-seu-plano" className="text-gold-500 underline underline-offset-4">
              Monte seu plano
            </a>{" "}
            elas aparecem com o nome e a cor da sua marca.
          </p>
        </div>
        <PlacementGallery ids={PLACEMENT_IDS} marca={{ nome: "Sua marca", cor: "#2563eb", quadro: "PFC Esporte Clube" }} />
      </div>
    </section>
  );
}
