"use client";

import { useEffect, useState } from "react";

/**
 * Ações de um cartão do quadro. No desktop ficam em linha; no celular vão para
 * o botão ⋯, que abre uma folha vinda de baixo com alvos grandes para o dedo.
 */
export default function CardAcoes({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  detalhe?: string;
  children: React.ReactNode;
}) {
  const [aberta, setAberta] = useState(false);

  useEffect(() => {
    if (!aberta) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberta(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [aberta]);

  return (
    <>
      <div className="hidden md:flex items-center gap-2.5">{children}</div>
      <button
        type="button"
        onClick={() => setAberta(true)}
        aria-label={`Ações: ${titulo}`}
        className="md:hidden flex items-center justify-center w-11 h-9 -mr-2 rounded-lg text-white/65"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {aberta && (
        <div className="md:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Fechar" onClick={() => setAberta(false)} className="absolute inset-0 bg-black/60" />
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Ações: ${titulo}`}
            // Fecha depois do envio: o form da ação já foi disparado quando a folha some.
            onSubmitCapture={() => setTimeout(() => setAberta(false), 0)}
            className="absolute inset-x-0 bottom-0 bg-[#141414] border-t border-[#262626] rounded-t-2xl px-4 pt-2 pb-6 flex flex-col gap-3.5"
          >
            <span aria-hidden="true" className="self-center w-10 h-1 rounded-full bg-[#3a3a3a]" />
            <div>
              <p className="text-white text-base font-semibold leading-snug">{titulo}</p>
              {detalhe && <p className="text-white/55 text-[13px] mt-1">{detalhe}</p>}
            </div>
            <div className="flex flex-col gap-2 [&>*]:w-full [&_a]:flex [&_a]:items-center [&_a]:justify-center [&_a]:h-12 [&_a]:rounded-xl [&_a]:border [&_a]:border-[#2a2a2a] [&_a]:text-[15px] [&_button]:w-full [&_button]:h-12 [&_button]:rounded-xl [&_button]:border [&_button]:border-[#2a2a2a] [&_button]:text-[15px]">
              {children}
            </div>
            <button type="button" onClick={() => setAberta(false)} className="h-11 text-white/55 text-sm">
              Fechar
            </button>
          </section>
        </div>
      )}
    </>
  );
}
