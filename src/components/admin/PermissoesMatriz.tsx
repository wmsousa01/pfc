"use client";

import { AREAS_ACESSO } from "@/lib/permissoes";

const GRUPOS = ["Conteúdo", "Comercial", "Pessoal"] as const;

/**
 * Grade área × nível (nada / ver / editar) + ações sensíveis. Controlada:
 * o pai guarda a lista e os inputs escondidos saem com o `name` dado.
 */
export default function PermissoesMatriz({
  name,
  valor,
  onChange,
  herdadas = [],
}: {
  name: string;
  valor: string[];
  onChange: (v: string[]) => void;
  /** Já vêm dos papéis: aparecem como aviso na linha (só na tela da pessoa). */
  herdadas?: string[];
}) {
  const tem = (p: string) => valor.includes(p);
  const herda = (p: string) => herdadas.includes(p);

  function nivel(key: string, n: "" | "ver" | "editar") {
    const sem = valor.filter((p) => p !== `${key}.ver` && p !== `${key}.editar`);
    onChange(n ? [...sem, `${key}.${n}`] : sem);
  }

  function alternar(p: string) {
    onChange(tem(p) ? valor.filter((x) => x !== p) : [...valor, p]);
  }

  return (
    <div className="space-y-4">
      {valor.map((p) => (
        <input key={p} type="hidden" name={name} value={p} />
      ))}
      {GRUPOS.map((g) => (
        <div key={g}>
          <p className="text-[10px] font-bold tracking-[0.08em] uppercase text-white/40 mb-1.5">{g}</p>
          <div className="divide-y divide-[#1f1f1f] border border-[#1f1f1f] rounded-lg">
            {AREAS_ACESSO.filter((a) => a.grupo === g).map((a) => {
              const atual = tem(`${a.key}.editar`) ? "editar" : tem(`${a.key}.ver`) ? "ver" : "";
              const herdado = herda(`${a.key}.editar`) ? "Editar" : herda(`${a.key}.ver`) ? "Ver" : "";
              const opcoes: { v: "" | "ver" | "editar"; l: string; t?: string }[] = [
                { v: "", l: "—" },
                { v: "ver", l: "Ver", t: a.ver },
                ...(a.editar ? [{ v: "editar" as const, l: "Editar", t: a.editar }] : []),
              ];
              return (
                <div key={a.key} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                  <span className="text-sm text-white flex-1 min-w-[120px]">
                    {a.label}
                    {herdado && <span className="block text-[11px] text-white/35">{herdado} pelos papéis</span>}
                  </span>
                  <div className="flex rounded-md border border-[#2a2a2a] overflow-hidden">
                    {opcoes.map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        title={o.t}
                        onClick={() => nivel(a.key, o.v)}
                        className={`px-2.5 h-8 text-xs ${
                          atual === o.v ? "bg-gold-500/15 text-gold-400 font-semibold" : "text-white/55 hover:text-white"
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                  {a.extras?.map((e) => (
                    <label key={e.key} title={e.descricao} className="flex items-center gap-1.5 text-xs text-white/70 cursor-pointer w-full sm:w-auto">
                      <input
                        type="checkbox"
                        checked={tem(e.key) || herda(e.key)}
                        disabled={herda(e.key)}
                        onChange={() => alternar(e.key)}
                        className="accent-gold-500"
                      />
                      {e.label}
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
