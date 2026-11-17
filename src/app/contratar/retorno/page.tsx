import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Passos from "@/components/checkout/Passos";
import { getCheckout, syncCheckout } from "@/lib/checkout-store";
import { whatsapp } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pagamento | Fora da Caixa", robots: { index: false } };

/**
 * Volta do Mercado Pago. Não espera o webhook: confere o pagamento na hora
 * (o MP manda payment_id na URL) e, aprovado, leva direto ao onboarding.
 */
export default async function RetornoPage({
  searchParams,
}: {
  searchParams: { ref?: string; payment_id?: string; collection_id?: string };
}) {
  const inicial = await getCheckout(searchParams.ref ?? "");
  if (!inicial) notFound();
  const pid = searchParams.payment_id ?? searchParams.collection_id ?? null;
  const c = await syncCheckout(inicial, pid && pid !== "null" ? pid : null);
  if (c.status === "pago") redirect(`/comecar/${c.onboarding_token}`);

  const aguardando = c.status === "aguardando" || c.status === "processando" || c.status === "aberto";
  const recusado = c.status === "recusado";

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      {/* Pix pago em outro aparelho: a página se atualiza sozinha até confirmar. */}
      {aguardando && <meta httpEquiv="refresh" content="8" />}
      <Navbar />
      <section className="pt-32 pb-20 lg:pt-36 bg-[#0a0a0a] min-h-screen">
        <div className="container-px max-w-xl mx-auto text-center">
          <Passos atual={3} />
          {aguardando && (
            <>
              <div className="mx-auto mt-10 w-12 h-12 rounded-full border-4 border-gold-500/30 border-t-gold-500 animate-spin" />
              <h1 className="text-3xl font-black mt-6">Aguardando a confirmação</h1>
              <p className="text-white/60 mt-3">
                Se você pagou no Pix, a confirmação chega em segundos e esta página avança sozinha. Boleto leva até 2
                dias úteis: quando compensar, enviamos o link do onboarding no seu WhatsApp.
              </p>
            </>
          )}
          {recusado && (
            <>
              <h1 className="text-3xl font-black mt-10">O pagamento não passou</h1>
              <p className="text-white/60 mt-3">
                O Mercado Pago recusou a tentativa. Você pode tentar de novo com outro cartão ou pagar no Pix.
              </p>
              <a href={`/contratar/revisao/${c.id}`} className="btn-primary inline-block mt-6 px-7 py-3.5 rounded-xl font-bold">
                Tentar de novo
              </a>
            </>
          )}
          {!aguardando && !recusado && (
            <>
              <h1 className="text-3xl font-black mt-10">Recebemos seu pagamento</h1>
              <p className="text-white/60 mt-3">
                Falta só um ajuste do nosso lado para liberar o onboarding. A equipe já foi avisada e te chama no
                WhatsApp em seguida.
              </p>
            </>
          )}
          <a
            href={whatsapp(`Contratei o Plano ${c.plan} pelo site (${c.company}). Referência ${c.id.slice(0, 8)}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 text-gold-500 hover:text-gold-400 text-sm"
          >
            Falar com a equipe no WhatsApp
          </a>
        </div>
      </section>
      <Footer />
    </main>
  );
}
