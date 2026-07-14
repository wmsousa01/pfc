import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import Exposure from "@/components/Exposure";
import Differentials from "@/components/Differentials";
import Plans from "@/components/Plans";
import HowItWorks from "@/components/HowItWorks";
import PartnersShowcase from "@/components/PartnersShowcase";
import FinalCTA from "@/components/FinalCTA";
import { partnershipFormats, quadros, whatsapp } from "@/lib/config";
import { WhatsAppIcon, ArrowRight } from "@/components/icons";

export const metadata: Metadata = {
  title: "Parcerias | Fora da Caixa",
  description:
    "Coloque sua marca no centro da conversa de Mogi Guaçu. Formatos de patrocínio, planos e página exclusiva com QR code e tracking de acessos.",
};

export const revalidate = 1800;

export default function ParceriasPage() {
  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-16 lg:pt-40 lg:pb-20 overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="container-px relative max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span className="section-tag">Media Kit · Parcerias</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
            Sua marca no{" "}
            <span className="text-gradient-gold">centro da conversa</span> da
            cidade
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl">
            Não vendemos espaço, criamos presença. Conecte seu negócio à
            audiência local do Fora da Caixa — com uma página exclusiva, QR code
            no episódio e tracking de acessos.
          </p>
          <a
            href={whatsapp("Quero uma proposta de parceria com o Fora da Caixa")}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary px-8 py-4 rounded-xl text-base flex items-center gap-3"
          >
            <WhatsAppIcon className="w-5 h-5" />
            Solicitar proposta
          </a>
        </div>
      </section>

      {/* Formatos de parceria */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px">
          <div className="text-center mb-12 max-w-2xl mx-auto">
            <span className="section-tag">Oportunidades comerciais</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Formatos de <span className="text-gradient-gold">parceria</span>
            </h2>
            <p className="text-white/50 mt-4">
              Combine os formatos que fazem sentido para o seu negócio.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {partnershipFormats.map((f, i) => (
              <div
                key={i}
                className="card-hover bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-6 flex flex-col gap-3"
              >
                <div className="text-3xl">{f.emoji}</div>
                <div className="text-white font-bold">{f.title}</div>
                <div className="text-white/45 text-sm leading-relaxed">
                  {f.description}
                </div>
              </div>
            ))}
          </div>

          {/* Quadros + perfil de patrocinador */}
          <div className="mt-14">
            <h3 className="text-center text-white/60 text-sm font-bold uppercase tracking-widest mb-6">
              Patrocinador ideal por quadro
            </h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {quadros.map((q) => (
                <div
                  key={q.slug}
                  className="bg-[#0d0d0d] border border-[#222] rounded-xl p-5 flex flex-col gap-2"
                >
                  <div className="text-2xl">{q.emoji}</div>
                  <div className="text-white font-semibold text-sm">{q.name}</div>
                  <div className="text-white/40 text-xs leading-relaxed">
                    {q.sponsorProfile}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <Exposure />
      <Differentials />
      <Plans />
      <PartnersShowcase />
      <HowItWorks />

      {/* Diferencial: página + QR + tracking */}
      <section className="section-py bg-[#111]">
        <div className="container-px max-w-4xl mx-auto">
          <div className="rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-8 lg:p-12">
            <span className="section-tag">Exclusivo do Fora da Caixa</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3 leading-tight">
              Página própria + <span className="text-gradient-gold">QR no episódio</span> + tracking
            </h2>
            <p className="text-white/60 mt-4 leading-relaxed max-w-2xl">
              Todo parceiro ganha uma landing page dentro do site
              (foradacaixa.com.br/parceiros/sua-marca). Durante o episódio, um QR
              code na tela leva a audiência direto para lá — e você acompanha
              quantos acessos o seu QR gerou.
            </p>
            <ol className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { n: "1", t: "Criamos sua página", d: "Conteúdo, logo e CTA da sua marca." },
                { n: "2", t: "QR aparece na live", d: "A audiência escaneia em tempo real." },
                { n: "3", t: "Você vê os números", d: "Tracking de acessos por período." },
              ].map((s) => (
                <li key={s.n} className="bg-[#0d0d0d] border border-[#222] rounded-xl p-5">
                  <div className="w-8 h-8 rounded-full bg-gold-500 text-black font-black flex items-center justify-center text-sm">
                    {s.n}
                  </div>
                  <div className="text-white font-semibold mt-3">{s.t}</div>
                  <div className="text-white/45 text-sm mt-1">{s.d}</div>
                </li>
              ))}
            </ol>
            <a
              href={whatsapp("Quero uma página de parceiro com QR code no Fora da Caixa")}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary px-7 py-3.5 rounded-xl font-bold inline-flex items-center gap-2 mt-8"
            >
              Quero minha página
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>

      <FinalCTA />
      <Footer />
      <WhatsAppButton />
    </main>
  );
}
