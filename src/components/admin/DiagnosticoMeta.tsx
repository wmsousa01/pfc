import { efetivoPt, type Diagnostico, type ItemMeta, type Nivel } from "@/lib/campanhas/meta-diagnostico";
import { card } from "./Campanhas";

const COR: Record<Nivel, string> = {
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  aviso: "border-gold-500/30 bg-gold-500/10 text-gold-300",
  erro: "border-red-500/30 bg-red-500/10 text-red-300",
};
const ICONE: Record<Nivel, string> = { ok: "✓", aviso: "!", erro: "✕" };

function corEfetivo(s: string): string {
  if (s === "ACTIVE") return "text-emerald-300";
  if (s === "DISAPPROVED" || s === "WITH_ISSUES" || s === "PENDING_BILLING_INFO") return "text-red-300";
  if (s === "PENDING_REVIEW" || s === "IN_PROCESS") return "text-gold-300";
  return "text-white/45";
}

function Lista({ titulo, itens }: { titulo: string; itens: ItemMeta[] }) {
  return (
    <div className="mt-4">
      <h3 className="text-white/70 text-xs font-bold uppercase tracking-wide">
        {titulo} <span className="text-white/30 font-normal">({itens.length})</span>
      </h3>
      {itens.length === 0 ? (
        <p className="text-white/35 text-xs mt-1.5">Nenhum.</p>
      ) : (
        <ul className="mt-1.5 divide-y divide-[#1c1c1c]">
          {itens.map((i) => (
            <li key={i.id} className="py-2 text-xs">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-white/85 break-words min-w-0">{i.nome}</span>
                <span className={`whitespace-nowrap ${corEfetivo(i.efetivo)}`}>{efetivoPt(i.efetivo)}</span>
              </div>
              <div className="text-white/30 mt-0.5 break-words">
                id {i.id}
                {i.extra ? ` · ${i.extra}` : ""}
              </div>
              {i.problemas.map((p, k) => (
                <p key={k} className="text-red-300/90 mt-0.5 break-words">• {p}</p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function DiagnosticoMeta({ d }: { d: Diagnostico }) {
  const quando = new Date(d.em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return (
    <section className={`${card} mt-4 max-w-5xl`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-white font-bold">Diagnóstico da conta Meta</h2>
        <span className="text-white/30 text-[11px]">lido agora, {quando}</span>
      </div>
      {d.conta && (
        <p className="text-white/50 text-xs mt-1">
          {d.conta.nome} · {d.conta.id} · {d.conta.status} · gasto total {d.conta.gasto} · {d.conta.fuso}
          {d.usuario ? ` · conectada por ${d.usuario}` : ""}
        </p>
      )}
      <p className="text-white/30 text-[11px] mt-1">
        Só leitura. A trava de criação é testada com uma campanha em modo validate_only, que a Meta valida e não cria.
      </p>

      <ul className="mt-3 space-y-2">
        {d.achados.map((a, i) => (
          <li key={i} className={`rounded-lg border px-3 py-2 text-sm ${COR[a.nivel]}`}>
            <span className="font-bold mr-1.5">{ICONE[a.nivel]}</span>
            {a.titulo}
            {a.detalhe && <p className="text-xs opacity-80 mt-0.5 break-words">{a.detalhe}</p>}
          </li>
        ))}
      </ul>

      {d.conta && (
        <>
          <Lista titulo="Campanhas" itens={d.campanhas} />
          <Lista titulo="Conjuntos" itens={d.conjuntos} />
          <Lista titulo="Anúncios" itens={d.anuncios} />
        </>
      )}
    </section>
  );
}
