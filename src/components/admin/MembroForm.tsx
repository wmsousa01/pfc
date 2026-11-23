"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/producao/actions";
import { resumoPermissoes, rotuloPermissao } from "@/lib/permissoes";
import PermissoesMatriz from "./PermissoesMatriz";

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50";

type PapelOpcao = { chave: string; nome: string; descricao: string; permissoes: string[] };

function Salvar({ novo }: { novo: boolean }) {
  const s = useFormStatus();
  return (
    <button disabled={s.pending} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-wait">
      {s.pending ? "Salvando..." : novo ? "Criar acesso" : "Salvar"}
    </button>
  );
}

/**
 * Cadastro e edição de pessoa da equipe: um ou mais papéis, permissões avulsas
 * por cima e, para quem apresenta, o vínculo com o cadastro de apresentador.
 */
export default function MembroForm({
  action,
  papeis,
  cadastros,
  membro,
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  papeis: PapelOpcao[];
  cadastros: { id: string; nome: string; email: string | null }[];
  membro?: {
    user_id: string;
    nome: string;
    email: string;
    papeis: string[];
    permissoes_extras: string[];
    apresentador_id: string | null;
  };
}) {
  const [state, formAction] = useFormState(action, { ok: false, error: null });
  const [escolhidos, setEscolhidos] = useState<string[]>(membro?.papeis ?? []);
  const [extras, setExtras] = useState<string[]>(membro?.permissoes_extras ?? []);
  const [apresentador, setApresentador] = useState(membro?.apresentador_id ?? "");
  const [nome, setNome] = useState(membro?.nome ?? "");
  const [email, setEmail] = useState(membro?.email ?? "");

  const herdadas = useMemo(
    () => Array.from(new Set(papeis.filter((p) => escolhidos.includes(p.chave)).flatMap((p) => p.permissoes))),
    [papeis, escolhidos]
  );
  const total = resumoPermissoes(Array.from(new Set([...herdadas, ...extras])));
  const veMeusQuadros = total.includes("meus_quadros.ver");

  function alternar(chave: string) {
    setEscolhidos((a) => (a.includes(chave) ? a.filter((x) => x !== chave) : [...a, chave]));
  }

  function escolherCadastro(id: string) {
    setApresentador(id);
    const c = cadastros.find((x) => x.id === id);
    if (c && !membro) {
      if (!nome) setNome(c.nome);
      if (!email && c.email) setEmail(c.email);
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {membro && <input type="hidden" name="user_id" value={membro.user_id} />}
      {escolhidos.map((p) => (
        <input key={p} type="hidden" name="papeis" value={p} />
      ))}
      <input type="hidden" name="apresentador_id" value={veMeusQuadros ? apresentador : ""} />

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="block text-white/55 text-xs mb-1">Nome</span>
          <input name="nome" value={nome} onChange={(e) => setNome(e.target.value)} required className={inputCls} />
        </label>
        <label>
          <span className="block text-white/55 text-xs mb-1">E-mail (login)</span>
          <input
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        <span className="block text-white/55 text-xs mb-1.5">Papéis (pode marcar mais de um; o acesso soma)</span>
        <div className="grid gap-2 sm:grid-cols-3">
          {papeis.map((p) => {
            const on = escolhidos.includes(p.chave);
            return (
              <button
                key={p.chave}
                type="button"
                onClick={() => alternar(p.chave)}
                aria-pressed={on}
                className={`text-left rounded-lg border px-3 py-2 ${on ? "border-gold-500/60 bg-gold-500/10" : "border-[#2a2a2a] hover:border-[#3a3a3a]"}`}
              >
                <span className={`flex items-center gap-2 text-sm font-semibold ${on ? "text-gold-400" : "text-white"}`}>
                  <span className={`w-3.5 h-3.5 rounded border shrink-0 ${on ? "bg-gold-500 border-gold-500" : "border-white/30"}`} />
                  {p.nome}
                </span>
                <span className="block text-white/40 text-[11px] leading-snug mt-0.5">{p.descricao}</span>
              </button>
            );
          })}
        </div>
      </div>

      {veMeusQuadros && (
        <label className="block">
          <span className="block text-white/55 text-xs mb-1">Cadastro de apresentador ligado a este login</span>
          <select value={apresentador} onChange={(e) => escolherCadastro(e.target.value)} className={inputCls}>
            <option value="">— escolha o cadastro aprovado —</option>
            {cadastros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
                {c.email ? ` · ${c.email}` : ""}
              </option>
            ))}
          </select>
          <span className="block text-white/30 text-[11px] mt-1">
            Sem o vínculo, “Meus quadros” abre vazio. O cadastro e o termo continuam pelo link /apresentador.
          </span>
        </label>
      )}

      <details open={extras.length > 0}>
        <summary className="cursor-pointer text-white/55 text-xs hover:text-white">
          Permissões avulsas (além dos papéis){extras.length > 0 ? ` · ${extras.length}` : ""}
        </summary>
        <div className="mt-3">
          <PermissoesMatriz name="extras" valor={extras} onChange={setExtras} herdadas={herdadas} />
        </div>
      </details>

      <div>
        <span className="block text-white/55 text-xs mb-1.5">Acesso resultante</span>
        <div className="flex flex-wrap gap-1.5">
          {total.length === 0 ? (
            <span className="text-white/35 text-xs">Nenhum ainda.</span>
          ) : (
            total.map((p) => (
              <span key={p} className="text-[11px] px-2 py-0.5 rounded border bg-white/5 border-white/10 text-white/70">
                {rotuloPermissao(p)}
              </span>
            ))
          )}
        </div>
      </div>

      <Salvar novo={!membro} />
      {state?.error && <p className="text-red-400 text-xs break-words">{state.error}</p>}
      {state?.ok && <p className="text-emerald-400 text-xs">Salvo.</p>}
    </form>
  );
}
