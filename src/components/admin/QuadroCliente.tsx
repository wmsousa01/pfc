"use client";

import { Children, useState } from "react";

export type ColunaInfo = { titulo: string; count: number; alerta?: boolean };

/**
 * No celular o quadro mostra uma coluna por vez, escolhida pelos botões do topo
 * (como no app do Jira); do tablet para cima, as colunas ficam lado a lado.
 */
export default function QuadroCliente({
  colunas,
  gridCls,
  children,
}: {
  colunas: ColunaInfo[];
  gridCls: string;
  children: React.ReactNode;
}) {
  const [ativa, setAtiva] = useState(0);
  const filhos = Children.toArray(children);
  return (
    <>
      <div role="tablist" aria-label="Coluna do quadro" className="md:hidden flex gap-1.5 mt-4 -mx-4 px-4 overflow-x-auto">
        {colunas.map((c, i) => (
          <button
            key={c.titulo}
            type="button"
            role="tab"
            aria-selected={i === ativa}
            onClick={() => setAtiva(i)}
            className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-full text-[13px] whitespace-nowrap border ${
              i === ativa
                ? "border-gold-500/60 bg-gold-500/10 text-gold-400 font-semibold"
                : "border-[#2a2a2a] text-white/65"
            }`}
          >
            {c.titulo}
            <span className={c.alerta && c.count > 0 ? "text-red-400 font-bold" : "text-white/40"}>{c.count}</span>
          </button>
        ))}
      </div>
      <div className={gridCls}>
        {filhos.map((f, i) => (
          <div key={i} className={`min-w-0 ${i === ativa ? "" : "hidden md:block"}`}>
            {f}
          </div>
        ))}
      </div>
    </>
  );
}
