import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Passos from "@/components/checkout/Passos";
import { aceitarEPagar } from "@/app/contratar/actions";
import { opcao, brlReais } from "@/lib/checkout";
import { contratoDoCheckout, getCheckout } from "@/lib/checkout-store";
import { formatDocument } from "@/lib/client-area";
import { planById } from "@/lib/planos";
import { buildTerms } from "@/lib/terms";
import { whatsapp } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Revisar contratação | Fora da Caixa", robots: { index: false } };

const ERROS: Record<string, string> = {
  aceite: "Para seguir, marque que leu e aceita os termos.",
  termos: "Não conseguimos registrar o aceite. Tente de novo.",
  mp: "O Mercado Pago não respondeu agora. Tente de novo em instantes ou fale com a gente no WhatsApp.",
};

export default async function RevisaoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { erro?: string };
}) {
  const c = await getCheckout(params.id);
  if (!c) notFound();
  if (c.status === "pago") redirect(`/comecar/${c.onboarding_token}`);

  const plan = planById(c.plan);
  const op = opcao(c.plan, c.periodo, c.metodo);
  if (!plan || !op) notFound();
  const contract = contratoDoCheckout(c, op.pagamento)!;
  const terms = buildTerms(c.company, contract);
  const erro = searchParams.erro ? ERROS[searchParams.erro] : null;

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />
      <section className="pt-32 pb-20 lg:pt-36 bg-[#0a0a0a] min-h-screen">
        <div className="container-px max-w-3xl mx-auto">
          <Passos atual={2} />
          <h1 className="text-3xl sm:text-4xl font-black mt-8 text-center">Confira e aceite os termos</h1>

          <div className="mt-8 bg-[#111] border border-gold-500/30 rounded-2xl p-6 grid sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/40 text-xs uppercase tracking-widest">Plano</div>
              <div className="text-white font-bold text-lg">{plan.name}</div>
              <div className="text-white/50">{op.titulo}</div>
            </div>
            <div className="sm:text-right">
              <div className="text-white/40 text-xs uppercase tracking-widest">Total</div>
              <div className="text-gold-500 font-black text-2xl">{brlReais(Number(c.valor))}</div>
              <div className="text-white/50">{c.meses} meses a partir de hoje</div>
            </div>
            <div className="sm:col-span-2 border-t border-[#222] pt-4 text-white/60">
              {c.company} · {formatDocument(c.document)} · {c.name} · {c.email}
              <a href={`/contratar/${c.plan}`} className="text-gold-500 hover:text-gold-400 ml-2 whitespace-nowrap">
                Corrigir dados
              </a>
            </div>
          </div>

          {terms ? (
            <article className="mt-6 bg-[#0d0d0d] border border-[#222] rounded-2xl p-6 max-h-[420px] overflow-y-auto text-sm text-white/70 leading-relaxed">
              {terms.sections.map((s) => (
                <section key={s.title} className="mb-4">
                  <h2 className="text-white font-semibold mb-1">{s.title}</h2>
                  {s.paragraphs.map((p, i) => (
                    <p key={i} className="mb-1">
                      {p}
                    </p>
                  ))}
                </section>
              ))}
              <p className="text-white/30 text-xs mt-4">
                Versão {terms.version} · código {terms.hash.slice(0, 12)}
              </p>
            </article>
          ) : (
            <p className="mt-6 text-red-400">Termos indisponíveis. Fale com a gente.</p>
          )}

          <form action={aceitarEPagar} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="start" value={contract.start} />
            <label className="flex items-start gap-3 text-sm text-white/75 bg-[#111] border border-[#222] rounded-xl p-4 cursor-pointer">
              <input type="checkbox" name="aceite" required className="mt-1 accent-[#FFD700] w-4 h-4" />
              <span>
                Eu, <strong className="text-white">{c.name}</strong>, li e aceito os termos acima em nome de{" "}
                <strong className="text-white">{c.company}</strong>. O aceite vale como assinatura e fica registrado com
                data, hora e endereço de acesso.
              </span>
            </label>
            {erro && (
              <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {erro}
              </p>
            )}
            <button className="btn-primary py-4 rounded-xl text-base font-bold">
              Aceitar e pagar {brlReais(Number(c.valor))} no Mercado Pago
            </button>
            <p className="text-white/35 text-xs text-center">
              Dúvida antes de pagar?{" "}
              <a
                href={whatsapp(`Tenho uma dúvida sobre a contratação do Plano ${plan.name} (${c.company})`)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold-500 hover:text-gold-400"
              >
                Fale com a gente no WhatsApp
              </a>
            </p>
          </form>
        </div>
      </section>
      <Footer />
    </main>
  );
}
