const exposures = [
  {
    icon: "📺",
    title: "Logo na TV do estúdio",
    description: "Sua marca visível em todo episódio gravado.",
  },
  {
    icon: "🎙️",
    title: "Menção ao vivo",
    description: "O apresentador fala sobre sua empresa com naturalidade.",
  },
  {
    icon: "🛍️",
    title: "Product placement",
    description: "Produto integrado ao cenário ou ao episódio.",
  },
  {
    icon: "📲",
    title: "QR Code na tela",
    description: "Ação direta para o espectador acessar sua marca.",
  },
  {
    icon: "🔗",
    title: "Link na descrição",
    description: "Presença no YouTube com link clicável permanente.",
  },
  {
    icon: "🎬",
    title: "Reels patrocinados",
    description: "Cortes curtos com sua marca em destaque.",
  },
  {
    icon: "📣",
    title: "Stories com CTA",
    description: "Chamadas diretas para o público agir agora.",
  },
  {
    icon: "🤝",
    title: "Collab no Instagram",
    description: "Publicação conjunta PFC + sua empresa.",
  },
  {
    icon: "🎯",
    title: "Episódio temático",
    description: "Um episódio dedicado ao universo da sua marca.",
  },
  {
    icon: "🏢",
    title: "Gravação na empresa",
    description: "O PFC vai até você. Conteúdo produzido no seu espaço.",
  },
];

export default function Exposure() {
  return (
    <section className="section-py bg-[#0a0a0a]">
      <div className="container-px">
        {/* Header */}
        <div className="max-w-2xl mb-14">
          <span className="section-tag">Formas de exposição</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Sua marca em{" "}
            <span className="text-gradient-gold">múltiplos formatos</span>
          </h2>
          <p className="text-white/50 mt-4 leading-relaxed">
            Escolha os formatos que mais fazem sentido para o seu negócio ou
            combine para maximizar o impacto.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {exposures.map((item, i) => (
            <div
              key={i}
              className="card-hover group bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-3"
            >
              {/* Icon */}
              <div className="text-3xl">{item.icon}</div>

              {/* Content */}
              <div>
                <div className="text-white font-semibold text-sm group-hover:text-gold-400 transition-colors duration-300">
                  {item.title}
                </div>
                <div className="text-white/40 text-xs mt-1 leading-relaxed">
                  {item.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
