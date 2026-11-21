import { clausulas, TERMO_VERSAO } from "@/lib/apresentadores/termo";

/** Texto do termo de uso de imagem, numa caixa que rola. */
export default function TermoImagem({ versao = TERMO_VERSAO, alto = true }: { versao?: string; alto?: boolean }) {
  return (
    <div className={`bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-4 space-y-3 text-sm text-white/70 ${alto ? "max-h-64 overflow-y-auto" : ""}`}>
      <p className="text-white font-semibold">Termo de autorização de uso de imagem e voz</p>
      {clausulas(versao).map((c) => (
        <div key={c.titulo}>
          <p className="text-white/85 font-semibold">{c.titulo}</p>
          <p className="mt-0.5 leading-relaxed">{c.texto}</p>
        </div>
      ))}
      <p className="text-white/30 text-xs">Versão {versao}</p>
    </div>
  );
}
