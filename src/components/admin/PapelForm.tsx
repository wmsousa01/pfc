"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/producao/actions";
import PermissoesMatriz from "./PermissoesMatriz";

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50";

function Salvar({ novo }: { novo: boolean }) {
  const s = useFormStatus();
  return (
    <button disabled={s.pending} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-wait">
      {s.pending ? "Salvando..." : novo ? "Criar papel" : "Salvar papel"}
    </button>
  );
}

export default function PapelForm({
  action,
  papel,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  papel?: { chave: string; nome: string; descricao: string; permissoes: string[] };
}) {
  const [state, formAction] = useFormState(action, { ok: false, error: null });
  const [permissoes, setPermissoes] = useState<string[]>(papel?.permissoes ?? []);

  return (
    <form action={formAction} className="space-y-4">
      {papel && <input type="hidden" name="chave" value={papel.chave} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label>
          <span className="block text-white/55 text-xs mb-1">Nome do papel</span>
          <input name="nome" defaultValue={papel?.nome} required className={inputCls} placeholder="Ex.: Roteirista" />
        </label>
        <label>
          <span className="block text-white/55 text-xs mb-1">Para quem é</span>
          <input name="descricao" defaultValue={papel?.descricao} className={inputCls} placeholder="Uma frase sobre o que a pessoa faz" />
        </label>
      </div>
      <PermissoesMatriz name="permissoes" valor={permissoes} onChange={setPermissoes} />
      <Salvar novo={!papel} />
      {state?.error && <p className="text-red-400 text-xs break-words">{state.error}</p>}
      {state?.ok && <p className="text-emerald-400 text-xs">Salvo. Quem tem o papel já recebe a mudança na próxima página que abrir.</p>}
    </form>
  );
}
