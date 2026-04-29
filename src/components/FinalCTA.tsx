export default function FinalCTA() {
  return (
    <section className="section-py bg-[#0a0a0a] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gold-500/8 rounded-full blur-[120px]" />
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,215,0,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,215,0,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="container-px relative">
        <div className="max-w-3xl mx-auto text-center flex flex-col items-center gap-8">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gold-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
              Vamos colocar sua marca
              <br />
              <span className="text-gradient-gold">na mesa?</span>
            </h2>
          </div>

          {/* Subtitle */}
          <p className="text-white/60 text-lg leading-relaxed max-w-xl">
            Fale agora pelo WhatsApp e receba a proposta comercial completa com
            os formatos disponíveis.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8">
            {[
              { value: "+90K", label: "Views/mês" },
              { value: "100%", label: "Local" },
              { value: "Rápido", label: "Ativação" },
            ].map((item, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-black text-gold-500">
                  {item.value}
                </div>
                <div className="text-white/40 text-xs mt-1 uppercase tracking-wide">
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* CTA button */}
          <a
            href="https://wa.me/5519989331908?text=Tenho%20interesse%20em%20anunciar%20no%20Papo%20Fora%20da%20Caixa"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-10 py-5 rounded-xl text-lg flex items-center gap-3 shadow-[0_8px_32px_rgba(255,215,0,0.25)]"
          >
            <svg
              className="w-6 h-6"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Falar no WhatsApp agora
          </a>

          <p className="text-white/25 text-sm">
            Resposta em até 24h · Sem spam · Conversa direta com o time do PFC
          </p>
        </div>
      </div>
    </section>
  );
}
