"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MOMENTOS, STATUS_INSERCAO, TIPOS, type EstadoRegie, type ItemFila } from "@/lib/ao-vivo/tipos";

const POLL_MS = 1500;

const mmss = (s: number) => {
  const t = Math.max(0, Math.round(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
};

const btn =
  "min-h-[44px] px-4 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-wait active:scale-[.98]";

/**
 * Régie das inserções: o relógio solta sozinho, e aqui dá para segurar
 * (convidado emocionado, assunto sério), soltar antes, pular ou tirar do ar.
 * Mobile first: o operador usa no celular ao lado do switcher.
 */
export default function AoVivoRegie({ token, inicial }: { token: string; inicial: EstadoRegie }) {
  const [e, setE] = useState<EstadoRegie>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());
  const offset = useRef(new Date(inicial.agora).getTime() - Date.now());

  const receber = useCallback((x: EstadoRegie) => {
    offset.current = new Date(x.agora).getTime() - Date.now();
    setE(x);
  }, []);

  useEffect(() => {
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/ao-vivo/regie/${token}`, { cache: "no-store" });
        if (r.ok && vivo) receber((await r.json()) as EstadoRegie);
      } catch {
        // Sem rede: a tela do OBS segue sozinha; aqui só atrasa a atualização.
      }
    }, POLL_MS);
    const relogio = setInterval(() => setAgora(Date.now()), 250);
    return () => {
      vivo = false;
      clearInterval(t);
      clearInterval(relogio);
    };
  }, [token, receber]);

  async function enviar(body: Record<string, unknown>) {
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`/api/ao-vivo/regie/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? `Erro ${r.status}`);
      receber(j as EstadoRegie);
    } catch (x) {
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setOcupado(false);
    }
  }

  const s = e.sessao;
  const decorrido = s ? (agora + offset.current - new Date(s.iniciada_em).getTime()) / 1000 : 0;

  return (
    <main className="min-h-screen bg-[#0b0b0b] text-white px-4 py-5 max-w-xl mx-auto">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white/40 text-xs uppercase tracking-widest">Régie · inserções</p>
          <h1 className="text-xl font-bold flex items-center gap-2 truncate">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: e.quadro.cor }} />
            {e.quadro.nome}
          </h1>
          {s && (s.titulo || s.modalidade) && (
            <p className="text-white/50 text-sm truncate">{[s.titulo, s.modalidade].filter(Boolean).join(" · ")}</p>
          )}
        </div>
        {s && (
          <div className="text-right shrink-0">
            <Selo s={s} />
            <p className="text-2xl font-mono font-bold tabular-nums mt-1">{mmss(decorrido)}</p>
            <p className="text-white/40 text-xs">de {s.duracao_prevista_min} min</p>
          </div>
        )}
      </header>

      {erro && <p className="mt-4 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg p-3">{erro}</p>}

      {s ? (
        <NoAr e={e} decorrido={decorrido} agora={agora + offset.current} ocupado={ocupado} enviar={enviar} />
      ) : (
        <Comecar e={e} ocupado={ocupado} enviar={enviar} />
      )}
    </main>
  );
}

function Selo({ s }: { s: NonNullable<EstadoRegie["sessao"]> }) {
  if (s.segurando)
    return <span className="text-xs font-bold px-2 py-1 rounded bg-yellow-400/15 text-yellow-300 border border-yellow-400/40">SEGURANDO</span>;
  if (s.status === "encerramento")
    return <span className="text-xs font-bold px-2 py-1 rounded bg-sky-400/15 text-sky-300 border border-sky-400/40">ENCERRAMENTO</span>;
  return (
    <span className="text-xs font-bold px-2 py-1 rounded bg-red-500/15 text-red-300 border border-red-500/40 inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> AO VIVO
    </span>
  );
}

