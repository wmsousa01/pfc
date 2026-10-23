import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { channelStats, whatsapp } from "@/lib/config";
import { getProposal, isExpired, proposals } from "@/lib/proposals";
import { WhatsAppIcon, ArrowRight } from "@/components/icons";

/**
 * Proposta individual que leva direto ao pagamento.
 *
 * Revalida de hora em hora só para a validade expirar sozinha: passado o
 * prazo, o botão de pagar some e sobra o WhatsApp para renegociar.
 */
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return proposals.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Metadata {
  const p = getProposal(params.slug);
  return {
    title: p
      ? `Proposta ${p.plan} · ${p.client} | Fora da Caixa`
      : "Proposta | Fora da Caixa",
    robots: { index: false, follow: false, nocache: true },
  };
}

function brl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function dataBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function PropostaPage({
  params,
}: {
  params: { slug: string };
}) {
  const p = getProposal(params.slug);
  if (!p) notFound();

  const expired = isExpired(p);
  const perMonth = Math.round(p.price / p.months);
  const savings = p.listPrice - p.price;
  const canPay = !expired && !!p.paymentUrl;
  const waMessage = expired
    ? `Olá! Sou da ${p.client}. A proposta do plano ${p.plan} venceu e quero renovar a condição.`
    : `Olá! Sou da ${p.client} e quero fechar o plano ${p.plan} por ${brl(p.price)}.`;

  return (
    <main className="bg-dark-900 text-white overflow-x-hidden">
      <Navbar />

      {/* Hero */}
      <section className="relative pt-32 pb-12 lg:pt-40 lg:pb-16 overflow-hidden bg-[#0a0a0a]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gold-500/[0.06] rounded-full blur-[120px]" />
        </div>
        <div className="container-px relative max-w-3xl mx-auto text-center flex flex-col items-center gap-5">
          <span className="section-tag">Proposta exclusiva · {p.client}</span>
          <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight">
            Plano {p.plan}{" "}
            <span className="text-gradient-gold">no Fora da Caixa</span>
          </h1>
          <p className="text-lg text-white/65 leading-relaxed max-w-xl">
            {p.months} meses na frente de quem mora em Mogi Guaçu e região — o
            público que compra, vende e aluga aqui. Foram {channelStats.views12m}{" "}
            visualizações nos últimos 12 meses, com {channelStats.weeklyContent}{" "}
            conteúdos por semana.
          </p>
        </div>
      </section>

      <section className="section-py bg-[#111] border-y border-[#1e1e1e]">
        <div className="container-px max-w-5xl mx-auto grid lg:grid-cols-[1fr_400px] gap-6 items-start">
          {/* O que está incluído */}
          <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-2xl p-8">
            <span className="section-tag">O que está incluído</span>
            <ul className="mt-6 flex flex-col gap-3">
              {p.items.map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-gold-500 flex-shrink-0" />
                  <span className="text-white/65 text-sm leading-relaxed">
                    {t}
                  </span>
                </li>
              ))}
            </ul>

            <div className="h-px bg-[#222] my-7" />

            <span className="section-tag">Como medimos</span>
            <p className="text-white/55 text-sm leading-relaxed mt-3">
              O QR exclusivo da sua marca aparece nos conteúdos e leva à sua
              página no site do PFC. Quem se interessa responde a uma triagem
              rápida e chega no seu WhatsApp com o pedido já descrito. No seu
              painel você acompanha acessos, acessos via QR e cada contato. Na
              renovação, a conversa é sobre esses números.
            </p>
          </div>

          {/* Preço e pagamento */}
          <div className="rounded-2xl p-8 border-2 border-gold-500 bg-[#0d0d0d] shadow-[0_0_50px_rgba(255,215,0,0.14)]">
            <div className="text-white/40 text-xs font-bold uppercase tracking-widest">
              Investimento · {p.months} meses
            </div>
            {savings > 0 && (
              <div className="text-white/35 text-sm line-through mt-3">
                {brl(p.listPrice)}
              </div>
            )}
            <div className="text-gradient-gold font-black text-5xl mt-1">
              {brl(p.price)}
            </div>
            <p className="text-white/55 text-sm mt-2">
              {p.installmentsNoInterest ? (
                <>
                  ou{" "}
                  <strong className="text-white/85">
                    {p.installmentsNoInterest}x de{" "}
                    {(p.price / p.installmentsNoInterest).toLocaleString(
                      "pt-BR",
                      { style: "currency", currency: "BRL" }
                    )}{" "}
                    sem juros
                  </strong>{" "}
                  no cartão
                </>
              ) : (
                <>
                  À vista. Equivale a{" "}
                  <strong className="text-white/85">{brl(perMonth)}/mês</strong>
                </>
              )}
            </p>
            {p.discountReason && (
              <div className="mt-4 inline-flex bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                {p.discountReason}
              </div>
            )}

            {canPay ? (
              <>
                <a
                  href={p.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary mt-7 w-full px-6 py-4 rounded-xl font-bold flex items-center justify-center gap-2"
                >
                  Pagar e fechar o plano
                  <ArrowRight className="w-4 h-4" />
                </a>
                <p className="text-white/35 text-xs text-center mt-3 leading-relaxed">
                  Pagamento seguro pelo Mercado Pago: Pix, boleto ou cartão.
                </p>
              </>
            ) : null}

            <a
              href={whatsapp(waMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-full px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${
                canPay
                  ? "mt-4 border border-white/15 text-white/80 hover:border-gold-500/50 hover:text-white transition-colors"
                  : "mt-7 btn-primary"
              }`}
            >
              <WhatsAppIcon className="w-4 h-4" />
              {canPay ? "Tirar dúvidas no WhatsApp" : "Fechar pelo WhatsApp"}
            </a>

            <p
              className={`text-xs text-center mt-5 ${
                expired ? "text-red-400" : "text-white/40"
              }`}
            >
              {expired
                ? `Esta condição venceu em ${dataBR(p.validUntil)}.`
                : `Condição válida até ${dataBR(p.validUntil)}.`}
            </p>
          </div>
        </div>
      </section>

      {/* Próximos passos */}
      <section className="section-py">
        <div className="container-px max-w-3xl mx-auto">
          <span className="section-tag">Depois do pagamento</span>
          <ol className="mt-6 flex flex-col gap-4">
            {[
              "Você recebe a confirmação e o contrato pelo WhatsApp.",
              "Envia o kit da marca: logo, uma foto de capa, WhatsApp de atendimento e Instagram.",
              "Sua página e seu QR entram no ar, e a marca entra na próxima gravação.",
            ].map((t, i) => (
              <li key={t} className="flex items-start gap-4">
                <span className="w-8 h-8 rounded-full bg-gold-500/15 border border-gold-500/30 text-gold-500 font-black text-sm flex items-center justify-center flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-white/65 leading-relaxed pt-1">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Footer />
    </main>
  );
}
