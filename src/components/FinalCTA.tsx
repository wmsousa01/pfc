import { social, whatsapp } from "@/lib/config";
import { YouTubeIcon, WhatsAppIcon } from "./icons";

export default function FinalCTA() {
  return (
    <section className="section-py bg-[#0a0a0a] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-gold-500/8 rounded-full blur-[120px]" />
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
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
            Faça parte da{" "}
            <span className="text-gradient-gold">conversa</span>
          </h2>

          <p className="text-white/60 text-lg leading-relaxed max-w-xl">
            Assista aos episódios, acompanhe as lives — ou coloque sua marca no
            centro da conversa da cidade.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <a
              href={social.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-8 py-4 rounded-xl text-base flex items-center justify-center gap-3"
            >
              <YouTubeIcon className="w-5 h-5" />
              Assistir no YouTube
            </a>
            <a
              href={whatsapp("Quero ser parceiro do Fora da Caixa")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-outline px-8 py-4 rounded-xl text-base flex items-center justify-center gap-2"
            >
              <WhatsAppIcon className="w-5 h-5" />
              Quero ser parceiro
            </a>
          </div>

          <p className="text-white/25 text-sm">
            Mogi Guaçu · SP · Resposta em até 24h
          </p>
        </div>
      </div>
    </section>
  );
}
