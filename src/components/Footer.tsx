import { site, social, whatsappNumber } from "@/lib/config";
import { MicIcon, InstagramIcon, YouTubeIcon, WhatsAppIcon } from "./icons";

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
                <MicIcon className="w-5 h-5 text-black" />
              </div>
              <div>
                <div className="text-gold-500 font-black text-xl leading-none">
                  {site.brand}
                </div>
                <div className="text-white/40 text-xs mt-1">
                  Podcast · {site.location}
                </div>
              </div>
            </div>
            <p className="text-white/40 text-sm leading-relaxed max-w-xs">
              {site.tagline} Lives semanais, quadros especializados e Shorts
              diários de Mogi Guaçu e região.
            </p>
          </div>

          {/* Navegação */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Navegação
            </h4>
            <div className="flex flex-col gap-2.5 text-sm">
              <a href="/#episodios" className="text-white/50 hover:text-white transition-colors">Episódios</a>
              <a href="/#quadros" className="text-white/50 hover:text-white transition-colors">Quadros</a>
              <a href="/#numeros" className="text-white/50 hover:text-white transition-colors">Números</a>
              <a href="/parcerias" className="text-white/50 hover:text-white transition-colors">Parcerias</a>
            </div>
          </div>

          {/* Contato / Redes */}
          <div className="flex flex-col gap-4">
            <h4 className="text-white/60 text-xs font-bold uppercase tracking-widest">
              Redes & contato
            </h4>
            <div className="flex flex-col gap-3">
              <a href={social.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/50 hover:text-white transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-gold-500/30">
                  <InstagramIcon className="w-4 h-4" />
                </div>
                <span className="text-sm">{social.instagramHandle}</span>
              </a>
              <a href={social.youtube} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/50 hover:text-white transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-gold-500/30">
                  <YouTubeIcon className="w-4 h-4" />
                </div>
                <span className="text-sm">@PapoForadaCaixa</span>
              </a>
              <a href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-white/50 hover:text-white transition-colors group">
                <div className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center group-hover:border-[#25D366]/40">
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                </div>
                <span className="text-sm">(19) 98933-1908</span>
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[#1a1a1a] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-white/25 text-sm text-center sm:text-left">
            © {year} {site.brand}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-4">
            <p className="text-white/20 text-xs">{site.location} · Brasil</p>
            <a href="/admin" className="text-white/20 hover:text-white/50 text-xs transition-colors">
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
