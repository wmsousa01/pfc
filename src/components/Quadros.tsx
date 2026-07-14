import { quadros } from "@/lib/config";

// Classes estáticas por accent (Tailwind não aceita classes dinâmicas).
const accentMap: Record<
  string,
  { badge: string; dot: string; hover: string; glow: string }
> = {
  gold: {
    badge: "bg-gold-500/10 text-gold-400 border-gold-500/20",
    dot: "bg-gold-500",
    hover: "hover:border-gold-500/40",
    glow: "group-hover:shadow-[0_0_30px_rgba(255,215,0,0.08)]",
  },
  emerald: {
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
    hover: "hover:border-emerald-500/40",
    glow: "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.08)]",
  },
  sky: {
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    dot: "bg-sky-500",
    hover: "hover:border-sky-500/40",
    glow: "group-hover:shadow-[0_0_30px_rgba(14,165,233,0.08)]",
  },
  rose: {
    badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    dot: "bg-rose-500",
    hover: "hover:border-rose-500/40",
    glow: "group-hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]",
  },
  violet: {
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    dot: "bg-violet-500",
    hover: "hover:border-violet-500/40",
    glow: "group-hover:shadow-[0_0_30px_rgba(139,92,246,0.08)]",
  },
};

export default function Quadros() {
  return (
    <section id="quadros" className="section-py bg-[#0a0a0a] relative overflow-hidden">
      <div className="container-px relative">
        <div className="text-center mb-14 max-w-2xl mx-auto">
          <span className="section-tag">Os quadros</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Cinco programas,{" "}
            <span className="text-gradient-gold">um ecossistema</span>
          </h2>
          <p className="text-white/50 mt-4 leading-relaxed">
            Cada quadro tem identidade, apresentador e público próprios — do
            comportamento ao jornalismo, da educação ao empreendedorismo.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {quadros.map((q) => {
            const a = accentMap[q.accent] ?? accentMap.gold;
            return (
              <div
                key={q.slug}
                className={`group bg-[#111] border border-[#222] rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 ${a.hover} ${a.glow}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-4xl">{q.emoji}</div>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${a.badge}`}
                  >
                    Quadro
                  </span>
                </div>

                <div>
                  <h3 className="text-white font-bold text-xl leading-tight">
                    {q.name}
                  </h3>
                  <p className="text-white/40 text-xs mt-1 uppercase tracking-wide">
                    {q.format}
                  </p>
                </div>

                <p className="text-white/55 text-sm leading-relaxed flex-1">
                  {q.description}
                </p>

                <div className="pt-2 border-t border-[#1e1e1e]">
                  <p className="text-white/30 text-[11px] uppercase tracking-wider mb-2">
                    Episódios de referência
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {q.episodes.slice(0, 3).map((ep, i) => (
                      <li key={i} className="flex items-start gap-2 text-white/60 text-sm">
                        <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.dot}`} />
                        {ep}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}

          {/* CTA card */}
          <div className="group bg-gradient-to-br from-gold-500/[0.08] to-transparent border border-gold-500/20 rounded-2xl p-6 flex flex-col justify-center gap-4">
            <h3 className="text-white font-bold text-xl leading-tight">
              Sua marca em um quadro
            </h3>
            <p className="text-white/55 text-sm leading-relaxed">
              Cada quadro tem um perfil de patrocinador ideal. Descubra qual
              conversa combina com o seu negócio.
            </p>
            <a
              href="/parcerias"
              className="btn-primary px-6 py-3 rounded-xl text-sm text-center font-bold w-fit"
            >
              Ver oportunidades
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
