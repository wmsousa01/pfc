"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Diferenca from "@/components/agenda/Diferenca";
import { CAMPOS, type Campo } from "@/lib/agenda/campos";
import type { Materia } from "@/lib/agenda/store";

type Sug = {
  id: string;
  materia: string;
  campo: Campo;
  original: string | null;
  proposta: string | null;
  comentario: string | null;
  autor: string;
  status: "aberta" | "aceita" | "recusada";
  created_at: string;
};

const NOME_KEY = "pfc-revisao-nome";
/** As partes, na ordem do documento do apresentador. */
const ORDEM: Exclude<Campo, "geral">[] = ["manchete", "leitura", "comentario", "humor", "reflexao", "pontos", "servico"];

const STATUS = {
  aberta: { label: "aguardando a produção", cls: "bg-gold-500/15 text-gold-300" },
  aceita: { label: "aceita", cls: "bg-emerald-500/15 text-emerald-300" },
  recusada: { label: "recusada", cls: "bg-white/5 text-white/40" },
} as const;

const valor = (m: Materia, c: Exclude<Campo, "geral">) => (c === "pontos" ? (m.pontos.length ? m.pontos.join("\n") : null) : m[c]);

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Pensada para o celular (o apresentador revisa no telefone): campo com 16 px, porque
// abaixo disso o Safari do iPhone dá zoom ao tocar, e botão com 44 px de altura para o dedo.
const input = "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-base text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const botaoParte = "min-h-[44px] px-3 rounded-lg border border-gold-500/30 text-xs font-bold text-gold-300 active:bg-gold-500/10 sm:min-h-0 sm:py-1 sm:border-transparent sm:font-normal sm:hover:text-gold-200";

/**
 * O roteiro para o apresentador, os comentaristas e a régie lerem antes do
 * programa: em cada parte de cada matéria dá para sugerir uma edição (o
 * texto vem pronto para mexer) e, na matéria inteira, deixar um comentário
 * ("cortar", "trocar de ordem"). A produção aceita ou recusa no admin; a
 * página se atualiza sozinha para todo mundo ver o que já foi decidido.
 */
