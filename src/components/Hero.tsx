export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-[#0a0a0a] pt-16">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gold-500/5 rounded-full blur-[120px] -translate-x-1/2 translate-y-1/4" />
        <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-gold-500/3 rounded-full blur-[100px] translate-x-1/2" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,215,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.3) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="container-px relative z-10 py-20 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="flex flex-col gap-6 animate-fade-in-up">
            {/* Tag */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
              <span className="section-tag">Podcast · Mogi Guaçu · SP</span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
              Coloque sua marca no{" "}
              <span className="text-gradient-gold">centro da conversa</span>{" "}
              da cidade
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-white/70 leading-relaxed max-w-xl">
              O Papo Fora da Caixa conecta sua empresa com milhares de pessoas
              todos os meses através de conteúdo, influência local e presença
              digital contínua.
            </p>

            {/* Support text */}
            <p className="text-white/40 text-sm italic border-l-2 border-gold-500/40 pl-4">
              Sua marca não vai apenas aparecer. Ela vai{" "}
              <strong className="text-white/60 not-italic">participar.</strong>
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a
                href="https://wa.me/5519989331908?text=Quero%20ser%20patrocinador%20do%20Papo%20Fora%20da%20Caixa"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-8 py-4 rounded-xl text-base flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Quero ser patrocinador
              </a>
              <a
                href="#planos"
                className="btn-outline px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2"
              >
                Ver formatos de parceria
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Right: Studio Visual */}
          <div
            className="relative animate-fade-in"
            style={{ animationDelay: "0.2s", opacity: 0 }}
          >
            {/* Main placeholder card */}
            <div className="relative rounded-2xl overflow-hidden border border-[#333] bg-[#111] aspect-[4/3]">
              {/* Decorative background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0d0d0d]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
                {/* Microphone icon */}
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-gold-500/10 border border-gold-500/20 flex items-center justify-center animate-float">
                    <svg
                      className="w-10 h-10 text-gold-500"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                    </svg>
                  </div>
                </div>

                {/* Recording indicator */}
                <div className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-600/30 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">
                    No Ar
                  </span>
                </div>

                {/* Waveform decoration */}
                <div className="flex items-center gap-1">
                  {[3, 7, 5, 9, 4, 8, 6, 10, 5, 7, 3, 8, 6].map(
                    (h, i) => (
                      <div
                        key={i}
                        className="w-1 bg-gold-500/40 rounded-full"
                        style={{
                          height: `${h * 3}px`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    )
                  )}
                </div>
              </div>

              {/* Gold border glow */}
              <div className="absolute inset-0 rounded-2xl border border-gold-500/20 pointer-events-none" />
            </div>

            {/* Floating stat pills */}
            <div className="absolute -top-4 -left-4 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 shadow-xl">
              <div className="text-gold-500 font-black text-xl leading-none">
                +90K
              </div>
              <div className="text-white/50 text-xs mt-1">views/mês</div>
            </div>

            <div className="absolute -bottom-4 -right-4 bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3 shadow-xl">
              <div className="text-gold-500 font-black text-xl leading-none">
                +500h
              </div>
              <div className="text-white/50 text-xs mt-1">assistidas</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
    </section>
  );
}
