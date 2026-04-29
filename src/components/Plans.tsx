"use client";

import { useState } from "react";

type Plan = {
  id: string;
  name: string;
  badge?: string;
  tagline: string;
  highlighted: boolean;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyEquivalent: number;
  savings: number;
  features: string[];
  ctaLabel: string;
  ctaUrl: string;
};

const plans: Plan[] = [
  {
    id: "apoio",
    name: "Apoio",
    tagline: "Ideal para marcas que querem começar.",
    highlighted: false,
    monthlyPrice: 297,
    yearlyPrice: 2851,
    yearlyEquivalent: 237,
    savings: 713,
    features: [
      "Inserções pontuais",
      "Stories de divulgação",
      "Link na descrição",
      "Participação em ações específicas",
    ],
    ctaLabel: "Quero o Plano Apoio",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Apoio%20do%20PFC",
  },
  {
    id: "patrocinador",
    name: "Patrocinador",
    badge: "Mais escolhido",
    tagline: "Ideal para presença recorrente.",
    highlighted: true,
    monthlyPrice: 797,
    yearlyPrice: 7651,
    yearlyEquivalent: 637,
    savings: 1913,
    features: [
      "Logo no estúdio",
      "Menção nos episódios",
      "Presença em cortes",
      "Stories com CTA",
      "Link na descrição",
      "Possibilidade de collab",
    ],
    ctaLabel: "Quero ser Patrocinador",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Patrocinador%20do%20PFC",
  },
  {
    id: "master",
    name: "Master",
    tagline: "Ideal para máxima presença e exclusividade.",
    highlighted: false,
    monthlyPrice: 1997,
    yearlyPrice: 19171,
    yearlyEquivalent: 1597,
    savings: 4793,
    features: [
      "Exclusividade por segmento",
      "Presença em todos os episódios",
      "Destaque no estúdio",
      "Menções ao vivo",
      "Conteúdos especiais",
      "Episódio temático",
      "PFC Visita",
      "Relatório de resultados",
    ],
    ctaLabel: "Quero ser Master",
    ctaUrl:
      "https://wa.me/5519989331908?text=Tenho%20interesse%20no%20plano%20Master%20do%20PFC",
  },
];

function fmt(value: number): string {
  return value.toLocaleString("pt-BR");
}

const CheckIcon = ({ highlighted }: { highlighted: boolean }) => (
  <div
    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5 ${
      highlighted
        ? "bg-gold-500/20 border border-gold-500/40"
        : "bg-white/5 border border-white/10"
    }`}
  >
    <svg
      className={`w-3 h-3 ${highlighted ? "text-gold-500" : "text-white/50"}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
    </svg>
  </div>
);

