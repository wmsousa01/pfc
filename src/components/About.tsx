const milestones = [
  {
    year: "Abr/2025",
    title: "Nasce o Papo Fora da Caixa",
    desc: "Willian Marinho decide não deixar mais as melhores conversas morrerem na sala de reunião. Programa gravado sobre marketing e pessoas.",
  },
  {
    year: "2025",
    title: "De gravado para ao vivo",
    desc: "A migração para as lives transforma o projeto em acontecimento semanal — espontaneidade e interação em tempo real.",
  },
  {
    year: "Início 2026",
    title: "Novo estúdio",
    desc: "A mudança marca a virada de postura: de projeto caseiro para produção profissional, à altura de convidados e patrocinadores.",
  },
  {
    year: "2026",
    title: "De podcast a ecossistema",
    desc: "Lives, quadros especializados, Shorts diários e o PFC Visita. Mais de 800 mil views em 12 meses provam que a proposta ressoa.",
  },
];

export default function About() {
  return (
    <section id="sobre" className="section-py bg-[#111] relative overflow-hidden">
      <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[200px] lg:text-[280px] font-black text-white/[0.015] select-none pointer-events-none leading-none pr-8">
        PFC
      </div>

      <div className="container-px relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left: story */}
          <div className="flex flex-col gap-6">
            <div>
              <span className="section-tag">Nossa história</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
                As conversas que{" "}
                <span className="text-gradient-gold">movem a cidade</span>
              </h2>
            </div>

            <div className="w-12 h-1 bg-gold-500 rounded-full" />

            <p className="text-white/65 text-lg leading-relaxed">
              O <strong className="text-white">Fora da Caixa</strong> nasceu de
              uma percepção simples: as conversas mais interessantes sempre
              aconteciam fora das reuniões. &ldquo;Fora da caixa&rdquo; porque os
              convidados vêm de universos completamente diferentes — vozes que
              ampliam perspectivas, não que as confirmam.
            </p>

            <p className="text-white/50 leading-relaxed">
              Hoje não é mais só um podcast. É um ecossistema de conteúdo
              regional que traz para o microfone empreendedores, educadores,
              atletas, artistas e especialistas de Mogi Guaçu e região — dando a
              essas conversas o palco que sempre mereceram.
            </p>

            <blockquote className="mt-2 p-6 bg-gradient-to-r from-gold-500/10 to-transparent border border-gold-500/20 rounded-xl">
              <p className="text-gold-400 font-semibold italic leading-relaxed">
                &ldquo;Porque as melhores ideias não cabem em quatro paredes.&rdquo;
              </p>
            </blockquote>
          </div>

          {/* Right: timeline */}
          <div className="relative">
            <div className="absolute left-[27px] top-4 bottom-4 w-px bg-gradient-to-b from-gold-500/40 via-gold-500/20 to-transparent" />
            <div className="flex flex-col gap-6">
              {milestones.map((m, i) => (
                <div key={i} className="flex gap-5">
                  <div className="flex-shrink-0 w-14 h-14 rounded-full bg-[#0d0d0d] border border-gold-500/30 flex items-center justify-center text-gold-500 text-[10px] font-black text-center leading-tight z-10 px-1">
                    {m.year}
                  </div>
                  <div className="pt-1">
                    <h3 className="text-white font-bold">{m.title}</h3>
                    <p className="text-white/50 text-sm mt-1 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
