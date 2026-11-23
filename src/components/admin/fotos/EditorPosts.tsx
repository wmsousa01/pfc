"use client";

import { useEffect, useState, useTransition } from "react";
import { buscarNumerosAction, gerarPostAction } from "@/app/admin/fotos/actions";
import {
  LIMITE_ITENS,
  MODELOS_CARTAZ,
  PERIODOS,
  SLIDES_PADRAO,
  TAMANHOS,
  type FormatoPost,
  type NumerosPost,
  type PedidoPost,
  type PeriodoNumeros,
  type SlidesNumeros,
} from "@/lib/posts/tipos";
import type { QuadroFoto } from "./EditorFotos";

type Tipo = "numeros" | "cartaz" | "texto";

const TIPOS: { id: Tipo; label: string; dica: string }[] = [
  { id: "numeros", label: "Números do canal", dica: "Carrossel com os números do YouTube no período." },
  { id: "cartaz", label: "Data ou aviso", dica: "Uma arte: datas comemorativas, live, convidado, episódio novo." },
  { id: "texto", label: "Carrossel de texto", dica: "Capa e um slide por tópico: dicas, listas, bastidores." },
];

const ROTULOS_SLIDES: { chave: keyof SlidesNumeros; label: string }[] = [
  { chave: "capa", label: "Capa" },
  { chave: "views", label: "Views" },
  { chave: "horas", label: "Horas assistidas" },
  { chave: "inscritos", label: "Inscritos" },
  { chave: "top", label: "Mais vistos" },
  { chave: "fechamento", label: "Fechamento" },
];

const LEMBRAR_QUADRO = "pfc-fotos-quadro";

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="admin-label block mb-1">{label}</span>
      {children}
    </label>
  );
}

function Opcao({ ativa, onClick, children }: { ativa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={`min-h-9 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
        ativa ? "border-gold-500 bg-gold-500/10 text-gold-400" : "border-[#2a2a2a] text-white/65 hover:text-white hover:border-white/25"
      }`}
    >
      {children}
    </button>
  );
}

/** Reduz a foto no navegador: a action aceita até 6 MB e a arte não precisa de mais que isso. */
async function reduzirFoto(arquivo: File): Promise<string> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * escala);
  c.height = Math.round(bmp.height * escala);
  c.getContext("2d")?.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL("image/jpeg", 0.88);
}

const numeroOuVazio = (v: number | null) => (v == null ? "" : String(Math.round(v * 10) / 10));

