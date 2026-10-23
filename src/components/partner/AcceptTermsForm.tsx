"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  acceptTermsAction,
  type AcceptTermsState,
} from "@/app/parceiros/[slug]/painel/actions";

const INITIAL: AcceptTermsState = { error: null };

type Theme = {
  fg: string;
  fgMuted: string;
  border: string;
  surfaceStrong: string;
  primary: string;
  onPrimary: string;
  radius: number | string;
};

function Submit({ t }: { t: Theme }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full sm:w-auto px-6 py-3.5 font-bold text-sm disabled:opacity-60"
      style={{ backgroundColor: t.primary, color: t.onPrimary, borderRadius: t.radius }}
    >
      {pending ? "Registrando…" : "Aceito os termos"}
    </button>
  );
}

export default function AcceptTermsForm({
  token,
  termsHash,
  t,
}: {
  token: string;
  termsHash: string;
  t: Theme;
}) {
  const [state, action] = useFormState(acceptTermsAction, INITIAL);

  const input = {
    backgroundColor: t.surfaceStrong,
    border: `1px solid ${t.border}`,
    borderRadius: t.radius,
    color: t.fg,
  } as const;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="terms_hash" value={termsHash} />

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-1.5 text-sm" style={{ color: t.fgMuted }}>
          Nome completo de quem aceita
          <input
            name="name"
            required
            autoComplete="name"
            className="px-4 py-3 text-base outline-none"
            style={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm" style={{ color: t.fgMuted }}>
          CPF ou CNPJ
          <input
            name="document"
            required
            inputMode="numeric"
            className="px-4 py-3 text-base outline-none"
            style={input}
          />
        </label>
      </div>

      <label className="flex items-start gap-3 text-sm leading-relaxed" style={{ color: t.fg }}>
        <input type="checkbox" name="agree" className="mt-1 w-4 h-4 flex-shrink-0" />
        Li os termos acima e concordo com eles em nome da empresa.
      </label>

      {state.error && (
        <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
          {state.error}
        </p>
      )}

      <Submit t={t} />
    </form>
  );
}
