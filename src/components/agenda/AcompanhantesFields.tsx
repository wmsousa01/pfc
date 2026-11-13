"use client";

import { useState } from "react";
import { MAX_ACOMPANHANTES, inputCls } from "./BriefingFields";

const label = "block text-white/70 text-sm font-semibold mb-1.5";

/** Campos de uma pessoa a mais. `prefix` separa os nomes: "extra_0_nome", ou "" no form de uma pessoa só. */
export function AcompanhanteCampos({ prefix = "" }: { prefix?: string }) {
  const n = (k: string) => `${prefix}${k}`;
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      <div>
        <label className={label} htmlFor={n("nome")}>Nome *</label>
        <input id={n("nome")} name={n("nome")} required maxLength={120} className={inputCls} placeholder="Como quer ser chamado no programa" />
      </div>
      <div>
        <label className={label} htmlFor={n("instagram")}>Instagram</label>
        <input id={n("instagram")} name={n("instagram")} className={inputCls} placeholder="@perfil" />
      </div>
      <div className="sm:col-span-2">
        <label className={label} htmlFor={n("cargo")}>Como aparece na arte</label>
        <input id={n("cargo")} name={n("cargo")} maxLength={60} className={inputCls} placeholder="Ex.: SÓCIO · DIRETORA DA ONG X" />
      </div>
      <div>
        <label className={label} htmlFor={n("whatsapp")}>WhatsApp</label>
        <input id={n("whatsapp")} name={n("whatsapp")} inputMode="tel" className={inputCls} placeholder="(19) 99999-9999" />
      </div>
      <div>
        <label className={label} htmlFor={n("email")}>E-mail</label>
        <input id={n("email")} name={n("email")} type="email" className={inputCls} placeholder="Para receber o convite da agenda" />
      </div>
    </div>
  );
}

/** "Vem mais alguém?" no pedido de horário: até MAX_ACOMPANHANTES pessoas. */
export default function AcompanhantesFields() {
  const [ids, setIds] = useState<number[]>([]);
  const [next, setNext] = useState(0);

  return (
    <div className="space-y-4">
      <p className="text-white/50 text-sm">
        Sócio, colega, alguém do projeto? Coloque aqui quem participa com você. Cada pessoa ganha o próprio link para
        mandar foto e completar o briefing.
      </p>
      {ids.map((id, i) => (
        <div key={id} className="bg-[#111] border border-[#222] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-white font-semibold text-sm">Pessoa {i + 2}</span>
            <button type="button" onClick={() => setIds(ids.filter((x) => x !== id))} className="text-white/40 hover:text-red-400 text-sm">
              remover
            </button>
          </div>
          <input type="hidden" name="extra" value={id} />
          <AcompanhanteCampos prefix={`extra_${id}_`} />
        </div>
      ))}
      {ids.length < MAX_ACOMPANHANTES && (
        <button
          type="button"
          onClick={() => {
            setIds([...ids, next]);
            setNext(next + 1);
          }}
          className="w-full border border-dashed border-[#333] hover:border-gold-500/60 text-gold-400 rounded-xl py-3 text-sm font-semibold"
        >
          + Adicionar pessoa
        </button>
      )}
    </div>
  );
}
