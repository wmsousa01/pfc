"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CopyButton from "@/components/CopyButton";

type Noticia = { titulo: string; resumo: string; fontes: { handle: string; url: string; data: string }[] };
type Materia = {
  tipo: "abertura" | "materia" | "encerramento";
  bloco: string | null;
  titulo: string;
  manchete: string | null;
  leitura: string | null;
  comentario: string | null;
  humor: string | null;
  reflexao: string | null;
  pontos: string[];
  servico: string | null;
};
type Bloco = { titulo: string; texto: string | null; pontos: string[]; noticias: Noticia[]; materia: Materia | null };

/** Uma parte da matéria do apresentador, com o rótulo que ele usa no documento. */
function Parte({ rotulo, className = "", children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`mt-4 ${className}`}>
      <p className="text-[11px] font-black tracking-widest text-white/35">{rotulo}</p>
      <div className="mt-1 whitespace-pre-line leading-relaxed">{children}</div>
    </div>
  );
}
type Imagem = { id: string; nome: string; mime: string; bloco: number };

const POLL_MS = 3000;

/**
 * A tela do espelho na régie: todos os blocos em sequência, o que está no ar
 * em destaque, e as imagens de cada bloco com link fixo (abrir, baixar ou
 * colar no OBS/vMix). O bloco no ar vem do servidor a cada 3 s; quando o
 * roteiro ou as imagens mudam, a página recarrega sozinha. Nas imagens do
 * bloco no ar a régie escolhe o que vai para a tela do OBS (/tela).
 */
