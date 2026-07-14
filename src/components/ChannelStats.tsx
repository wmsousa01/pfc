import { channelStats } from "@/lib/config";

const primary = [
  { number: channelStats.views12m, label: "Views em 12 meses", sub: "Melhor mês: " + channelStats.bestMonth + " (" + channelStats.bestMonthLabel + ")" },
  { number: channelStats.totalViews, label: "Views acumulados", sub: "Em ~14 meses de canal" },
  { number: channelStats.watchHoursYear, label: "Horas assistidas/ano", sub: "Audiência engajada e fiel" },
  { number: channelStats.weeklyContent, label: "Conteúdos por semana", sub: "~40 Shorts + episódios + live" },
];

const secondary = [
  { number: channelStats.subscribers, label: "Inscritos" },
  { number: channelStats.totalVideos, label: "Vídeos publicados" },
  { number: channelStats.likes12m, label: "Likes (12 meses)" },
  { number: channelStats.activeSince, label: "No ar desde" },
];

export default function ChannelStats() {
  return (
    <section id="numeros" className="section-py bg-[#111] border-y border-[#1e1e1e]">
      <div className="container-px">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <span className="section-tag">Números do canal</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Alcance real,{" "}
            <span className="text-gradient-gold">crescimento orgânico</span>
          </h2>
          <p className="text-white/50 mt-4 leading-relaxed">
            Um ecossistema de mídia local com alcance, frequência e confiança.
            Dados de junho/2026.
          </p>
        </div>

        {/* Primary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {primary.map((stat, i) => (
            <div
              key={i}
              className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-2"
            >
              <div className="text-3xl lg:text-4xl font-black text-gold-500 leading-none">
                {stat.number}
              </div>
              <div className="text-white font-semibold text-sm lg:text-base">
                {stat.label}
              </div>
              <div className="text-white/40 text-xs leading-relaxed">
                {stat.sub}
              </div>
            </div>
          ))}
        </div>

        {/* Secondary row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
          {secondary.map((stat, i) => (
            <div
              key={i}
              className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-5 py-4 flex items-baseline justify-between gap-2"
            >
              <span className="text-white/50 text-xs">{stat.label}</span>
              <span className="text-white font-black text-lg">{stat.number}</span>
            </div>
          ))}
        </div>

        {/* Audience */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <span className="text-white/40 uppercase tracking-widest text-xs font-bold">
            Audiência
          </span>
          <span className="text-white/70">🇧🇷 Brasil — Mogi Guaçu e interior de SP</span>
          <span className="text-white/50">🇵🇹 Portugal</span>
          <span className="text-white/50">🇺🇸 Comunidade brasileira nos EUA</span>
        </div>
      </div>
    </section>
  );
}
