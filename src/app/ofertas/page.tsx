import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { WhatsAppIcon } from "@/components/icons";
import { OFERTA_PRECO_LABEL, rotuloSemana, segundaDaSemana } from "@/lib/ads/config";
import { signedUrls } from "@/lib/ads/arte-io";
import { listarOfertas } from "@/lib/ads/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Ofertas da semana em Mogi Guaçu e Mogi Mirim | PFC",
  description: "As ofertas dos negócios da cidade que estão no PFC esta semana. Chame direto no WhatsApp.",
};

/** As logos vêm com URL assinada de 1 h; a página se renova antes disso. */
export const revalidate = 300;

export default async function OfertasPage() {
  const semana = segundaDaSemana(Date.now());
  const ofertas = isSupabaseConfigured()
    ? await listarOfertas({ semana, status: ["aprovada", "publicando", "publicada", "erro"] }).catch(() => [])
    : [];
  const logos = await signedUrls(ofertas.map((o) => o.logo_path).filter((p): p is string => !!p)).catch(() => new Map<string, string>());

  return (
    <>
      <Navbar />
      <main className="bg-[#0a0a0a] min-h-screen pt-28 pb-20">
        <div className="container-px max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="section-tag">Semana de {rotuloSemana(semana)}</span>
            <h1 className="text-3xl sm:text-5xl font-black mt-3 leading-tight">
              Ofertas da semana <span className="text-gradient-gold">na cidade</span>
            </h1>
            <p className="text-white/55 mt-4">Negócios de Mogi Guaçu e região que estão no PFC esta semana. Chame direto no WhatsApp.</p>
          </div>

          {ofertas.length === 0 ? (
            <p className="text-white/45 text-center mt-16">As ofertas desta semana ainda vão ao ar. Volte em breve.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
              {ofertas.map((o) => {
                const logo = o.logo_path ? logos.get(o.logo_path) : null;
                const cor = o.cor && /^#[0-9a-f]{6}$/i.test(o.cor) ? o.cor : "#FFD700";
                return (
                  <article key={o.id} className="bg-[#111] border border-[#222] rounded-2xl p-5 flex flex-col" style={{ borderTop: `4px solid ${cor}` }}>
                    <div className="flex items-center gap-3">
                      {logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logo} alt="" className="w-11 h-11 rounded-full bg-white object-contain" />
                      ) : (
                        <span className="w-11 h-11 rounded-full flex items-center justify-center font-black text-black" style={{ background: cor }}>
                          {o.empresa.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-white font-bold truncate">{o.empresa}</div>
                        <div className="text-white/40 text-xs">{o.cidade}</div>
                      </div>
                    </div>
                    <h2 className="text-white text-lg font-black mt-4 leading-snug">{o.titulo}</h2>
                    <p className="text-white/55 text-sm mt-2 leading-relaxed flex-1">{o.descricao}</p>
                    <a href={`/o/${o.codigo}`} rel="nofollow" className="btn-primary mt-5 py-3 rounded-xl font-bold text-center flex items-center justify-center gap-2">
                      <WhatsAppIcon className="w-4 h-4" /> Chamar no WhatsApp
                    </a>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-16 text-center bg-[#111] border border-gold-500/30 rounded-2xl p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-black">Tem um negócio na região?</h2>
            <p className="text-white/55 mt-2">Coloque a sua oferta aqui e no Instagram do PFC por {OFERTA_PRECO_LABEL}.</p>
            <Link href="/anuncie" className="btn-primary inline-block mt-5 px-6 py-3 rounded-xl font-bold">
              Anunciar minha oferta
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
