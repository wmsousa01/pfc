import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { rotuloSemana } from "@/lib/ads/config";
import { getOferta, sincronizarPagamento, type Oferta } from "@/lib/ads/store";
import { whatsapp } from "@/lib/config";

export const metadata: Metadata = { title: "Sua oferta | PFCTV Ads", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Volta do Checkout Pro. O Mercado Pago manda payment_id e external_reference
 * na URL; o pagamento é reconsultado na API antes de qualquer coisa (a URL
 * pode ser forjada). Também é o que confirma o pagamento onde o webhook não
 * chega, como em localhost e preview protegido.
 */
export default async function RetornoPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const paymentId = searchParams.payment_id ?? searchParams.collection_id;
  let oferta: Oferta | null = null;
  if (paymentId && paymentId !== "null") oferta = await sincronizarPagamento(paymentId).catch(() => null);
  if (!oferta && searchParams.external_reference) oferta = await getOferta(searchParams.external_reference).catch(() => null);

  const status = oferta?.status;
  const pago = status && ["paga", "aprovada", "publicando", "publicada"].includes(status);
  const pendente = !pago && (oferta?.mp_status === "pending" || oferta?.mp_status === "in_process");

  return (
    <>
      <Navbar />
      <main className="bg-[#0a0a0a] min-h-screen pt-32 pb-20">
        <div className="container-px max-w-xl mx-auto text-center">
          {pago && oferta ? (
            <>
              <div className="text-5xl">✅</div>
              <h1 className="text-3xl font-black mt-4">Pagamento confirmado!</h1>
              <p className="text-white/60 mt-3 leading-relaxed">
                A oferta <b className="text-white">“{oferta.titulo}”</b> está reservada para a semana de{" "}
                {rotuloSemana(oferta.semana)}. A equipe aprova em até 1 dia útil e você recebe a confirmação por e-mail
                ou WhatsApp.
              </p>
            </>
          ) : pendente && oferta ? (
            <>
              <div className="text-5xl">⏳</div>
              <h1 className="text-3xl font-black mt-4">Esperando o pagamento</h1>
              <p className="text-white/60 mt-3 leading-relaxed">
                Assim que o Pix cair, a sua vaga na semana de {rotuloSemana(oferta.semana)} fica garantida. Ela fica
                reservada por 24 horas.
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl">⚠️</div>
              <h1 className="text-3xl font-black mt-4">O pagamento não foi concluído</h1>
              <p className="text-white/60 mt-3 leading-relaxed">
                Nada foi cobrado. A vaga fica livre de novo em até 1 hora. Você pode tentar outra vez.
              </p>
              <Link href="/anuncie" className="btn-primary inline-block mt-6 px-6 py-3 rounded-xl font-bold">
                Tentar de novo
              </Link>
            </>
          )}
          <p className="text-white/35 text-sm mt-8">
            Dúvidas?{" "}
            <a href={whatsapp("Comprei uma Oferta da semana no PFC e tenho uma dúvida")} className="underline underline-offset-4">
              Fale com a gente no WhatsApp
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
