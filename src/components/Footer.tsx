export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#050505] border-t border-[#1a1a1a]">
      <div className="container-px py-12">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-gold-500 rounded-lg">
                <svg
                  className="w-5 h-5 text-black"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
              </div>
              <div>
                <div className="text-gold-500 font-black text-xl leading-none">
                  Papo Fora da Caixa
                </div>
                <div className="text-white/40 text-xs mt-1">
                  Podcast · Mogi Guaçu · SP
                </div>
              </div>
            </div>

            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              O podcast que coloca sua marca no centro da conversa da cidade.
            </p>
          </div>

          {/* Redes sociais */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Redes sociais
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="https://www.instagram.com/papoforadacaixapdc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/50 hover:text-white transition-colors duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-gold-500/30 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 011.25 1.25A1.25 1.25 0 0117.25 8 1.25 1.25 0 0116 6.75a1.25 1.25 0 011.25-1.25M12 7a5 5 0 015 5 5 5 0 01-5 5 5 5 0 01-5-5 5 5 0 015-5m0 2a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3z" />
                  </svg>
                </div>
                <span className="text-sm">@papoforadacaixapdc</span>
              </a>

              <a
                href="https://www.youtube.com/@papoforadacaixa"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/50 hover:text-white transition-colors duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-gold-500/30 transition-colors duration-200">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 19c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 5c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z" />
                  </svg>
                </div>
                <span className="text-sm">@papoforadacaixa</span>
              </a>
            </div>
          </div>

          {/* Contato */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Contato
            </h4>
            <div className="flex flex-col gap-3">
              <a
                href="https://wa.me/5519989331908?text=Vim%20pela%20landing%20page%20e%20quero%20anunciar"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 text-white/50 hover:text-white transition-colors duration-200 group"
              >
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-[#25D366]/40 transition-colors duration-200">
                  <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </div>
                <span className="text-sm">(19) 98933-1908</span>
              </a>

              <div className="flex items-center gap-3 text-white/30">
                <div className="w-8 h-8 rounded-lg bg-[#111] border border-[#1a1a1a] flex items-center justify-center">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                  </svg>
                </div>
                <span className="text-sm">Mogi Guaçu · SP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1a1a1a] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/25 text-sm text-center sm:text-left">
            © {year} Papo Fora da Caixa. Todos os direitos reservados.
          </p>
          <p className="text-white/20 text-xs">
            Mogi Guaçu · SP · Brasil
          </p>
        </div>
      </div>
    </footer>
  );
}
