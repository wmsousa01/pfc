import Image from "next/image";
import { getActivePartners } from "@/lib/partners";
import { ArrowRight } from "./icons";

/**
 * Faixa compacta de parceiros exibida na home, logo abaixo do hero.
 * Cliques passam por /go/[slug]?src=home para contar no tracking.
 */
export default async function PartnersStrip() {
  const partners = await getActivePartners();
  if (partners.length === 0) return null;

  return (
    <section className="bg-[#0a0a0a] border-y border-[#1a1a1a]">
      <div className="container-px py-8">
        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10">
          <span className="text-white/35 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
            Parceiros do Fora da Caixa
          </span>

          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 flex-1">
            {partners.map((p) => (
              <a
                key={p.id}
                href={`/go/${p.slug}?src=home`}
                title={p.name}
                className="group flex items-center gap-3 opacity-60 hover:opacity-100 transition-opacity"
              >
                {p.logo_url ? (
                  <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                    <Image
                      src={p.logo_url}
                      alt={p.name}
                      fill
                      className="object-contain"
                      sizes="36px"
                    />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-500 font-black flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                )}
                <span className="text-white/70 group-hover:text-white font-semibold text-sm whitespace-nowrap transition-colors">
                  {p.name}
                </span>
              </a>
            ))}
          </div>

          <a
            href="/parcerias"
            className="text-gold-500 hover:text-gold-400 text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            Sua marca aqui <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
