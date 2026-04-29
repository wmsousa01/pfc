const steps = [
  {
    number: "01",
    title: "Conversamos sobre sua marca",
    description:
      "Uma conversa rápida pelo WhatsApp para entender seus objetivos, público-alvo e o que faz sentido para o seu negócio.",
  },
  {
    number: "02",
    title: "Definimos o melhor formato",
    description:
      "Apresentamos as opções de planos e formatos de exposição mais adequados para sua estratégia.",
  },
  {
    number: "03",
    title: "Criamos a ativação",
    description:
      "Nossa equipe desenvolve o conteúdo, a arte e a integração da sua marca no ecossistema PFC.",
  },
  {
    number: "04",
    title: "Sua marca entra no ecossistema",
    description:
      "A parceria vai ao ar. Sua marca começa a aparecer para milhares de pessoas da cidade e região.",
  },
  {
    number: "05",
    title: "Você acompanha os resultados",
    description:
      "Dependendo do plano, você recebe relatórios com métricas de alcance, visualizações e engajamento.",
  },
];

export default function HowItWorks() {
  return (
    <section className="section-py bg-[#111]">
      <div className="container-px">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="section-tag">Como funciona</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Do contato ao{" "}
            <span className="text-gradient-gold">ar em dias</span>
          </h2>
          <p className="text-white/50 mt-4 max-w-xl mx-auto">
            Processo simples, sem burocracia. A gente resolve tudo pelo
            WhatsApp.
          </p>
        </div>

        {/* Timeline */}
        <div className="max-w-3xl mx-auto">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-7 top-8 bottom-8 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/20 to-transparent hidden sm:block" />

            <div className="flex flex-col gap-8">
              {steps.map((step, i) => (
                <div key={i} className="flex gap-6 group">
                  {/* Number circle */}
                  <div className="flex-shrink-0 relative z-10">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center font-black text-sm transition-all duration-300 ${
                        i === 0
                          ? "bg-gold-500 text-black"
                          : "bg-[#1a1a1a] border border-[#333] text-white/50 group-hover:border-gold-500/40 group-hover:text-gold-500"
                      }`}
                    >
                      {step.number}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-2 pt-2">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-white font-bold text-lg group-hover:text-gold-400 transition-colors duration-300">
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-white/50 leading-relaxed text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom CTA hint */}
        <div className="text-center mt-14">
          <p className="text-white/40 text-sm mb-4">
            Pronto para dar o primeiro passo?
          </p>
          <a
            href="https://wa.me/5519989331908?text=Quero%20ser%20patrocinador%20do%20Papo%20Fora%20da%20Caixa"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Começar agora
          </a>
        </div>
      </div>
    </section>
  );
}