export default function EditorPosts({ quadros }: { quadros: QuadroFoto[] }) {
  const [quadro, setQuadro] = useState(quadros[0]?.id ?? "");
  const [tipo, setTipo] = useState<Tipo>("numeros");
  const [gerando, iniciar] = useTransition();
  const [buscando, iniciarBusca] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [slides, setSlides] = useState<string[]>([]);

  // Números do canal
  const [periodo, setPeriodo] = useState<PeriodoNumeros>("semana");
  const [numeros, setNumeros] = useState<NumerosPost | null>(null);
  const [quais, setQuais] = useState<SlidesNumeros>(SLIDES_PADRAO);
  const [chamadaNumeros, setChamadaNumeros] = useState("Obrigado por assistir");

  // Cartaz
  const [modelo, setModelo] = useState(MODELOS_CARTAZ[0].id);
  const [formato, setFormato] = useState<FormatoPost>("4:5");
  const [chapeu, setChapeu] = useState(MODELOS_CARTAZ[0].chapeu);
  const [titulo, setTitulo] = useState(MODELOS_CARTAZ[0].titulo);
  const [mensagem, setMensagem] = useState(MODELOS_CARTAZ[0].mensagem);
  const [assinatura, setAssinatura] = useState("Equipe Fora da Caixa");
  const [foto, setFoto] = useState<string | null>(null);

  // Carrossel de texto
  const [tituloTexto, setTituloTexto] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [itens, setItens] = useState([{ titulo: "", texto: "" }]);
  const [chamadaTexto, setChamadaTexto] = useState("Salve para ler depois");

  useEffect(() => {
    try {
      const q = localStorage.getItem(LEMBRAR_QUADRO);
      if (q && quadros.some((x) => x.id === q)) setQuadro(q);
    } catch {
      // Sem armazenamento: fica o primeiro quadro.
    }
  }, [quadros]);

  function escolherQuadro(q: string) {
    setQuadro(q);
    try {
      localStorage.setItem(LEMBRAR_QUADRO, q);
    } catch {
      // Sem armazenamento: só não lembra na próxima visita.
    }
  }

  function aplicarModelo(id: string) {
    const m = MODELOS_CARTAZ.find((x) => x.id === id);
    if (!m) return;
    setModelo(id);
    setChapeu(m.chapeu);
    setTitulo(m.titulo);
    setMensagem(m.mensagem);
  }

  function buscar() {
    setErro(null);
    iniciarBusca(async () => {
      const r = await buscarNumerosAction(periodo);
      if (r.ok && r.numeros) setNumeros(r.numeros);
      else setErro(r.erro ?? "Não consegui ler os números.");
    });
  }

  function pedido(): PedidoPost | null {
    if (tipo === "numeros") return numeros ? { tipo, quadro, numeros, slides: quais, chamada: chamadaNumeros } : null;
    if (tipo === "texto") return { tipo, quadro, titulo: tituloTexto, subtitulo, itens, chamada: chamadaTexto };
    return { tipo, quadro, formato, chapeu, titulo, mensagem, assinatura, foto };
  }

  function gerar() {
    const p = pedido();
    if (!p) return setErro("Busque os números do canal antes de gerar.");
    setErro(null);
    iniciar(async () => {
      const r = await gerarPostAction(p);
      if (r.ok && r.slides) setSlides(r.slides);
      else setErro(r.erro ?? "Não consegui gerar o post.");
    });
  }

  function baixar(url: string, i: number) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `pfc-${tipo}-${String(i + 1).padStart(2, "0")}.jpg`;
    a.click();
  }

  async function baixarTodos() {
    for (let i = 0; i < slides.length; i++) {
      baixar(slides[i], i);
      // O navegador barra vários downloads no mesmo instante.
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  const editarNumero = (chave: keyof NumerosPost, valor: string) =>
    setNumeros((n) => (n ? { ...n, [chave]: valor === "" ? null : Number(valor) } : n));

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
      <div className="space-y-4">
        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
          <h2 className="text-white text-sm font-semibold">Quadro</h2>
          <p className="text-white/50 text-xs mt-0.5">A cor e o selo do post vêm do quadro.</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {quadros.map((q) => (
              <Opcao key={q.id} ativa={quadro === q.id} onClick={() => escolherQuadro(q.id)}>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: q.cor }} aria-hidden />
                  {q.nome}
                </span>
              </Opcao>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4 space-y-3">
          <div>
            <h2 className="text-white text-sm font-semibold">Tipo de post</h2>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {TIPOS.map((t) => (
                <Opcao
                  key={t.id}
                  ativa={tipo === t.id}
                  onClick={() => {
                    setTipo(t.id);
                    setSlides([]);
                    setErro(null);
                  }}
                >
                  {t.label}
                </Opcao>
              ))}
            </div>
            <p className="text-white/50 text-xs mt-2">{TIPOS.find((t) => t.id === tipo)?.dica}</p>
          </div>

          {tipo === "numeros" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {PERIODOS.map((p) => (
                  <Opcao key={p.id} ativa={periodo === p.id} onClick={() => setPeriodo(p.id)}>
                    {p.label}
                  </Opcao>
                ))}
              </div>
              <button
                type="button"
                onClick={buscar}
                disabled={buscando}
                className="w-full btn-outline rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              >
                {buscando ? "Lendo o YouTube…" : numeros ? "Buscar de novo" : "Buscar números do canal"}
              </button>
              {numeros && (
                <div className="space-y-2.5">
                  <p className="text-white/50 text-xs">Confira e ajuste antes de gerar. Variação vazia some da arte.</p>
                  <Campo label="Período (aparece na capa)">
                    <input className="admin-input" value={numeros.periodo} onChange={(e) => setNumeros({ ...numeros, periodo: e.target.value })} />
                  </Campo>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo label="Views">
                      <input className="admin-input" inputMode="numeric" value={numeroOuVazio(numeros.views)} onChange={(e) => editarNumero("views", e.target.value)} />
                    </Campo>
                    <Campo label="Variação views %">
                      <input className="admin-input" inputMode="decimal" value={numeroOuVazio(numeros.viewsVar)} onChange={(e) => editarNumero("viewsVar", e.target.value)} />
                    </Campo>
                    <Campo label="Horas assistidas">
                      <input className="admin-input" inputMode="numeric" value={numeroOuVazio(numeros.horas)} onChange={(e) => editarNumero("horas", e.target.value)} />
                    </Campo>
                    <Campo label="Variação horas %">
                      <input className="admin-input" inputMode="decimal" value={numeroOuVazio(numeros.horasVar)} onChange={(e) => editarNumero("horasVar", e.target.value)} />
                    </Campo>
                    <Campo label="Novos inscritos">
                      <input className="admin-input" inputMode="numeric" value={numeroOuVazio(numeros.novosInscritos)} onChange={(e) => editarNumero("novosInscritos", e.target.value)} />
                    </Campo>
                    <Campo label="Inscritos no total">
                      <input className="admin-input" inputMode="numeric" value={numeroOuVazio(numeros.inscritosTotal)} onChange={(e) => editarNumero("inscritosTotal", e.target.value)} />
                    </Campo>
                  </div>
                  {numeros.top.map((v, i) => (
                    <Campo key={i} label={`Mais visto ${i + 1}`}>
                      <input
                        className="admin-input"
                        value={v.titulo}
                        onChange={(e) => setNumeros({ ...numeros, top: numeros.top.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)) })}
                      />
                    </Campo>
                  ))}
                  <div>
                    <span className="admin-label block mb-1">Slides</span>
                    <div className="flex flex-wrap gap-1.5">
                      {ROTULOS_SLIDES.map((s) => (
                        <Opcao key={s.chave} ativa={quais[s.chave]} onClick={() => setQuais((q) => ({ ...q, [s.chave]: !q[s.chave] }))}>
                          {s.label}
                        </Opcao>
                      ))}
                    </div>
                  </div>
                  <Campo label="Frase do fechamento">
                    <input className="admin-input" value={chamadaNumeros} onChange={(e) => setChamadaNumeros(e.target.value)} />
                  </Campo>
                </div>
              )}
            </>
          )}

          {tipo === "cartaz" && (
            <div className="space-y-2.5">
              <Campo label="Modelo">
                <select className="admin-input" value={modelo} onChange={(e) => aplicarModelo(e.target.value)}>
                  {(["Datas", "Avisos"] as const).map((g) => (
                    <optgroup key={g} label={g}>
                      {MODELOS_CARTAZ.filter((m) => m.grupo === g).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </Campo>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TAMANHOS) as FormatoPost[]).map((f) => (
                  <Opcao key={f} ativa={formato === f} onClick={() => setFormato(f)}>
                    {TAMANHOS[f].label}
                  </Opcao>
                ))}
              </div>
              <Campo label="Chapéu (linha pequena acima do título)">
                <input className="admin-input" value={chapeu} onChange={(e) => setChapeu(e.target.value)} />
              </Campo>
              <Campo label="Título">
                <input className="admin-input" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </Campo>
              <Campo label="Mensagem">
                <textarea className="admin-input min-h-[88px]" value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
              </Campo>
              <Campo label="Assinatura">
                <input className="admin-input" value={assinatura} onChange={(e) => setAssinatura(e.target.value)} />
              </Campo>
              <div>
                <span className="admin-label block mb-1">Foto de fundo (opcional)</span>
                {foto ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={foto} alt="Foto escolhida" className="w-14 h-14 object-cover rounded-lg" />
                    <button type="button" onClick={() => setFoto(null)} className="text-xs text-white/65 hover:text-white">
                      Tirar foto
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="block w-full text-xs text-white/65 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        setFoto(await reduzirFoto(f));
                      } catch {
                        setErro("Não consegui abrir a foto. Use JPG, PNG ou WebP.");
                      }
                    }}
                  />
                )}
                <p className="text-white/45 text-xs mt-1">Dica: corrija a foto na aba Corrigir fotos antes.</p>
              </div>
            </div>
          )}

          {tipo === "texto" && (
            <div className="space-y-2.5">
              <Campo label="Título da capa">
                <input className="admin-input" value={tituloTexto} onChange={(e) => setTituloTexto(e.target.value)} placeholder="5 lições do episódio com..." />
              </Campo>
              <Campo label="Subtítulo">
                <input className="admin-input" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
              </Campo>
              {itens.map((item, i) => (
                <div key={i} className="rounded-lg border border-[#2a2a2a] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60 text-xs font-semibold">Slide {i + 2}</span>
                    {itens.length > 1 && (
                      <button type="button" onClick={() => setItens((l) => l.filter((_, j) => j !== i))} className="text-xs text-white/50 hover:text-white">
                        Remover
                      </button>
                    )}
                  </div>
                  <input
                    className="admin-input"
                    placeholder="Título do tópico"
                    value={item.titulo}
                    onChange={(e) => setItens((l) => l.map((x, j) => (j === i ? { ...x, titulo: e.target.value } : x)))}
                  />
                  <textarea
                    className="admin-input min-h-[72px]"
                    placeholder="Texto do tópico"
                    value={item.texto}
                    onChange={(e) => setItens((l) => l.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                  />
                </div>
              ))}
              {itens.length < LIMITE_ITENS && (
                <button type="button" onClick={() => setItens((l) => [...l, { titulo: "", texto: "" }])} className="text-xs text-gold-400 hover:text-gold-300">
                  + Adicionar slide
                </button>
              )}
              <Campo label="Frase do último slide (vazio = sem slide final)">
                <input className="admin-input" value={chamadaTexto} onChange={(e) => setChamadaTexto(e.target.value)} />
              </Campo>
            </div>
          )}

          <button
            type="button"
            onClick={gerar}
            disabled={gerando || (tipo === "numeros" && !numeros)}
            className="w-full btn-primary rounded-lg py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerando ? "Gerando…" : slides.length ? "Gerar de novo" : "Gerar post"}
          </button>
          {erro && (
            <p role="alert" className="text-red-300 text-sm">
              {erro}
            </p>
          )}
        </section>
      </div>

      <section className="min-w-0 rounded-xl border border-[#1f1f1f] bg-[#050505] p-4 min-h-[320px]">
        {slides.length ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-white/70 text-sm">
                {slides.length > 1 ? `Carrossel com ${slides.length} slides` : "Arte pronta"}
              </p>
              <button type="button" onClick={baixarTodos} className="btn-primary rounded-lg px-4 py-2 text-sm font-bold">
                {slides.length > 1 ? "Baixar todos" : "Baixar"}
              </button>
            </div>
            <div className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x">
              {slides.map((s, i) => (
                <figure key={i} className="shrink-0 w-[260px] sm:w-[300px] snap-start">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-[#1f1f1f]" />
                  <figcaption className="flex items-center justify-between mt-1.5 text-xs text-white/55">
                    <span>Slide {i + 1}</span>
                    <button type="button" onClick={() => baixar(s, i)} className="text-gold-400 hover:text-gold-300">
                      Baixar
                    </button>
                  </figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : (
          <div className="h-full min-h-[280px] flex items-center justify-center text-center px-6">
            <p className="text-white/45 text-sm max-w-sm">
              {gerando ? "Desenhando as artes…" : "Preencha ao lado e clique em Gerar post. As artes aparecem aqui para conferir e baixar."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
