import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import WhatsAppButton from "@/components/WhatsAppButton";
import OrderForm from "@/components/loja/OrderForm";
import { getActiveProducts, getResellerByCode } from "@/lib/shop";
import { couponFor } from "@/lib/commission";
import { whatsapp } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Loja | Fora da Caixa",
  description:
    "Pré-venda oficial dos produtos do Fora da Caixa: camiseta e caneca PFC. Faça seu pedido pelo site e receba a confirmação no WhatsApp.",
};

// Lê o cupom (query/cookie) e os produtos do banco a cada acesso.
export const dynamic = "force-dynamic";

const steps = [
  {
    n: "1",
    t: "Escolha e envie",
    d: "Monte seu pedido aqui no site — leva menos de um minuto.",
  },
  {
    n: "2",
    t: "Confirmamos com você",
    d: "Chamamos no WhatsApp para acertar pagamento, prazo e entrega.",
  },
  {
    n: "3",
    t: "Produção e entrega",
    d: "Fechando a pré-venda, produzimos e avisamos quando o seu chegar.",
  },
];

/**
 * Vitrine estática usada só quando não há produtos cadastrados no Supabase
 * (banco não configurado ou migração 004 ainda não rodada). Mantém a loja no
 * ar com o fluxo antigo, direto no WhatsApp.
 */
const FALLBACK_PRODUCTS = [
  {
    id: "camiseta",
    name: "Camiseta PFC",
    description:
      "Preta, com o logo no peito e estampa completa nas costas com as 5 estrelas dos quadros.",
    detail: "Tamanhos P ao GG · algodão premium",
    image: "/produtos/camiseta-costas.png",
    imageAlt: "/produtos/camiseta-frente.png" as string | undefined,
    whatsappMessage:
      "Tenho interesse na pré-venda da CAMISETA PFC! Meu tamanho: ",
  },
  {
    id: "caneca",
    name: "Caneca PFC",
    description:
      "Cerâmica branca com interior e alça pretos, estampada com o logo do PFC.",
    detail: "325ml · cerâmica",
    image: "/produtos/caneca.png",
    imageAlt: undefined as string | undefined,
    whatsappMessage: "Tenho interesse na pré-venda da CANECA PFC!",
  },
];

export default async function LojaPage({
  searchParams,
}: {
  searchParams: { ref?: string };
}) {
  const products = await getActiveProducts();

  // A atribuição vem do link do revendedor (/r/{slug}) ou do cookie que ele deixou.
  const refCode = searchParams.ref ?? cookies().get("pfc_ref")?.value ?? "";
  const reseller = await getResellerByCode(refCode);

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-14 lg:pt-40 lg:pb-16 overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="container-px relative max-w-3xl mx-auto text-center flex flex-col items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span className="section-tag">Loja · Pré-venda oficial</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.05] tracking-tight">
            Vista o <span className="text-gradient-gold">Fora da Caixa</span>
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl">
            Camiseta e caneca oficiais do PFC em pré-venda. Faça seu pedido
            aqui — quem entra na lista garante o seu na primeira leva.
          </p>
          {reseller && (
            <p className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full px-4 py-2">
              {reseller.discount_percent > 0 ? (
                <>
                  <strong>{reseller.discount_percent}% de desconto</strong> pela
                  indicação de <strong>{reseller.name}</strong> — já aplicado
                </>
              ) : (
                <>
                  Você chegou pela indicação de <strong>{reseller.name}</strong>
                </>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Produtos + pedido */}
      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto">
          {products.length > 0 ? (
            <OrderForm
              products={products}
              initialCoupon={reseller ? couponFor(reseller.slug) : ""}
              resellerName={reseller?.name ?? null}
              discountPercent={reseller?.discount_percent ?? 0}
            />
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
                {FALLBACK_PRODUCTS.map((p) => (
                  <div
                    key={p.id}
                    className="card-hover group bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl overflow-hidden flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-[#0a0a0a]">
                      <span className="absolute top-4 left-4 z-10 bg-gold-500 text-black text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full">
                        Pré-venda
                      </span>
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className={`object-cover ${
                          p.imageAlt
                            ? "transition-opacity duration-500 group-hover:opacity-0"
                            : ""
                        }`}
                      />
                      {p.imageAlt && (
                        <Image
                          src={p.imageAlt}
                          alt={`${p.name} — frente`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                        />
                      )}
                    </div>
                    <div className="p-6 lg:p-7 flex flex-col gap-3 flex-1">
                      <h2 className="text-2xl font-black">{p.name}</h2>
                      <p className="text-white/55 text-sm leading-relaxed">
                        {p.description}
                      </p>
                      <p className="text-white/35 text-xs">{p.detail}</p>
                      <a
                        href={whatsapp(p.whatsappMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary mt-auto px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2.5"
                      >
                        <WhatsAppIcon className="w-5 h-5" />
                        Tenho interesse
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-center text-white/35 text-sm mt-8">
                Passe o mouse na camiseta para ver a frente.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Como funciona */}
      <section className="section-py bg-[#0a0a0a]">
        <div className="container-px max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="section-tag">Como funciona</span>
            <h2 className="text-3xl sm:text-4xl font-black mt-3">
              Simples e <span className="text-gradient-gold">sem burocracia</span>
            </h2>
          </div>
          <ol className="grid sm:grid-cols-3 gap-4">
            {steps.map((s) => (
              <li
                key={s.n}
                className="bg-[#111] border border-[#222] rounded-xl p-6"
              >
                <div className="w-8 h-8 rounded-full bg-gold-500 text-black font-black flex items-center justify-center text-sm">
                  {s.n}
                </div>
                <div className="text-white font-semibold mt-3">{s.t}</div>
                <div className="text-white/45 text-sm mt-1">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer />
      <WhatsAppButton />
    </main>
  );
}
