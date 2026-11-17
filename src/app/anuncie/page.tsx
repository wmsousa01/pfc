import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import FormOferta from "@/components/ads/FormOferta";
import { OFERTA, OFERTA_PRECO_LABEL, REGRAS_OFERTA, rotuloSemana, semanasAVenda } from "@/lib/ads/config";
import { vagasLivres } from "@/lib/ads/store";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Anuncie sua oferta no PFC por R$ 97 | Fora da Caixa",
  description:
    "Coloque a oferta do seu negócio no Instagram do PFC e na vitrine de ofertas de Mogi Guaçu e Mogi Mirim. Você preenche, paga no Pix e a gente publica. Com link rastreado para o seu WhatsApp.",
};

/** Vagas mudam a cada compra: nada de página estática aqui. */
export const dynamic = "force-dynamic";

const PASSOS = [
  { n: "1", t: "Você preenche", d: "Escolhe a semana, escreve a oferta e informa o WhatsApp que recebe os clientes." },
  { n: "2", t: "Paga no Pix ou cartão", d: `${OFERTA_PRECO_LABEL} à vista pelo Mercado Pago. Sem contrato e sem mensalidade.` },
  { n: "3", t: "A gente publica", d: "A equipe aprova, a arte sai pronta com a sua logo e a oferta vai ao ar na semana escolhida." },
];

export default async function AnunciePage() {
  const semanas = semanasAVenda();
  const livres = isSupabaseConfigured() ? await vagasLivres(semanas).catch(() => null) : null;

  return (
    <>
      <Navbar />
      <main className="bg-[#0a0a0a] min-h-screen pt-28 pb-20">
        <div className="container-px max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto">
            <span className="section-tag">PFCTV Ads · {OFERTA.nome}</span>
            <h1 className="text-3xl sm:text-5xl font-black mt-3 leading-tight">
              Sua oferta no PFC por <span className="text-gradient-gold">{OFERTA_PRECO_LABEL}</span>
            </h1>
            <p className="text-white/55 mt-4 leading-relaxed">
              Um story no Instagram do PFC e uma semana na vitrine de ofertas da cidade, com um link que leva direto
              para o seu WhatsApp e conta quantas pessoas clicaram. Só {OFERTA.vagasPorSemana} vagas por semana.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 mt-12">
            {PASSOS.map((p) => (
              <div key={p.n} className="bg-[#111] border border-[#222] rounded-2xl p-5">
                <div className="text-gold-500 font-black text-2xl">{p.n}</div>
                <div className="text-white font-bold mt-1">{p.t}</div>
                <p className="text-white/50 text-sm mt-1.5 leading-relaxed">{p.d}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_320px] gap-8 mt-12 items-start">
            <div className="bg-[#111] border border-[#222] rounded-2xl p-6 sm:p-8">
              {livres ? (
                <FormOferta
                  semanas={semanas.map((s) => ({ segunda: s, rotulo: rotuloSemana(s), livres: livres[s] ?? 0 }))}
                  regras={REGRAS_OFERTA}
                  limites={OFERTA.limites}
                />
              ) : (
                <p className="text-white/55 text-center py-10">A venda de ofertas está indisponível agora. Tente de novo em instantes.</p>
              )}
            </div>

            <aside className="flex flex-col gap-4">
              <div className="bg-[#111] border border-gold-500/30 rounded-2xl p-5">
                <div className="text-gold-500 text-xs font-bold uppercase tracking-widest">Quer aparecer toda semana?</div>
                <p className="text-white/60 text-sm mt-2 leading-relaxed">
                  Anunciar todas as semanas sai R$ 388 por mês. O Plano Apoio custa R$ 297 por mês e coloca a sua marca nos
                  conteúdos do PFC.
                </p>
                <Link href="/monte-seu-plano" className="inline-block mt-3 text-gold-500 text-sm font-semibold underline underline-offset-4">
                  Montar meu plano →
                </Link>
              </div>
              <div className="bg-[#111] border border-[#222] rounded-2xl p-5">
                <div className="text-white/50 text-xs font-bold uppercase tracking-widest">Veja as ofertas no ar</div>
                <Link href="/ofertas" className="inline-block mt-2 text-white text-sm font-semibold underline underline-offset-4">
                  pfctv.com.br/ofertas →
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
