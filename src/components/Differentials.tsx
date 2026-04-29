const bullets = [
  "Baixo custo comparado à mídia tradicional",
  "Alta frequência de exposição por episódio",
  "Associação direta com conteúdo local de qualidade",
  "Confiança gerada pela conversa genuína",
  "Possibilidade de conteúdo 100% personalizado",
];

export default function Differentials() {
  return (
    <section className="section-py bg-[#0a0a0a] relative overflow-hidden">
      {/* BG watermark */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[200px] lg:text-[300px] font-black text-white/[0.015] select-none pointer-events-none leading-none pr-8">
        PFC
      </div>

      <div className="container-px relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left */}
          <div className="flex flex-col gap-8">
            <div>
              <span className="section-tag">Diferencial</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
                Não vendemos{" "}
                <span className="text-gradient-gold">espaço.</span>
                <br />
                Criamos{" "}
                <span className="text-gradient-gold">presença.</span>
              </h2>
            </div>

            <div className="w-12 h-1 bg-gold-500 rounded-full" />

            <p className="text-white/60 text-lg leading-relaxed">
              Enquanto a mídia tradicional entrega anúncios isolados, o PFC
              integra sua marca em uma{" "}
              <strong className="text-white">conversa real com a cidade</strong>
              . A marca aparece no conteúdo, nos cortes, nos bastidores e na
              rotina da audiência.
            </p>
          </div>

          {/* Right: bullets */}
          <div className="flex flex-col gap-4">
            {bullets.map((bullet, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-5 bg-[#111] border border-[#222] rounded-xl hover:border-gold-500/30 transition-colors duration-300 group"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center group-hover:bg-gold-500/20 transition-colors duration-300">
                  <svg
                    className="w-5 h-5 text-gold-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <span className="text-white/75 group-hover:text-white transition-colors duration-300">
                  {bullet}
                </span>
              </div>
            ))}

            {/* Quote card */}
            <div className="mt-2 p-6 bg-gradient-to-r from-gold-500/10 to-transparent border border-gold-500/20 rounded-xl">
              <p className="text-gold-400 font-semibold italic text-sm leading-relaxed">
                &ldquo;A audiência local é mais valiosa do que parece. Ela é
                quem compra na sua cidade, indica para amigos e forma opinião.&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