export default function RoteiroRevisao({
  token,
  quadro,
  quando: data,
  equipe,
  materias,
  sugestoes,
}: {
  token: string;
  quadro: string;
  quando: string;
  equipe: string[];
  materias: Materia[];
  sugestoes: Sug[];
}) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  // Uma edição aberta por vez: "<índice da matéria>:<campo>".
  const [aberto, setAberto] = useState<string | null>(null);
  const [proposta, setProposta] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    try {
      setNome(localStorage.getItem(NOME_KEY) ?? "");
    } catch {
      // Sem armazenamento (aba anônima): a pessoa digita o nome de novo.
    }
  }, []);

  // As decisões da produção e as sugestões dos outros aparecem sem recarregar, menos com uma edição aberta.
  useEffect(() => {
    if (aberto) return;
    const t = setInterval(() => !document.hidden && router.refresh(), 20_000);
    return () => clearInterval(t);
  }, [aberto, router]);

  function salvarNome(v: string) {
    setNome(v);
    try {
      localStorage.setItem(NOME_KEY, v);
    } catch {
      // idem
    }
  }

  function abrir(chave: string, texto: string | null) {
    setAberto(chave);
    setProposta(texto ?? "");
    setComentario("");
    setErro(null);
    setAviso(null);
  }

  async function enviar(m: Materia, campo: Campo) {
    if (!nome.trim()) {
      setErro("Escreva seu nome lá em cima antes de enviar.");
      return;
    }
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/roteiro/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materia: m.titulo, campo, proposta: campo === "geral" ? null : proposta, comentario, autor: nome }),
      });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? String(r.status));
      setAberto(null);
      setAviso("Enviada para a produção.");
      router.refresh();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
    }
  }

  const abertas = sugestoes.filter((s) => s.status === "aberta").length;

  // Funções de render, não componentes: um componente declarado aqui dentro remontaria a caixa a cada letra.
  const editor = (m: Materia, campo: Campo) => {
    return (
      <div className="mt-3 -mx-1 rounded-xl border border-gold-500/30 bg-gold-500/5 p-3 space-y-3 sm:mx-0">
        {campo !== "geral" && (
          <textarea value={proposta} onChange={(e) => setProposta(e.target.value)} rows={Math.min(14, Math.max(3, proposta.split("\n").length + 2))} className={`${input} w-full leading-relaxed`} />
        )}
        <input
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          placeholder={campo === "geral" ? "Seu comentário sobre a matéria (cortar, trocar de ordem, confirmar dado...)" : "Por que mudar? (opcional)"}
          className={`${input} w-full`}
        />
        {campo !== "geral" && proposta.trim() !== (valor(m, campo) ?? "").trim() && (
          <div className="text-sm text-white/70 border-t border-white/10 pt-2">
            <p className="text-[11px] font-black tracking-widest text-white/35 mb-1">COMO FICA</p>
            <Diferenca antes={valor(m, campo) ?? ""} depois={proposta} />
          </div>
        )}
        {erro && <p className="text-red-400 text-xs">{erro}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button onClick={() => setAberto(null)} className="min-h-[44px] rounded-lg text-sm text-white/60 hover:text-white px-3 sm:min-h-0 sm:py-2">cancelar</button>
          <button onClick={() => enviar(m, campo)} disabled={enviando} className="btn-primary min-h-[44px] w-full px-4 rounded-lg text-sm font-bold disabled:opacity-50 sm:w-auto sm:min-h-0 sm:py-2">
            {enviando ? "Enviando..." : campo === "geral" ? "Enviar comentário" : "Enviar sugestão"}
          </button>
        </div>
      </div>
    );
  };

  const lista = (m: Materia, campo: Campo) => {
    const daParte = sugestoes.filter((s) => s.materia === m.titulo && s.campo === campo);
    if (daParte.length === 0) return null;
    return (
      <div className="mt-2 space-y-2">
        {daParte.map((s) => (
          <div key={s.id} className={`rounded-xl border p-3 text-sm ${s.status === "recusada" ? "border-white/5 opacity-60" : "border-white/10 bg-white/[0.02]"}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <strong className="text-white">{s.autor}</strong>
              <span className="text-white/35">{quando(s.created_at)}</span>
              <span className={`px-1.5 py-0.5 rounded font-bold ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
            </div>
            {s.proposta !== null && <Diferenca antes={s.original ?? ""} depois={s.proposta} className="mt-2 text-white/80" />}
            {s.comentario && <p className="mt-1 text-white/60 italic">“{s.comentario}”</p>}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#222]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black tracking-widest text-gold-400">ROTEIRO PARA REVISÃO · {quadro.toUpperCase()}</p>
            <p className="text-sm text-white/60 capitalize truncate">{data}</p>
          </div>
          <input value={nome} onChange={(e) => salvarNome(e.target.value)} placeholder="Seu nome (aparece na sugestão)" maxLength={60} autoComplete="name" className={`${input} w-full sm:w-56`} />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4 sm:py-6 sm:space-y-5">
        <div className="text-sm text-white/55 space-y-1">
          <p>
            Leia o roteiro e use <strong className="text-white/80">sugerir edição</strong> em qualquer parte: o texto vem pronto para
            você mudar. Para a matéria inteira (cortar, trocar de ordem, confirmar um dado), use{" "}
            <strong className="text-white/80">comentar a matéria</strong>. A produção aceita ou recusa, e o que for aceito entra
            no roteiro e no espelho da transmissão.
          </p>
          {equipe.length > 0 && <p>Apresentação: {equipe.join(", ")}.</p>}
          <p>
            {abertas > 0 ? `${abertas} ${abertas === 1 ? "sugestão aguardando" : "sugestões aguardando"} a produção.` : "Nenhuma sugestão aguardando."}
            {aviso && <span className="text-emerald-400 ml-2">{aviso}</span>}
          </p>
        </div>

        {materias.length === 0 && (
          <div className="rounded-2xl border border-[#222] bg-[#111] p-8 text-center text-white/50">
            O roteiro ainda não foi gerado. Assim que a produção gerar, ele aparece aqui.
          </div>
        )}

        {materias.map((m, i) => {
          const grupo = m.bloco && m.bloco !== materias[i - 1]?.bloco ? m.bloco : null;
          const partes = ORDEM.filter((c) => valor(m, c) || (m.tipo === "materia" && (c === "humor" || c === "servico")) || (m.tipo !== "materia" && c === "leitura"));
          return (
            <div key={i}>
              {grupo && <p className="mt-8 mb-3 text-xs font-black tracking-widest text-gold-400 uppercase">{grupo}</p>}
              <section className="rounded-2xl border border-[#222] bg-[#111] p-4 sm:p-6">
                <h2 className="text-lg font-bold leading-snug sm:text-xl">
                  <span className="font-mono text-base text-white/40 mr-3">{i + 1}</span>
                  {m.titulo}
                </h2>
                {partes.map((c) => {
                  const chave = `${i}:${c}`;
                  const v = valor(m, c);
                  return (
                    <div key={c} className="mt-4 group">
                      <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <p className="text-[11px] font-black tracking-widest text-white/35">{CAMPOS[c].toUpperCase()}</p>
                        {aberto !== chave && (
                          <button onClick={() => abrir(chave, v)} className={botaoParte}>
                            {v ? "sugerir edição" : "sugerir texto"}
                          </button>
                        )}
                      </div>
                      {v ? (
                        c === "pontos" ? (
                          <ul className="mt-1 space-y-1.5 text-[17px] sm:text-base text-white/85">
                            {m.pontos.map((p, k) => (
                              <li key={k} className="flex gap-2">
                                <span className="text-gold-400">•</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className={`mt-1 whitespace-pre-line leading-relaxed text-[17px] sm:text-base ${c === "manchete" ? "font-bold uppercase" : c === "leitura" ? "text-white/90" : "text-white/75"}`}>{v}</p>
                        )
                      ) : (
                        <p className="mt-1 text-white/25 text-sm">(vazio)</p>
                      )}
                      {aberto === chave && editor(m, c)}
                      {lista(m, c)}
                    </div>
                  );
                })}
                <div className="mt-5 border-t border-white/5 pt-3">
                  {aberto === `${i}:geral` ? (
                    editor(m, "geral")
                  ) : (
                    <button onClick={() => abrir(`${i}:geral`, null)} className="min-h-[44px] w-full rounded-lg border border-white/10 text-sm text-white/70 active:bg-white/5 sm:w-auto sm:min-h-0 sm:border-0 sm:text-xs sm:text-white/50 sm:hover:text-white">+ comentar a matéria</button>
                  )}
                  {lista(m, "geral")}
                </div>
              </section>
            </div>
          );
        })}
      </main>
    </div>
  );
}
