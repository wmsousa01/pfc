const stats = [
  {
    number: "+90 mil",
    label: "Visualizações mensais",
    description: "Alcance orgânico crescente mês a mês",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
      </svg>
    ),
  },
  {
    number: "+500h",
    label: "Horas assistidas",
    description: "Audiência engajada e fiel ao conteúdo",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
      </svg>
    ),
  },
  {
    number: "Diário",
    label: "Conteúdo nas redes",
    description: "Presença constante no feed da audiência",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 011.25 1.25A1.25 1.25 0 0117.25 8 1.25 1.25 0 0116 6.75a1.25 1.25 0 011.25-1.25M12 7a5 5 0 015 5 5 5 0 01-5 5 5 5 0 01-5-5 5 5 0 015-5m0 2a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3z" />
      </svg>
    ),
  },
  {
    number: "Local",
    label: "Público engajado",
    description: "Conexão real com a cidade e região",
    icon: (
      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    ),
  },
];

export default function SocialProof() {
  return (
    <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
      <div className="container-px">
        {/* Header */}
        <div className="text-center mb-14">
          <p className="text-white/50 text-lg leading-relaxed max-w-2xl mx-auto">
            Um ecossistema de mídia local com{" "}
            <span className="text-gold-500 font-semibold">alcance</span>,{" "}
            <span className="text-gold-500 font-semibold">frequência</span> e{" "}
            <span className="text-gold-500 font-semibold">confiança</span>.
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-4"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center text-gold-500">
                {stat.icon}
              </div>

              {/* Number */}
              <div>
                <div className="text-3xl lg:text-4xl font-black text-gold-500 leading-none">
                  {stat.number}
                </div>
                <div className="text-white font-semibold mt-1 text-sm lg:text-base">
                  {stat.label}
                </div>
                <div className="text-white/40 text-xs mt-1 leading-relaxed">
                  {stat.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
