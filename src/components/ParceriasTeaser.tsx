import { partnershipFormats, channelStats } from "@/lib/config";
import { ArrowRight } from "./icons";

export default function ParceriasTeaser() {
  return (
    <section className="section-py bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gold-500/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="container-px relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="section-tag">Para marcas</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
                Sua marca no{" "}
                <span className="text-gradient-gold">centro da conversa</span>
              </h2>
            </div>
            <p className="text-white/60 text-lg leading-relaxed">
              Não vendemos espaço, criamos presença. Sua marca participa da
              conversa que a cidade acompanha toda semana — e agora ganha uma{" "}
              <strong className="text-white">página exclusiva</strong> com{" "}
              <strong className="text-white">QR code no episódio</strong> e{" "}
              <strong className="text-white">tracking de acessos</strong>.
            </p>

            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {[
                { v: channelStats.views12m, l: "views/12 meses" },
                { v: "Local", l: "audiência qualificada" },
                { v: "5", l: "quadros temáticos" },
              ].map((s, i) => (
                <div key={i}>
                  <div className="text-gold-500 font-black text-xl">{s.v}</div>
                  <div className="text-white/40 text-xs">{s.l}</div>
                </div>
              ))}
            </div>

            <a
              href="/parcerias"
              className="btn-primary px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2 w-fit"
            >
              Ver formatos e planos
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Right: formats grid */}
          <div className="grid sm:grid-cols-2 gap-3">
            {partnershipFormats.map((f, i) => (
              <div
                key={i}
                className="bg-[#111] border border-[#222] rounded-xl p-4 flex flex-col gap-2 hover:border-gold-500/30 transition-colors"
              >
                <div className="text-2xl">{f.emoji}</div>
                <div className="text-white font-semibold text-sm">{f.title}</div>
                <div className="text-white/40 text-xs leading-relaxed">
                  {f.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
