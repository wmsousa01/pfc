import Image from "next/image";
import { getActivePartners } from "@/lib/partners";
import { ArrowRight } from "./icons";

/**
 * Carrossel contínuo de parceiros na home, logo abaixo do hero.
 * Cliques passam por /go/[slug]?src=home para contar no tracking.
 */
export default async function PartnersStrip() {
  const partners = await getActivePartners();
  if (partners.length === 0) return null;

  // Repete a lista até ter itens suficientes para preencher a tela;
  // o loop do marquee precisa de duas metades idênticas.
  const repeats = Math.max(2, Math.ceil(8 / partners.length));
  const half = Array.from({ length: repeats }, () => partners).flat();
  const track = [...half, ...half];

  return (
    <section className="bg-[#0d0d0d] border-y border-[#1e1e1e] overflow-hidden">
      <div className="py-10 lg:py-12">
        <div className="container-px flex items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span className="section-tag">Parceiros do Fora da Caixa</span>
          </div>
          <a
            href="/parcerias"
            className="text-gold-500 hover:text-gold-400 text-sm font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            Sua marca aqui <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Marquee — pausa no hover; fade nas bordas */}
        <div className="relative marquee-hover">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-28 z-10 bg-gradient-to-r from-[#0d0d0d] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-28 z-10 bg-gradient-to-l from-[#0d0d0d] to-transparent" />

          <div className="flex w-max gap-4 animate-marquee">
            {track.map((p, i) => (
              <a
                key={`${p.id}-${i}`}
                href={`/go/${p.slug}?src=home`}
                title={p.name}
                aria-hidden={i >= track.length / 2}
                tabIndex={i >= track.length / 2 ? -1 : undefined}
                className="group flex items-center gap-4 bg-[#141414] border border-[#262626] hover:border-gold-500/50 rounded-2xl px-6 py-4 transition-colors"
              >
                {p.logo_url ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                    <Image
                      src={p.logo_url}
                      alt={p.name}
                      fill
                      className="object-contain"
                      sizes="48px"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/25 flex items-center justify-center text-gold-500 font-black text-lg flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div className="whitespace-nowrap">
                  <div className="text-white font-bold group-hover:text-gold-400 transition-colors">
                    {p.name}
                  </div>
                  {p.tagline && (
                    <div className="text-white/40 text-xs max-w-[220px] truncate">
                      {p.tagline}
                    </div>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
