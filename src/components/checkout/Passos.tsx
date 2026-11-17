import { PASSOS } from "@/lib/checkout";

/** Barra de progresso da jornada: Plano → Dados → Termos → Pagamento → Onboarding. */
export default function Passos({ atual }: { atual: number }) {
  return (
    <ol className="flex items-center justify-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs flex-wrap" aria-label="Etapas da contratação">
      {PASSOS.map((p, i) => {
        const feito = i < atual;
        const agora = i === atual;
        return (
          <li key={p} className="flex items-center gap-1.5 sm:gap-3">
            <span
              aria-current={agora ? "step" : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${
                agora
                  ? "border-gold-500 bg-gold-500/15 text-gold-400"
                  : feito
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-[#2a2a2a] text-white/35"
              }`}
            >
              {feito ? "✓" : i + 1} <span>{p}</span>
            </span>
            {i < PASSOS.length - 1 && <span className="text-white/15 hidden sm:inline">—</span>}
          </li>
        );
      })}
    </ol>
  );
}