export default function EspelhoAoVivo({
  token,
  quadro,
  quando,
  tema,
  equipe,
  cuidados,
  blocos,
  imagens,
  atual: atualInicial,
  naTela,
  rev,
}: {
  token: string;
  quadro: string;
  quando: string;
  tema: string | null;
  equipe: { nome: string; papel: string }[];
  cuidados: string | null;
  blocos: Bloco[];
  imagens: Imagem[];
  atual: number | null;
  /** A imagem que a tela do OBS mostra agora. */
  naTela: string | null;
  rev: string;
}) {
  const router = useRouter();
  const [atual, setAtual] = useState(atualInicial);
  const [tela, setTela] = useState(naTela);
  const [seguir, setSeguir] = useState(true);
  const [online, setOnline] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const enviando = useRef(false);
  const refs = useRef<(HTMLElement | null)[]>([]);
  const api = `/api/espelho/${token}`;
  const img = (id: string) => `/espelho/${token}/img/${id}`;
  const abs = (path: string) => (typeof window === "undefined" ? path : `${window.location.origin}${path}`);

  // Relógio da régie.
  useEffect(() => {
    const tick = () => setHora(new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Segue o bloco no ar e recarrega quando a produção muda o roteiro.
  useEffect(() => {
    let vivo = true;
    async function poll() {
      if (document.hidden || enviando.current) return;
      try {
        const r = await fetch(api, { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { atual: number | null; tela: { id: string } | null; rev: string };
        if (!vivo || enviando.current) return;
        setOnline(true);
        setAtual(j.atual);
        setTela(j.tela?.id ?? null);
        if (j.rev !== rev) router.refresh();
      } catch {
        if (vivo) setOnline(false);
      }
    }
    const t = setInterval(poll, POLL_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [api, rev, router]);

  useEffect(() => {
    if (seguir && atual != null) refs.current[atual]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [atual, seguir]);

  const primeira = useCallback((b: number | null) => (b == null ? null : imagens.find((m) => m.bloco === b)?.id ?? null), [imagens]);

  /** Manda a mudança e, se falhar, volta a tela ao estado de antes. */
  const enviar = useCallback(
    async (body: object, desfazer: () => void, oque: string) => {
      setErro(null);
      enviando.current = true;
      try {
        const r = await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j.error ?? String(r.status));
      } catch (e) {
        desfazer();
        setErro(`Não deu para ${oque}: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        enviando.current = false;
      }
    },
    [api]
  );

  // Bloco novo: a tela do OBS passa para a primeira imagem dele.
  const mover = useCallback(
    (v: number | null) => {
      const antes = { atual, tela };
      setAtual(v);
      setTela(primeira(v));
      return enviar({ atual: v }, () => (setAtual(antes.atual), setTela(antes.tela)), "mudar o bloco");
    },
    [atual, tela, primeira, enviar]
  );

  /** id da imagem, "nenhuma" (tela vazia) ou null (a primeira do bloco). */
  const escolher = useCallback(
    (imagem: string | null) => {
      const antes = tela;
      setTela(imagem === "nenhuma" ? null : imagem ?? primeira(atual));
      return enviar({ imagem }, () => setTela(antes), "trocar a imagem da tela");
    },
    [tela, atual, primeira, enviar]
  );

  const ultimo = blocos.length - 1;
  const anterior = () => mover(atual == null ? 0 : Math.max(0, atual - 1));
  const proximo = () => mover(atual == null ? 0 : Math.min(ultimo, atual + 1));

  // PageDown/PageUp: o passador de slides que o âncora já usa manda essas teclas.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, select")) return;
      if (e.key === "PageDown" || (e.altKey && e.key === "ArrowDown")) {
        e.preventDefault();
        proximo();
      } else if (e.key === "PageUp" || (e.altKey && e.key === "ArrowUp")) {
        e.preventDefault();
        anterior();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Perfil do Instagram leva "@"; site ("mogimirim.sp.gov.br") vai como está.
  const fontes = (n: Noticia) => Array.from(new Set(n.fontes.map((f) => (f.handle.includes(".") ? f.handle : `@${f.handle}`)))).join(" · ");
  const btn = "border border-[#333] hover:border-gold-500/60 text-white/80 hover:text-white rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-30";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ---- Barra da régie ---- */}
      <header className="sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#222]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black tracking-widest text-gold-400">ESPELHO · {quadro.toUpperCase()}</p>
            <p className="text-sm text-white/60 truncate capitalize">
              {quando}
              {tema && <span className="normal-case"> · {tema}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className={`inline-block w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-red-500 animate-pulse"}`} title={online ? "Sincronizado" : "Sem conexão"} />
            <span className="font-mono tabular-nums text-white/70">{hora}</span>
            <CopyButton value={abs(`/espelho/${token}/tela`)} label="link da tela (OBS)" className="text-xs text-white/40 hover:text-white ml-2" />
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-black px-2 py-1 rounded ${atual != null ? "bg-red-600 text-white" : "bg-white/10 text-white/50"}`}>
              {atual != null ? `NO AR ${atual + 1}/${blocos.length}` : "ANTES DO AR"}
            </span>
            <button onClick={anterior} disabled={!blocos.length || atual === 0 || atual == null} className={btn} title="PageUp">◀ Anterior</button>
            <button onClick={proximo} disabled={!blocos.length || atual === ultimo} className={`${btn} !border-gold-500/50 !text-gold-300`} title="PageDown">
              {atual == null ? "Começar ▶" : "Próximo ▶"}
            </button>
          </div>
        </div>
        {erro && <p className="max-w-6xl mx-auto px-4 pb-2 text-red-400 text-xs">{erro}</p>}
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid lg:grid-cols-[14rem_1fr] gap-6">
        {/* ---- Índice ---- */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1">
            {blocos.map((b, i) => (
              <button
                key={i}
                onClick={() => refs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className={`w-full text-left text-sm rounded-lg px-3 py-2 border ${
                  i === atual ? "border-red-600 bg-red-600/15 text-white" : atual != null && i < atual ? "border-transparent text-white/30" : "border-transparent text-white/70 hover:bg-white/5"
                }`}
              >
                <span className="font-mono text-xs mr-2">{i + 1}</span>
                {b.titulo}
              </button>
            ))}
            <label className="flex items-center gap-2 text-xs text-white/50 px-3 pt-3">
              <input type="checkbox" checked={seguir} onChange={(e) => setSeguir(e.target.checked)} /> rolar até o bloco no ar
            </label>
            {atual != null && (
              <button onClick={() => mover(null)} className="text-xs text-white/30 hover:text-red-400 px-3">voltar para antes do ar</button>
            )}
          </div>
        </nav>

        <main className="space-y-5 min-w-0">
          {equipe.length > 0 && (
            <p className="text-sm text-white/60">
              {equipe.map((p, i) => (
                <span key={i} className="mr-4">
                  <strong className="text-white">{p.nome}</strong> <span className="text-white/40 text-xs uppercase">{p.papel}</span>
                </span>
              ))}
            </p>
          )}
          {cuidados && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <strong className="text-red-300">Atenção no ar:</strong> {cuidados}
            </div>
          )}
          {blocos.length === 0 && (
            <div className="rounded-2xl border border-[#222] bg-[#111] p-8 text-center text-white/50">
              O roteiro ainda não foi gerado. Assim que a produção gerar, ele aparece aqui sozinho.
            </div>
          )}

          {blocos.map((b, i) => {
            const fotos = imagens.filter((m) => m.bloco === i);
            const noAr = i === atual;
            const feito = atual != null && i < atual;
            const m = b.materia;
            // Rótulo do bloco do apresentador ("BLOCO 3 — Saúde") quando muda de um bloco para o outro.
            const grupo = m?.bloco && m.bloco !== blocos[i - 1]?.materia?.bloco ? m.bloco : null;
            return (
              <div key={i}>
              {grupo && <p className="mt-8 mb-3 text-xs font-black tracking-widest text-gold-400 uppercase">{grupo}</p>}
              <section
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                className={`scroll-mt-24 rounded-2xl border p-5 sm:p-6 transition-colors ${
                  noAr ? "border-red-600 bg-red-950/30 ring-1 ring-red-600/40" : feito ? "border-[#1c1c1c] bg-[#0d0d0d] opacity-60" : "border-[#222] bg-[#111]"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h2 className="text-xl sm:text-2xl font-bold">
                    <span className="font-mono text-base text-white/40 mr-3">{i + 1}</span>
                    {b.titulo}
                  </h2>
                  <div className="flex items-center gap-2">
                    {noAr && <span className="text-xs font-black px-2 py-1 rounded bg-red-600 animate-pulse">NO AR</span>}
                    {atual != null && i === atual + 1 && <span className="text-xs font-black px-2 py-1 rounded bg-gold-500/20 text-gold-300">PRÓXIMO</span>}
                    {!noAr && <button onClick={() => mover(i)} className="text-xs border border-[#333] hover:border-red-500/60 text-white/60 hover:text-white rounded-lg px-2.5 py-1">pôr no ar</button>}
                  </div>
                </div>

                {m && (
                  <>
                    {m.manchete && (
                      <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-black/40 p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="text-[11px] font-black text-white/40">GC</span>
                        <span className="font-bold uppercase">{m.manchete}</span>
                        <CopyButton value={m.manchete.toUpperCase()} label="copiar" className="text-xs text-white/50 hover:text-white" />
                        {b.noticias.some((n) => n.fontes.length) && (
                          <>
                            <span className="text-white/60">Fonte: {Array.from(new Set(b.noticias.map(fontes))).join(" · ")}</span>
                            <CopyButton value={`Fonte: ${Array.from(new Set(b.noticias.map(fontes))).join(" · ")}`} label="copiar" className="text-xs text-white/50 hover:text-white" />
                            <span className="flex gap-2">
                              {b.noticias.flatMap((n) => n.fontes).map((f) => (
                                <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="text-xs text-gold-400 hover:underline">post ↗</a>
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {m.leitura && (
                      <Parte rotulo={m.tipo === "materia" ? "NOTÍCIA PARA LEITURA" : "APRESENTADOR"} className="text-lg text-white/90">
                        {m.leitura}
                      </Parte>
                    )}
                    {m.comentario && <Parte rotulo="COMENTÁRIO DO APRESENTADOR" className="text-base text-white/75">{m.comentario}</Parte>}
                    {m.humor && (
                      <div className="mt-4 rounded-xl border border-gold-500/30 bg-gold-500/10 p-3 text-base text-gold-100 whitespace-pre-line">
                        <span className="text-[11px] font-black text-gold-400 mr-2">H</span>
                        {m.humor}
                      </div>
                    )}
                    {(m.reflexao || m.pontos.length > 0) && (
                      <Parte rotulo="PERGUNTA PARA REFLEXÃO" className="text-base text-white/85">
                        {m.reflexao && <p className="font-bold text-white">{m.reflexao}</p>}
                        {m.pontos.length > 0 && (
                          <ul className="mt-2 space-y-1 whitespace-normal">
                            {m.pontos.map((p, j) => (
                              <li key={j} className="flex gap-2">
                                <span className="text-gold-400">•</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Parte>
                    )}
                    {m.servico && (
                      <Parte rotulo="SERVIÇO AO TELESPECTADOR" className="text-base text-sky-200">
                        {m.servico}
                      </Parte>
                    )}
                  </>
                )}
                {b.texto && <p className="mt-3 text-lg leading-relaxed text-white/85 whitespace-pre-line">{b.texto}</p>}
                {!m && b.noticias.map((n, k) => (
                  <div key={k} className="mt-4">
                    {b.noticias.length > 1 && <p className="text-base font-bold text-white/90">{n.titulo}</p>}
                    <p className="text-base leading-relaxed text-white/70">{n.resumo}</p>
                    <div className="mt-2 rounded-xl border border-[#2a2a2a] bg-black/40 p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                      <span className="text-[11px] font-black text-white/40">GC</span>
                      <span className="font-bold uppercase">{n.titulo}</span>
                      <CopyButton value={n.titulo.toUpperCase()} label="copiar" className="text-xs text-white/50 hover:text-white" />
                      {n.fontes.length > 0 && (
                        <>
                          <span className="text-white/60">Fonte: {fontes(n)}</span>
                          <CopyButton value={`Fonte: ${fontes(n)}`} label="copiar" className="text-xs text-white/50 hover:text-white" />
                          <span className="flex gap-2">
                            {n.fontes.map((f) => (
                              <a key={f.url} href={f.url} target="_blank" rel="noreferrer" className="text-xs text-gold-400 hover:underline">post ↗</a>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {b.pontos.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-lg text-white/90">
                    {b.pontos.map((p, j) => (
                      <li key={j} className="flex gap-2">
                        <span className="text-gold-400">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {noAr && fotos.length > 0 && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-black text-white/40">TELA OBS</span>
                    {tela ? (
                      <button onClick={() => escolher("nenhuma")} className="border border-[#333] hover:border-red-500/60 text-white/70 hover:text-white rounded-lg px-2.5 py-1">tirar da tela</button>
                    ) : (
                      <>
                        <span className="text-white/50">vazia</span>
                        <button onClick={() => escolher(null)} className="border border-[#333] hover:border-sky-500/60 text-white/70 hover:text-white rounded-lg px-2.5 py-1">mostrar de novo</button>
                      </>
                    )}
                  </div>
                )}
                {fotos.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-3">
                    {fotos.map((m) => (
                      <figure key={m.id} className={`relative rounded-lg border bg-black overflow-hidden ${noAr && m.id === tela ? "border-sky-400 ring-2 ring-sky-400/50" : "border-[#2a2a2a]"}`}>
                        {noAr &&
                          (m.id === tela ? (
                            <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500 text-black">NA TELA</span>
                          ) : (
                            <button onClick={() => escolher(m.id)} className="absolute top-1.5 left-1.5 z-10 text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/70 border border-white/20 hover:border-sky-400 text-white">pôr na tela</button>
                          ))}
                        <a href={img(m.id)} target="_blank" rel="noreferrer" title="Abrir em tamanho real">
                          {m.mime.startsWith("video/") ? (
                            <video src={img(m.id)} preload="metadata" muted className="w-full aspect-video object-contain bg-black" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={img(m.id)} alt={m.nome} loading="lazy" className="w-full aspect-video object-contain bg-black" />
                          )}
                        </a>
                        <figcaption className="flex items-center gap-3 px-2 py-1.5 text-[11px] text-white/50">
                          <span className="truncate flex-1" title={m.nome}>{m.nome}</span>
                          <a href={`${img(m.id)}?baixar=1`} className="hover:text-white">baixar</a>
                          <CopyButton value={abs(img(m.id))} label="link" className="hover:text-white" />
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </section>
              </div>
            );
          })}
        </main>
      </div>
    </div>
  );
}
