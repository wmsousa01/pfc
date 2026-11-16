"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/producao/actions";
import { AREAS, PAPEIS, PERMISSOES_EXTRAS, type Papel } from "@/lib/permissoes";

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50";

function Salvar({ novo }: { novo: boolean }) {
  const s = useFormStatus();
  return (
    <button disabled={s.pending} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-wait">
      {s.pending ? "Salvando..." : novo ? "Criar acesso" : "Salvar"}
    </button>
  );
}

/**
 * Cadastro e edição de membro. Escolher o papel marca as áreas dele; mexer numa
 * área depois disso vira "Personalizado".
 */
export default function MembroForm({
  action,
  membro,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  membro?: { user_id: string; nome: string; email: string; papel: Papel; areas: string[] };
}) {
  const [state, formAction] = useFormState(action, { ok: false, error: null });
  const [papel, setPapel] = useState<Papel>(membro?.papel ?? "editor");
  const [areas, setAreas] = useState<string[]>(membro?.areas ?? PAPEIS.editor.areas);

  function escolherPapel(p: Papel) {
    setPapel(p);
    if (p !== "personalizado") setAreas(PAPEIS[p].areas);
  }

  function alternar(k: string) {
    setAreas((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
    setPapel("personalizado");
  }

  const opcoes = [...AREAS, ...PERMISSOES_EXTRAS];

  return (
    <form action={formAction} className="space-y-4">
      {membro && <input type="hidden" name="user_id" value={membro.user_id} />}
      <input type="hidden" name="papel" value={papel} />
      {areas.map((a) => (
        <input key={a} type="hidden" name="areas" value={a} />
      ))}

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="block text-white/55 text-xs mb-1">Nome</span>
          <input name="nome" defaultValue={membro?.nome} required className={inputCls} />
        </label>
        <label>
          <span className="block text-white/55 text-xs mb-1">E-mail (login)</span>
          <input
            name="email"
            type="email"
            defaultValue={membro?.email}
            required
            readOnly={!!membro}
            className={`${inputCls} ${membro ? "text-white/50" : ""}`}
          />
        </label>
        <label>
          <span className="block text-white/55 text-xs mb-1">{membro ? "Nova senha (opcional)" : "Senha inicial"}</span>
          <input name="senha" type="text" autoComplete="new-password" className={inputCls} placeholder={membro ? "Deixe em branco para manter" : ""} />
        </label>
      </div>

      <div>
        <span className="block text-white/55 text-xs mb-1.5">Nível de acesso</span>
        <div className="grid gap-2 sm:grid-cols-4">
          {(Object.keys(PAPEIS) as Papel[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => escolherPapel(p)}
              className={`text-left rounded-lg border px-3 py-2 ${
                papel === p ? "border-gold-500/60 bg-gold-500/10" : "border-[#2a2a2a] hover:border-[#3a3a3a]"
              }`}
            >
              <span className={`block text-sm font-semibold ${papel === p ? "text-gold-400" : "text-white"}`}>{PAPEIS[p].label}</span>
              <span className="block text-white/40 text-[11px] leading-snug mt-0.5">{PAPEIS[p].descricao}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="block text-white/55 text-xs mb-1.5">Áreas liberadas</span>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {opcoes.map((o) => (
            <label key={o.key} className="flex items-start gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={areas.includes(o.key)} onChange={() => alternar(o.key)} className="mt-1 accent-gold-500" />
              <span>
                <span className="text-white">{o.label}</span>
                <span className="block text-white/40 text-[11px]">{o.descricao}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="text-white/30 text-[11px] mt-2">
          Parceiros, pedidos, produtos, revendedores, entregas e reports continuam só para administradores.
        </p>
      </div>

      <Salvar novo={!membro} />
      {state?.error && <p className="text-red-400 text-xs break-words">{state.error}</p>}
      {state?.ok && <p className="text-emerald-400 text-xs">Salvo.</p>}
    </form>
  );
}
