"use client";

import { useEffect, useState } from "react";
import QuadroLogo from "@/components/QuadroLogo";
import { CAMPANHA, campanhaAtiva, diasParaAcabar, ofertaFundador, quadrosFundador } from "@/lib/campanha";

/**
 * Faixa da campanha de patrocinador fundador. É client para sumir sozinha
 * depois do prazo mesmo em página estática gerada antes dele.
 */
export default function CampanhaFundador({ className = "" }: { className?: string }) {
  const [ativa, setAtiva] = useState(true);
  const [dias, setDias] = useState<number | null>(null);
  useEffect(() => {
    setAtiva(campanhaAtiva());
    setDias(diasParaAcabar());
  }, []);

  const qs = quadrosFundador();
  if (!ativa || qs.length === 0) return null;

  return (
    <div
      className={`rounded-2xl border border-gold-500/40 bg-gradient-to-br from-gold-500/[0.10] via-gold-500/[0.03] to-transparent p-5 sm:p-7 ${className}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center gap-5 lg:gap-8">
        <div className="flex -space-x-2 flex-shrink-0">
          {qs.map((q) => (
            <QuadroLogo key={q.slug} quadro={q.slug} nome={q.name} className="w-14 h-14 ring-2 ring-[#0a0a0a]" />
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-black bg-gold-500 px-2.5 py-1 rounded-full">
              {CAMPANHA.nome}
            </span>
            <span className="text-gold-400 text-xs font-semibold">
              {dias === null ? `até ${CAMPANHA.prazoLabel}` : dias === 0 ? "último dia" : `faltam ${dias} dias`}
            </span>
          </div>
          <h3 className="text-white font-black text-xl sm:text-2xl mt-2 leading-tight">
            Seja a primeira marca de {qs.map((q) => q.name).join(" e ")}
          </h3>
          <p className="text-white/60 text-sm mt-1.5 leading-relaxed">{ofertaFundador()}</p>
        </div>
        <a
          href="/monte-seu-plano"
          className="btn-primary px-6 py-3 rounded-xl text-sm font-bold text-center whitespace-nowrap self-start lg:self-center"
        >
          Garantir a condição
        </a>
      </div>
    </div>
  );
}
