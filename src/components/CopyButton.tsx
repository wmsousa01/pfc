"use client";

import { useState } from "react";

/** Botão de copiar com confirmação visual — usado nos links/cupons. */
export default function CopyButton({
  value,
  label = "Copiar",
  className = "",
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Navegador sem permissão de clipboard — o texto continua selecionável.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        "text-xs font-semibold border border-[#2a2a2a] text-white/60 hover:text-white hover:border-gold-500/50 rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
      }
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
