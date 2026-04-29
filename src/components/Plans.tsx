const plans = [
  {
    id: "apoio",
    name: "Apoio",
    tagline: "Ideal para marcas que querem começar.",
    featured: false,
    features: [
      "Inserções pontuais no conteúdo",
      "Stories de divulgação",
      "Link na descrição do YouTube",
      "Participação em ações específicas",
    ],
    cta: "Quero o plano Apoio",
    href: "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Apoio%20do%20PFC",
  },
  {
    id: "patrocinador",
    name: "Patrocinador",
    tagline: "Ideal para presença recorrente.",
    featured: true,
    badge: "Mais Popular",
    features: [
      "Logo no estúdio em todos os episódios",
      "Menção nos episódios ao vivo",
      "Presença em cortes e Reels",
      "Stories com CTA direto",
      "Link fixo na descrição",
      "Possibilidade de collab no Instagram",
    ],
    cta: "Quero ser Patrocinador",
    href: "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Patrocinador%20do%20PFC",
  },
  {
    id: "master",
    name: "Master",
    tagline: "Ideal para máxima presença e exclusividade.",
    featured: false,
    features: [
      "Exclusividade por segmento de mercado",
      "Presença em todos os episódios",
      "Destaque premium no estúdio",
      "Menções ao vivo em todos os eps.",
      "Conteúdos especiais personalizados",
      "Episódio temático da sua empresa",
      "PFC Visita — gravação no local",
      "Relatório mensal de resultados",
    ],
    cta: "Quero ser Master",
    href: "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Master%20do%20PFC",
  },
];

export default function Plans() {
  return (
    <section id="planos" className="section-py bg-[#111] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gold-500/4 rounded-full blur-[100px]" />
      </div>

      <div className="container-px relative">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="section-tag">Planos de Patrocínio</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Escolha o formato{" "}
            <span className="text-gradient-gold">ideal para sua marca</span>
          </h2>
          <p className="text-white/50 mt-4 max-w-xl mx-auto">
            Fale com a gente pelo WhatsApp e receba os valores e detalhes de
            cada plano.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
                plan.featured
                  ? "bg-[#0d0d0d] border-2 border-gold-500 shadow-[0_0_40px_rgba(255,215,0,0.12)] scale-[1.02]"
                  : "bg-[#0d0d0d] border border-[#2a2a2a] hover:border-gold-500/40"
              }`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <span className="bg-gold-500 text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan name */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      plan.featured ? "bg-gold-500" : "bg-white/20"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold uppercase tracking-widest ${
                      plan.featured ? "text-gold-500" : "text-white/40"
                    }`}
                  >
                    Plano
                  </span>
                </div>
                <h3
                  className={`text-3xl font-black ${
                    plan.featured ? "text-gold-500" : "text-white"
                  }`}
                >
                  {plan.name}
                </h3>
                <p className="text-white/50 text-sm mt-2 leading-relaxed">
                  {plan.tagline}
                </p>
              </div>

              {/* Divider */}
              <div
                className={`w-full h-px mb-6 ${
                  plan.featured ? "bg-gold-500/30" : "bg-[#222]"
                }`}
              />

              {/* Features */}
              <div className="flex-1 flex flex-col gap-3 mb-8">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
                        plan.featured
                          ? "bg-gold-500/20 border border-gold-500/40"
                          : "bg-white/5 border border-white/10"
                      }`}
                    >
                      <svg
                        className={`w-3 h-3 ${
                          plan.featured ? "text-gold-500" : "text-white/50"
                        }`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                      </svg>
                    </div>
                    <span className="text-white/70 text-sm leading-snug">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <a
                href={plan.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full py-4 rounded-xl font-bold text-center transition-all duration-250 flex items-center justify-center gap-2 ${
                  plan.featured
                    ? "btn-primary"
                    : "btn-outline hover:bg-white/5"
                }`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                {plan.cta}
              </a>
            </div>
          ))}
        </div>

        {/* Bottom note */}
        <p className="text-center text-white/30 text-sm mt-8">
          Todos os valores são personalizados conforme objetivos e período.
          Fale com a gente para saber mais.
        </p>
      </div>
    </section>
  );
}
