const platforms = [
  {
    icon: "▶",
    name: "YouTube",
    description: "Episódios completos com alta retenção e busca orgânica.",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
  {
    icon: "📱",
    name: "Reels, Shorts & TikTok",
    description: "Cortes virais que ampliam o alcance para novos públicos.",
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
  },
  {
    icon: "📸",
    name: "Instagram",
    description: "Stories, bastidores e conteúdo especial com parceiros.",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
];

const formats = [
  {
    name: "PFC News",
    description: "Notícias e novidades da cidade em formato dinâmico.",
  },
  {
    name: "PFC Visita",
    description: "O podcast vai até a empresa e conta sua história.",
  },
  {
    name: "PFC Esporte Clube",
    description: "Conteúdo dedicado ao universo esportivo local.",
  },
];

export default function Ecosystem() {
  return (
    <section className="section-py bg-[#111] relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gold-500/3 rounded-full blur-[100px]" />
      </div>

      <div className="container-px relative">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="section-tag">Ecossistema de conteúdo</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Presença em{" "}
            <span className="text-gradient-gold">todas as telas</span>
          </h2>
          <p className="text-white/50 mt-4 max-w-xl mx-auto">
            Do estúdio ao feed. Sua marca aparece antes, durante e depois do
            episódio.
          </p>
        </div>

        {/* Platforms grid */}
        <div className="grid sm:grid-cols-3 gap-5 mb-8">
          {platforms.map((platform, i) => (
            <div
              key={i}
              className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl border flex items-center justify-center text-2xl ${platform.bg}`}
              >
                {platform.icon}
              </div>
              <div>
                <div className={`font-bold text-lg ${platform.color}`}>
                  {platform.name}
                </div>
                <div className="text-white/50 text-sm mt-1 leading-relaxed">
                  {platform.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Formats */}
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {formats.map((format, i) => (
            <div
              key={i}
              className="flex items-center gap-4 p-4 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl hover:border-gold-500/30 transition-colors duration-300"
            >
              <div className="w-2 h-2 rounded-full bg-gold-500 flex-shrink-0" />
              <div>
                <div className="text-white font-semibold text-sm">
                  {format.name}
                </div>
                <div className="text-white/40 text-xs mt-0.5">
                  {format.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Highlight banner */}
        <div className="relative rounded-2xl overflow-hidden border border-gold-500/30 bg-gradient-to-r from-gold-500/10 via-gold-500/5 to-transparent p-8 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0d0d0d] to-transparent opacity-80" />
          <div className="relative">
            <p className="text-2xl sm:text-3xl font-black text-white leading-snug">
              Sua marca aparece{" "}
              <span className="text-gold-500">antes, durante</span> e{" "}
              <span className="text-gold-500">depois</span> do episódio.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
