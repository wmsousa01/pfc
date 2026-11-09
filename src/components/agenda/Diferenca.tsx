import { diferenca } from "@/lib/diff";

/** Uma sugestão de edição como no Docs: o que sai riscado em vermelho, o que entra em verde. */
export default function Diferenca({ antes, depois, className = "" }: { antes: string; depois: string; className?: string }) {
  return (
    <p className={`whitespace-pre-line leading-relaxed ${className}`}>
      {diferenca(antes, depois).map((t, i) =>
        t.tipo === "igual" ? (
          <span key={i}>{t.texto}</span>
        ) : t.tipo === "sai" ? (
          <del key={i} className="bg-red-500/15 text-red-300 decoration-red-400/70">{t.texto}</del>
        ) : (
          <ins key={i} className="bg-emerald-500/15 text-emerald-200 no-underline">{t.texto}</ins>
        )
      )}
    </p>
  );
}
