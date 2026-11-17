import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Passos from "@/components/checkout/Passos";
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { isSelfServe } from "@/lib/checkout";
import { getLeadPrefill } from "@/lib/checkout-store";
import { mpConfigured } from "@/lib/mercadopago";
import { planById } from "@/lib/planos";
import { whatsapp } from "@/lib/config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contratar patrocínio | Fora da Caixa",
  robots: { index: false },
};

export default async function ContratarPage({
  params,
  searchParams,
}: {
  params: { plano: string };
  searchParams: { lead?: string };
}) {
  const plan = planById(params.plano);
  if (!plan) notFound();

  const lead = searchParams.lead ? await getLeadPrefill(searchParams.lead).catch(() => null) : null;
  const liberado = mpConfigured() && (isSelfServe(plan.id) || Boolean(lead));

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <section className="pt-32 pb-20 lg:pt-36 bg-[#0a0a0a] min-h-screen">
        <div className="container-px max-w-5xl mx-auto">
          <Passos atual={lead ? 1 : 0} />
          <div className="text-center mt-8 mb-10">
            <span className="section-tag">Contratar</span>
            <h1 className="text-3xl sm:text-5xl font-black mt-3 leading-tight">
              Plano <span className="text-gradient-gold">{plan.name}</span>
            </h1>
            <p className="text-white/55 mt-3">
              {lead ? `${lead.name.split(" ")[0]}, deixamos seus dados prontos. ` : ""}
              Escolha o prazo, confira os termos e pague pelo Mercado Pago. Depois do pagamento, você já começa o
              onboarding da sua marca.
            </p>
          </div>

          {liberado ? (
            <CheckoutForm
              plan={plan}
              prefill={
                lead
                  ? { lead: lead.id, name: lead.name, company: lead.company, whatsapp: lead.whatsapp, segment: lead.segment }
                  : null
              }
            />
          ) : (
            <div className="max-w-xl mx-auto bg-[#111] border border-[#222] rounded-2xl p-8 text-center">
              <p className="text-white/70">
                {plan.id === "master" &&
                  "O Master tem exclusividade por segmento, então a gente confere a disponibilidade do seu segmento antes de fechar. "}
                Chame o comercial: você recebe o link de contratação já com seus dados.
              </p>
              <a
                href={whatsapp(`Quero contratar o plano ${plan.name} do PFC`)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-block mt-6 px-7 py-3.5 rounded-xl font-bold"
              >
                Falar com o comercial
              </a>
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  );
}