function NoAr({
  e,
  decorrido,
  agora,
  ocupado,
  enviar,
}: {
  e: EstadoRegie;
  decorrido: number;
  agora: number;
  ocupado: boolean;
  enviar: (b: Record<string, unknown>) => Promise<void>;
}) {
  const s = e.sessao!;
  const noAr = e.fila.filter((i) => i.status === "no_ar");
  const fila = e.fila
    .filter((i) => i.status === "pendente")
    .sort((a, b) => (a.previsto_s ?? Infinity) - (b.previsto_s ?? Infinity));
  const feitas = e.fila.filter((i) => i.status !== "pendente" && i.status !== "no_ar");

  // Por parceiro: quantas já foram ao ar do total planejado.
  const resumo = new Map<string, { feitas: number; total: number }>();
  for (const i of e.fila) {
    const r = resumo.get(i.parceiro) ?? { feitas: 0, total: 0 };
    r.total++;
    if (i.status === "exibida" || i.status === "no_ar") r.feitas++;
    resumo.set(i.parceiro, r);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <button
          disabled={ocupado}
          onClick={() => enviar({ acao: "segurar", valor: !s.segurando })}
          className={`${btn} ${s.segurando ? "bg-emerald-500 text-black" : "bg-yellow-400 text-black"}`}
        >
          {s.segurando ? "Soltar a fila" : "Segurar a fila"}
        </button>
        {s.status === "no_ar" ? (
          <button disabled={ocupado} onClick={() => enviar({ acao: "encerramento" })} className={`${btn} bg-sky-500/20 text-sky-200 border border-sky-500/40`}>
            Encerramento
          </button>
        ) : (
          <button
            disabled={ocupado}
            onClick={() => confirm("Encerrar a live? O que estiver na fila fica como “não entrou”.") && enviar({ acao: "encerrar" })}
            className={`${btn} bg-red-600 text-white`}
          >
            Encerrar live
          </button>
        )}
      </div>
      {s.status === "no_ar" && (
        <button
          disabled={ocupado}
          onClick={() => confirm("Encerrar a live agora, sem as inserções do encerramento?") && enviar({ acao: "encerrar" })}
          className="mt-2 text-xs text-white/40 underline min-h-[44px]"
        >
          Encerrar direto
        </button>
      )}

      <h2 className="mt-5 text-xs uppercase tracking-widest text-white/40">No ar</h2>
      {noAr.length === 0 ? (
        <p className="mt-2 text-white/40 text-sm">Nada no ar agora.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {noAr.map((i) => {
            const passou = i.inicio_em ? (agora - new Date(i.inicio_em).getTime()) / 1000 : 0;
            const pct = i.duracao_s ? Math.min(100, (passou / i.duracao_s) * 100) : 100;
            return (
              <li key={i.id} className="rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate">{i.parceiro}</p>
                    <p className="text-xs text-white/60">
                      {TIPOS[i.tipo].label} · {i.duracao_s ? `faltam ${mmss(i.duracao_s - passou)}` : "o episódio todo"}
                    </p>
                  </div>
                  <button disabled={ocupado} onClick={() => enviar({ acao: "tirar", id: i.id })} className={`${btn} bg-white/10 border border-white/20 shrink-0`}>
                    Tirar
                  </button>
                </div>
                {i.duracao_s > 0 && (
                  <div className="mt-2 h-1 rounded bg-white/10 overflow-hidden">
                    <div className="h-full bg-red-400" style={{ width: `${pct}%` }} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mt-6 text-xs uppercase tracking-widest text-white/40">Próximas ({fila.length})</h2>
      {fila.length === 0 ? (
        <p className="mt-2 text-white/40 text-sm">Fila vazia.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {fila.map((i) => (
            <Proxima key={i.id} i={i} decorrido={decorrido} segurando={s.segurando} ocupado={ocupado} enviar={enviar} />
          ))}
        </ul>
      )}

      <h2 className="mt-6 text-xs uppercase tracking-widest text-white/40">Por parceiro</h2>
      <ul className="mt-2 grid grid-cols-2 gap-2">
        {Array.from(resumo.entries()).map(([p, r]) => (
          <li key={p} className="rounded-lg bg-white/5 px-3 py-2 text-sm flex justify-between gap-2">
            <span className="truncate">{p}</span>
            <span className="tabular-nums text-white/60">
              {r.feitas}/{r.total}
            </span>
          </li>
        ))}
      </ul>

      {feitas.length > 0 && (
        <details className="mt-6">
          <summary className="text-xs uppercase tracking-widest text-white/40 min-h-[44px] flex items-center cursor-pointer">
            Já saíram ({feitas.length})
          </summary>
          <ul className="space-y-1 text-sm">
            {feitas
              .sort((a, b) => (b.inicio_em ?? "").localeCompare(a.inicio_em ?? ""))
              .map((i) => (
                <li key={i.id} className="flex justify-between gap-2 text-white/60">
                  <span className="truncate">
                    {i.parceiro} · {TIPOS[i.tipo].label}
                  </span>
                  <span className="shrink-0">{STATUS_INSERCAO[i.status]}</span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </>
  );
}

function Proxima({
  i,
  decorrido,
  segurando,
  ocupado,
  enviar,
}: {
  i: ItemFila;
  decorrido: number;
  segurando: boolean;
  ocupado: boolean;
  enviar: (b: Record<string, unknown>) => Promise<void>;
}) {
  const quando =
    i.previsto_s === null
      ? "no encerramento"
      : i.disparo === "manual"
        ? "entra em seguida"
        : i.previsto_s <= decorrido
          ? segurando
            ? "segurada"
            : "na vez"
          : `em ${mmss(i.previsto_s - decorrido)}`;
  return (
    <li className="rounded-xl border border-white/10 bg-white/[.03] p-3 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="font-bold truncate">{i.parceiro}</p>
        <p className="text-xs text-white/55">
          {TIPOS[i.tipo].label} · {i.duracao_s ? `${i.duracao_s}s` : "episódio todo"} · {i.momento === "durante" ? quando : `${MOMENTOS[i.momento].toLowerCase()} · ${quando}`}
        </p>
      </div>
      <button disabled={ocupado} onClick={() => enviar({ acao: "agora", id: i.id })} className={`${btn} bg-gold-500 text-black px-3`}>
        Agora
      </button>
      <button disabled={ocupado} onClick={() => enviar({ acao: "pular", id: i.id })} className={`${btn} bg-white/10 px-3`}>
        Pular
      </button>
    </li>
  );
}

function Comecar({
  e,
  ocupado,
  enviar,
}: {
  e: EstadoRegie;
  ocupado: boolean;
  enviar: (b: Record<string, unknown>) => Promise<void>;
}) {
  const [episodio, setEpisodio] = useState(e.episodios[0]?.id ?? "");
  const [modalidade, setModalidade] = useState("");
  const [duracao, setDuracao] = useState(String(e.episodios[0]?.duracao_min ?? 60));
  const ep = e.episodios.find((x) => x.id === episodio);
  const previa = e.previa[modalidade] ?? { parceiros: 0, insercoes: 0 };
  const campo = "w-full min-h-[44px] bg-[#141414] border border-[#2a2a2a] rounded-xl px-3 text-base text-white";

  return (
    <section className="mt-6 space-y-4">
      <p className="text-white/60 text-sm">Nenhuma live deste quadro no ar. Comece quando entrar no ar: a fila dos patrocinadores roda pelo relógio.</p>

      <label className="block">
        <span className="text-xs text-white/50">Episódio</span>
        <select
          value={episodio}
          onChange={(x) => {
            setEpisodio(x.target.value);
            const d = e.episodios.find((y) => y.id === x.target.value)?.duracao_min;
            if (d) setDuracao(String(d));
          }}
          className={campo}
        >
          {e.episodios.map((x) => (
            <option key={x.id} value={x.id}>
              {new Date(x.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} · {x.titulo}
            </option>
          ))}
          <option value="">Sem episódio da agenda</option>
        </select>
      </label>

      {e.quadro.modalidades.length > 0 && (
        <label className="block">
          <span className="text-xs text-white/50">Modalidade</span>
          <select value={modalidade} onChange={(x) => setModalidade(x.target.value)} className={campo}>
            <option value="">Nenhuma (só cotas do quadro inteiro)</option>
            {e.quadro.modalidades.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="text-xs text-white/50">Duração prevista (min)</span>
        <input type="number" inputMode="numeric" min={10} max={360} value={duracao} onChange={(x) => setDuracao(x.target.value)} className={campo} />
      </label>

      <p className="text-sm text-white/60">
        {previa.parceiros
          ? `${previa.parceiros} ${previa.parceiros === 1 ? "parceiro" : "parceiros"} · ~${previa.insercoes} inserções numa live de 60 min.`
          : "Nenhuma cota ativa para este quadro hoje: a tela fica vazia."}
      </p>

      <button
        disabled={ocupado}
        onClick={() =>
          enviar({
            acao: "iniciar",
            episodio_id: episodio || null,
            modalidade: modalidade || null,
            duracao_min: Number(duracao) || 60,
            titulo: ep?.titulo ?? null,
          })
        }
        className={`${btn} w-full bg-red-600 text-white text-base`}
      >
        {ocupado ? "Começando..." : "Começar a live"}
      </button>
    </section>
  );
}
