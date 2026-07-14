import Image from "next/image";
import { getActivePartners } from "@/lib/partners";
import { ArrowRight } from "./icons";

export default async function PartnersShowcase() {
  const partners = await getActivePartners();
  if (partners.length === 0) return null;

  return (
    <section className="section-py bg-[#0a0a0a]">
      <div className="container-px">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <span className="section-tag">Quem já está dentro</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Marcas <span className="text-gradient-gold">parceiras</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {partners.map((p) => (
            <a
              key={p.id}
              href={`/go/${p.slug}?src=site`}
              className="card-hover group bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-4">
                {p.logo_url ? (
                  <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                    <Image src={p.logo_url} alt={p.name} fill className="object-contain" sizes="48px" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-500 font-black text-lg flex-shrink-0">
                    {p.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="text-white font-bold group-hover:text-gold-400 transition-colors">
                    {p.name}
                  </div>
                  {p.plan && (
                    <div className="text-white/40 text-xs">{p.plan}</div>
                  )}
                </div>
              </div>
              {p.tagline && (
                <p className="text-white/55 text-sm leading-relaxed flex-1">
                  {p.tagline}
                </p>
              )}
              <span className="text-gold-500 text-sm font-semibold flex items-center gap-1">
                Ver página <ArrowRight className="w-3 h-3" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
