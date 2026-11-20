"use client";

import { useState } from "react";

type Gerado = { ok: true; url: string } | { ok: false; error: string };

/** Copia um link pronto (`texto`) ou gerado na hora pelo servidor (`gerar`, ex.: download assinado). */
export default function CopiarLink({
  texto,
  gerar,
  label = "Copiar link",
  className,
}: {
  texto?: string;
  gerar?: () => Promise<Gerado>;
  label?: string;
  className: string;
}) {
  const [estado, setEstado] = useState<string | null>(null);

  async function copiar() {
    setEstado("...");
    try {
      let url = texto ?? "";
      if (gerar) {
        const r = await gerar();
        if (!r.ok) return setEstado(r.error);
        url = r.url;
      }
      try {
        await navigator.clipboard.writeText(url);
        setEstado("copiado!");
      } catch {
        // Sem permissão de área de transferência: mostra para copiar à mão.
        window.prompt("Copie o link:", url);
        setEstado(null);
      }
    } catch (e) {
      setEstado(e instanceof Error ? e.message : "falhou");
    }
    setTimeout(() => setEstado(null), 2500);
  }

  return (
    <button type="button" onClick={copiar} className={className}>
      {estado ?? label}
    </button>
  );
}
