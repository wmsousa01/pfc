"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/producao/actions";

const initial: ActionState = { ok: false, error: null };

function Submit({ label, pending, className }: { label: string; pending: string; className: string }) {
  const s = useFormStatus();
  return (
    <button disabled={s.pending} className={`${className} disabled:opacity-50 disabled:cursor-wait`}>
      {s.pending ? pending : label}
    </button>
  );
}

/**
 * Form de server action com botão que mostra o andamento e o erro na volta.
 * Gerar thumb leva ~30 s: sem o "Gerando..." a equipe clicaria de novo.
 */
export default function ProducaoForm({
  action,
  label,
  pending,
  okMessage,
  children,
  className = "",
  buttonClassName = "btn-primary px-4 py-2 rounded-lg text-sm font-bold",
}: {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  label: string;
  pending: string;
  okMessage?: string;
  children?: React.ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const [state, formAction] = useFormState(action, initial);
  return (
    <form action={formAction} className={className}>
      {children}
      <Submit label={label} pending={pending} className={buttonClassName} />
      {state.error && <p className="text-red-400 text-xs mt-2 break-words">{state.error}</p>}
      {state.ok && okMessage && <p className="text-emerald-400 text-xs mt-2">{okMessage}</p>}
    </form>
  );
}
