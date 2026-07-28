"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  changeOwnPasswordAction,
  type PasswordFormState,
} from "@/lib/auth-actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/config";

const initialState: PasswordFormState = { ok: false, error: null };

const inputCls =
  "mt-1.5 w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50 transition-colors";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="btn-primary py-2.5 px-5 rounded-lg text-sm font-bold disabled:opacity-50 w-fit"
    >
      {pending ? "Salvando..." : "Trocar senha"}
    </button>
  );
}

/** Bloco "minha senha" do painel. Serve tanto para o admin quanto para o revendedor. */
export default function PasswordCard() {
  const [state, formAction] = useFormState(changeOwnPasswordAction, initialState);

  return (
    <div className="bg-[#111] border border-[#222] rounded-xl p-6">
      <h2 className="text-white font-bold text-lg">Minha senha</h2>
      <p className="text-white/45 text-sm mt-1 leading-relaxed">
        Pedimos a senha atual de propósito — assim um navegador esquecido aberto
        não vira uma troca de senha.
      </p>

      {state.ok ? (
        <div className="mt-5 flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-4 py-3">
          <span className="text-emerald-400">✓</span>
          <p className="text-emerald-300 text-sm">
            Senha alterada. Ela já vale no próximo login — esta sessão continua
            aberta normalmente.
          </p>
        </div>
      ) : (
        <form action={formAction} className="mt-5 flex flex-col gap-4 max-w-md">
          <div>
            <label className="text-white/60 text-sm font-medium">
              Senha atual
            </label>
            <input
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-white/60 text-sm font-medium">
                Nova senha
              </label>
              <input
                name="password"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className={inputCls}
                placeholder={`mín. ${MIN_PASSWORD_LENGTH} caracteres`}
              />
            </div>
            <div>
              <label className="text-white/60 text-sm font-medium">
                Repita a nova senha
              </label>
              <input
                name="password_confirm"
                type="password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
            </div>
          </div>

          {state.error && <p className="text-red-400 text-sm">{state.error}</p>}

          <SubmitButton />
        </form>
      )}
    </div>
  );
}