const WaIcon = () => (
  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

function PlanCard({ plan, isYearly }: { plan: Plan; isYearly: boolean }) {
  const {
    name,
    badge,
    tagline,
    highlighted,
    monthlyPrice,
    yearlyPrice,
    yearlyEquivalent,
    savings,
    features,
    ctaLabel,
    ctaUrl,
  } = plan;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-7 transition-all duration-300 ${
        highlighted
          ? "bg-[#0d0d0d] border-2 border-gold-500 shadow-[0_0_50px_rgba(255,215,0,0.14)] md:scale-[1.02]"
          : "bg-[#0d0d0d] border border-[#2a2a2a] hover:border-gold-500/40"
      }`}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <span className="bg-gold-500 text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest whitespace-nowrap">
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              highlighted ? "bg-gold-500" : "bg-white/20"
            }`}
          />
          <span
            className={`text-xs font-bold uppercase tracking-widest ${
              highlighted ? "text-gold-500" : "text-white/40"
            }`}
          >
            Plano
          </span>
        </div>
        <h3
          className={`text-3xl font-black ${
            highlighted ? "text-gold-500" : "text-white"
          }`}
        >
          {name}
        </h3>
        <p className="text-white/45 text-sm mt-1.5 leading-relaxed">{tagline}</p>
      </div>

      {/* Price block */}
      <div
        className={`rounded-xl p-4 mb-5 ${
          highlighted
            ? "bg-gold-500/[0.08] border border-gold-500/20"
            : "bg-white/[0.03] border border-white/[0.08]"
        }`}
      >
        {isYearly ? (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-3xl lg:text-4xl font-black ${
                  highlighted ? "text-gold-500" : "text-white"
                }`}
              >
                R$&nbsp;{fmt(yearlyPrice)}
              </span>
              <span className="text-white/40 text-sm">/ano</span>
            </div>
            <p className="text-white/50 text-sm mt-1.5">
              Equivale a{" "}
              <strong className="text-white/80">
                R$&nbsp;{fmt(yearlyEquivalent)}/mês
              </strong>
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-1 rounded-full">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
              Economia de R$&nbsp;{fmt(savings)} no ano
            </div>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span
                className={`text-3xl lg:text-4xl font-black ${
                  highlighted ? "text-gold-500" : "text-white"
                }`}
              >
                R$&nbsp;{fmt(monthlyPrice)}
              </span>
              <span className="text-white/40 text-sm">/mês</span>
            </div>
            <p className="text-white/40 text-xs mt-1.5">
              Ou{" "}
              <span className="text-gold-500/80 font-semibold">
                R$&nbsp;{fmt(yearlyEquivalent)}/mês
              </span>{" "}
              no plano anual
            </p>
          </>
        )}
      </div>

      {/* Divider */}
      <div
        className={`w-full h-px mb-5 ${
          highlighted ? "bg-gold-500/20" : "bg-[#222]"
        }`}
      />

      {/* Features */}
      <div className="flex-1 flex flex-col gap-2.5 mb-7">
        {features.map((feature, i) => (
          <div key={i} className="flex items-start gap-3">
            <CheckIcon highlighted={highlighted} />
            <span className="text-white/70 text-sm leading-snug">{feature}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <a
        href={ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`w-full py-4 rounded-xl font-bold text-center flex items-center justify-center gap-2 ${
          highlighted ? "btn-primary" : "btn-outline hover:bg-white/5"
        }`}
      >
        <WaIcon />
        {ctaLabel}
      </a>
    </div>
  );
}

export default function Plans() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <section id="planos" className="section-py bg-[#111] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gold-500/[0.04] rounded-full blur-[120px]" />
      </div>

      <div className="container-px relative">
        {/* Header */}
        <div className="text-center mb-10">
          <span className="section-tag">Planos de Patrocínio</span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
            Escolha como sua marca vai{" "}
            <span className="text-gradient-gold">participar do PFC</span>
          </h2>
          <p className="text-white/50 mt-4 max-w-2xl mx-auto leading-relaxed">
            Planos mensais para começar agora ou assinatura anual com{" "}
            <span className="text-gold-500 font-semibold">20% de desconto</span>{" "}
            para marcas que querem presença contínua.
          </p>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-14">
          <span
            className={`text-sm font-semibold transition-colors duration-200 ${
              !isYearly ? "text-white" : "text-white/40"
            }`}
          >
            Mensal
          </span>

          <button
            onClick={() => setIsYearly((v) => !v)}
            aria-label="Alternar entre mensal e anual"
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60 ${
              isYearly ? "bg-gold-500" : "bg-[#333]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                isYearly ? "translate-x-7" : "translate-x-0.5"
              }`}
            />
          </button>

          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-semibold transition-colors duration-200 ${
                isYearly ? "text-white" : "text-white/40"
              }`}
            >
              Anual
            </span>
            <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              20% OFF
            </span>
          </div>
        </div>

        {/* Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} isYearly={isYearly} />
          ))}
        </div>

        {/* Scarcity */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-start sm:items-center gap-3 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-5 py-3 max-w-xl">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0 mt-1 sm:mt-0" />
            <p className="text-white/60 text-sm leading-relaxed">
              <strong className="text-white">Vagas limitadas por segmento.</strong>{" "}
              O Plano Master garante prioridade e exclusividade comercial.
            </p>
          </div>
        </div>

        {/* Fine print */}
        <p className="text-center text-white/25 text-xs mt-4">
          Os planos podem ser personalizados conforme o objetivo da marca e
          disponibilidade editorial.
        </p>
      </div>
    </section>
  );
}
