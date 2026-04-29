const features = [
  {
    title: "Conversas reais",
    description: "Sem roteiro engessado. Conteúdo autêntico que conecta.",
  },
  {
    title: "Audiência local qualificada",
    description: "Pessoas de Mogi Guaçu e região que consomem e decidem.",
  },
  {
    title: "Conteúdo multiplataforma",
    description: "YouTube, Instagram, TikTok, Spotify e muito mais.",
  },
  {
    title: "Crescimento orgânico",
    description: "Base construída com consistência e qualidade, não comprada.",
  },
  {
    title: "Forte conexão comunitária",
    description: "O PFC é referência em entretenimento e informação local.",
  },
];

export default function About() {
  return (
    <section className="section-py bg-[#0a0a0a]">
      <div className="container-px">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="section-tag">Sobre o PFC</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
                Um podcast que{" "}
                <span className="text-gradient-gold">move a cidade</span>
              </h2>
            </div>

            <div className="w-12 h-1 bg-gold-500 rounded-full" />

            <p className="text-white/65 text-lg leading-relaxed">
              O <strong className="text-white">Papo Fora da Caixa</strong> é um
              podcast independente de Mogi Guaçu que conversa com empresários,
              profissionais, atletas, influenciadores e personagens que
              movimentam a cidade e a região.
            </p>

            <p className="text-white/50 leading-relaxed">
              Cada episódio é uma janela para a comunidade local — histórias que
              inspiram, negócios que crescem e pessoas que fazem a diferença.
              Nossa audiência não apenas assiste: ela{" "}
              <span className="text-gold-500 font-semibold">confia</span>.
            </p>

            {/* CTA */}
            <a
              href="https://wa.me/5519989331908?text=Quero%20ser%20patrocinador%20do%20Papo%20Fora%20da%20Caixa"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-gold-500 font-semibold hover:text-gold-400 transition-colors group w-fit"
            >
              Conversar sobre uma parceria
              <svg
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </a>
          </div>

          {/* Right: Feature list */}
          <div className="flex flex-col gap-3">
            {features.map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-5 bg-[#111] border border-[#222] rounded-xl hover:border-gold-500/30 transition-colors duration-300"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mt-0.5">
                  <svg
                    className="w-4 h-4 text-gold-500"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                </div>
                <div>
                  <div className="text-white font-semibold">{feature.title}</div>
                  <div className="text-white/45 text-sm mt-1 leading-relaxed">
                    {feature.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
