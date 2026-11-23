"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  buscarNumerosAction,
  conferirFotoAction,
  gerarPostAction,
  montarComIAAction,
  pedirEnvioFotoAction,
  publicarPostAction,
} from "@/app/admin/fotos/actions";
import { PRESET_PADRAO, type Preset } from "@/lib/fotos/preset";
import type { Pedido, Resposta } from "@/lib/fotos/worker";
import {
  LIMITE_ITENS,
  MODELOS_CARTAZ,
  PERIODOS,
  SLIDES_PADRAO,
  TAMANHOS,
  type FormatoPost,
  type NumerosPost,
  type PedidoPost,
  type PerfilInstagram,
  type PeriodoNumeros,
  type SlideGerado,
  type SlidesNumeros,
} from "@/lib/posts/tipos";
import type { QuadroFoto } from "./EditorFotos";

type Tipo = "numeros" | "cartaz" | "texto";

/** Foto já tratada e enviada: o caminho vai para o servidor; a prévia fica só na tela. */
type Foto = { path: string; previa: string } | null;

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

/** Escolher foto: mostra a miniatura já tratada ou o botão de escolher. */
function CampoFoto({
  label,
  foto,
  ocupado,
  onEscolher,
  onTirar,
}: {
  label: string;
  foto: Foto;
  ocupado: boolean;
  onEscolher: (f: File) => void;
  onTirar: () => void;
}) {
  return (
    <div>
      <span className="admin-label block mb-1">{label}</span>
      {foto ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.previa} alt="Foto tratada" className="w-14 h-14 object-cover rounded-lg" />
          <button type="button" onClick={onTirar} className="text-xs text-white/65 hover:text-white">
            Tirar foto
          </button>
        </div>
      ) : ocupado ? (
        <p role="status" className="text-xs text-white/60">
          Tratando e enviando a foto…
        </p>
      ) : (
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={label}
          className="block w-full text-xs text-white/65 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-white"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onEscolher(f);
            e.target.value = "";
          }}
        />
      )}
    </div>
  );
}

const numeroOuVazio = (v: number | null) => (v == null ? "" : String(Math.round(v * 10) / 10));

export default function EditorPosts({
  quadros,
  presets,
  perfis,
}: {
  quadros: QuadroFoto[];
  presets: Record<string, Preset>;
  perfis: PerfilInstagram[];
}) {
  const [quadro, setQuadro] = useState(quadros[0]?.id ?? "");
  const [tipo, setTipo] = useState<Tipo>("numeros");
  const [gerando, iniciar] = useTransition();
  const [buscando, iniciarBusca] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [slides, setSlides] = useState<SlideGerado[]>([]);

  // Ideia escrita pela equipe; a IA preenche o formulário e sugere a legenda.
  const [ideia, setIdeia] = useState("");
  const [legenda, setLegenda] = useState("");
  const [copiada, setCopiada] = useState(false);
  const [montando, iniciarMontagem] = useTransition();

  // Números do canal
  const [periodo, setPeriodo] = useState<PeriodoNumeros>("semana");
  const [numeros, setNumeros] = useState<NumerosPost | null>(null);
  const [quais, setQuais] = useState<SlidesNumeros>(SLIDES_PADRAO);
  const [chamadaNumeros, setChamadaNumeros] = useState("Obrigado por assistir");
  const [fotoNumeros, setFotoNumeros] = useState<Foto>(null);

  // Cartaz
  const [modelo, setModelo] = useState(MODELOS_CARTAZ[0].id);
  const [formato, setFormato] = useState<FormatoPost>("4:5");
  const [chapeu, setChapeu] = useState(MODELOS_CARTAZ[0].chapeu);
  const [titulo, setTitulo] = useState(MODELOS_CARTAZ[0].titulo);
  const [mensagem, setMensagem] = useState(MODELOS_CARTAZ[0].mensagem);
  const [assinatura, setAssinatura] = useState("Equipe Fora da Caixa");
  const [fotoCartaz, setFotoCartaz] = useState<Foto>(null);

  // Carrossel de texto
  const [tituloTexto, setTituloTexto] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [fotoCapaTexto, setFotoCapaTexto] = useState<Foto>(null);
  const [itens, setItens] = useState<{ titulo: string; texto: string; foto?: Foto }[]>([{ titulo: "", texto: "" }]);
  const [chamadaTexto, setChamadaTexto] = useState("Salve para ler depois");

  // Fotos em tratamento, por campo ("cartaz", "capa-texto", "item-2"...).
  const [tratando, setTratando] = useState<Record<string, boolean>>({});

  // Publicação
  const [perfilId, setPerfilId] = useState<number | null>(perfis[0]?.id ?? null);
  const [comoStory, setComoStory] = useState(false);
  const [publicando, iniciarPublicacao] = useTransition();
  const [publicado, setPublicado] = useState<{ url: string | null; perfil: string } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const seqRef = useRef(0);
  const esperas = useRef(new Map<number, { ok: (b: Blob) => void; falha: (m: string) => void }>());

  useEffect(() => {
    try {
      const q = localStorage.getItem(LEMBRAR_QUADRO);
      if (q && quadros.some((x) => x.id === q)) setQuadro(q);
    } catch {
      // Sem armazenamento: fica o primeiro quadro.
    }
  }, [quadros]);

  useEffect(() => {
    const pendentes = esperas.current;
    return () => {
      workerRef.current?.terminate();
      pendentes.clear();
    };
  }, []);

  /** O mesmo processador da aba Corrigir fotos: faixas e acabamento do quadro. */
  const worker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = new Worker(new URL("../../../lib/fotos/worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data;
      if (r.tipo === "tratada") {
        esperas.current.get(r.seq)?.ok(r.blob);
        esperas.current.delete(r.seq);
      } else if (r.tipo === "erro" && r.seq !== undefined) {
        esperas.current.get(r.seq)?.falha(r.mensagem);
        esperas.current.delete(r.seq);
      }
    };
    workerRef.current = w;
    return w;
  }, []);

  /** Trata a foto com o ajuste do quadro, envia ao armazenamento e confere a chegada. */
  async function prepararFoto(arquivo: File): Promise<Foto> {
    const ajustes = (presets[quadro] ?? PRESET_PADRAO).ajustes;
    const seq = ++seqRef.current;
    const blob = await new Promise<Blob>((ok, falha) => {
      esperas.current.set(seq, { ok, falha: (m) => falha(new Error(m)) });
      const pedido: Pedido = { tipo: "tratar", id: `post-${seq}`, seq, arquivo, ajustes };
      worker().postMessage(pedido);
    });
    const envio = await pedirEnvioFotoAction();
    if (!envio.ok || !envio.path || !envio.url) throw new Error(envio.erro ?? "Não consegui preparar o envio da foto.");
    const r = await fetch(envio.url, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
    if (!r.ok) throw new Error(`O envio da foto falhou (${r.status}). Tente de novo.`);
    const conf = await conferirFotoAction(envio.path);
    if (!conf.ok) throw new Error(conf.erro ?? "A foto não chegou.");
    return { path: envio.path, previa: URL.createObjectURL(blob) };
  }

  async function escolherFoto(campo: string, arquivo: File, guardar: (f: Foto) => void) {
    setErro(null);
    setTratando((t) => ({ ...t, [campo]: true }));
    try {
      guardar(await prepararFoto(arquivo));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui usar essa foto. Use JPG, PNG ou WebP.");
    } finally {
      setTratando((t) => ({ ...t, [campo]: false }));
    }
  }

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

  function montarComIA() {
    setErro(null);
    setCopiada(false);
    iniciarMontagem(async () => {
      const r = await montarComIAAction(ideia, quadro);
      if (!r.ok || !r.post) return setErro(r.erro ?? "A IA não conseguiu montar o post.");
      const p = r.post;
      setSlides([]);
      setPublicado(null);
      setLegenda(p.legenda);
      if (p.tipo === "texto") {
        setTipo("texto");
        setTituloTexto(p.titulo);
        setSubtitulo(p.subtitulo);
        // Fotos já escolhidas ficam nos slides de mesma posição.
        setItens((antes) => p.itens.map((item, i) => ({ ...item, foto: antes[i]?.foto ?? null })));
        setChamadaTexto(p.chamada);
      } else {
        setTipo("cartaz");
        setModelo("livre");
        setFormato(p.formato);
        setChapeu(p.chapeu);
        setTitulo(p.titulo);
        setMensagem(p.mensagem);
        if (p.assinatura) setAssinatura(p.assinatura);
      }
    });
  }

  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(legenda);
      setCopiada(true);
    } catch {
      setErro("Não consegui copiar. Selecione o texto da legenda e copie à mão.");
    }
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
    if (tipo === "numeros") {
      return numeros ? { tipo, quadro, numeros, slides: quais, chamada: chamadaNumeros, fotoCapa: fotoNumeros?.path ?? null } : null;
    }
    if (tipo === "texto") {
      return {
        tipo,
        quadro,
        titulo: tituloTexto,
        subtitulo,
        itens: itens.map((i) => ({ titulo: i.titulo, texto: i.texto, foto: i.foto?.path ?? null })),
        chamada: chamadaTexto,
        fotoCapa: fotoCapaTexto?.path ?? null,
      };
    }
    return { tipo, quadro, formato, chapeu, titulo, mensagem, assinatura, foto: fotoCartaz?.path ?? null };
  }

  const fotoEmAndamento = Object.values(tratando).some(Boolean);

  function gerar() {
    const p = pedido();
    if (!p) return setErro("Busque os números do canal antes de gerar.");
    setErro(null);
    setPublicado(null);
    iniciar(async () => {
      const r = await gerarPostAction(p);
      if (r.ok && r.slides) {
        setSlides(r.slides);
        // Arte em pé de Stories já sugere publicar como Story.
        setComoStory(tipo === "cartaz" && formato === "9:16");
      } else setErro(r.erro ?? "Não consegui gerar o post.");
    });
  }

  /** O link é de outro domínio (armazenamento): baixa como arquivo em vez de abrir a imagem. */
  async function baixar(s: SlideGerado, i: number) {
    try {
      const blob = await (await fetch(s.url)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pfc-${tipo}-${String(i + 1).padStart(2, "0")}.jpg`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      window.open(s.url, "_blank", "noopener");
    }
  }

  async function baixarTodos() {
    for (let i = 0; i < slides.length; i++) {
      await baixar(slides[i], i);
      // O navegador barra vários downloads no mesmo instante.
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  const perfil = perfis.find((p) => p.id === perfilId) ?? null;

  function publicar() {
    if (!perfil) return;
    const onde = comoStory ? `nos Stories de ${perfil.nome}` : `no feed de ${perfil.nome}`;
    if (!window.confirm(`Publicar agora ${onde}? O post vai ao ar na hora.`)) return;
    setErro(null);
    iniciarPublicacao(async () => {
      const r = await publicarPostAction({
        paths: slides.map((s) => s.path),
        legenda,
        perfilId: perfil.principal ? null : perfil.id,
        story: comoStory,
      });
      if (r.ok && r.publicado) setPublicado(r.publicado);
      else setErro(r.erro ?? "Não consegui publicar no Instagram.");
    });
  }

  const editarNumero = (chave: keyof NumerosPost, valor: string) =>
    setNumeros((n) => (n ? { ...n, [chave]: valor === "" ? null : Number(valor) } : n));

  const nomeQuadro = quadros.find((q) => q.id === quadro)?.nome ?? "quadro";

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
      <div className="space-y-4">
        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
          <h2 className="text-white text-sm font-semibold">Quadro</h2>
          <p className="text-white/50 text-xs mt-0.5">A cor, o selo e o tratamento das fotos vêm do quadro.</p>
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

        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4 space-y-2.5">
          <div>
            <h2 className="text-white text-sm font-semibold">Ideia do post</h2>
            <p className="text-white/50 text-xs mt-0.5">
              Conte a ideia e a proposta. A IA escolhe o modelo, escreve os textos e sugere a legenda. Você revisa antes de gerar.
            </p>
          </div>
          <textarea
            className="admin-input min-h-[120px]"
            value={ideia}
            maxLength={2000}
            onChange={(e) => setIdeia(e.target.value)}
            placeholder="Ex.: carrossel com 4 lições do episódio com a dona da padaria do centro: começou vendendo na rua, nunca desistiu, cliente é vizinho, qualidade antes de crescer. Tom inspirador."
            aria-label="Ideia e proposta do post"
          />
          <button
            type="button"
            onClick={montarComIA}
            disabled={montando || ideia.trim().length < 10}
            className="w-full btn-outline rounded-lg py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {montando ? "Montando o post…" : "Montar post com IA"}
          </button>
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
                    setPublicado(null);
                    setErro(null);
                  }}
                >
                  {t.label}
                </Opcao>
              ))}
            </div>
            <p className="text-white/50 text-xs mt-2">{TIPOS.find((t) => t.id === tipo)?.dica}</p>
            <p className="text-white/45 text-xs mt-1">Toda foto recebe o tratamento do {nomeQuadro}: faixas de luz e acabamento PFC.</p>
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
                  <CampoFoto
                    label="Foto da capa (opcional)"
                    foto={fotoNumeros}
                    ocupado={!!tratando.numeros}
                    onEscolher={(f) => escolherFoto("numeros", f, setFotoNumeros)}
                    onTirar={() => setFotoNumeros(null)}
                  />
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
              <CampoFoto
                label="Foto de fundo (opcional)"
                foto={fotoCartaz}
                ocupado={!!tratando.cartaz}
                onEscolher={(f) => escolherFoto("cartaz", f, setFotoCartaz)}
                onTirar={() => setFotoCartaz(null)}
              />
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
              <CampoFoto
                label="Foto da capa (opcional)"
                foto={fotoCapaTexto}
                ocupado={!!tratando["capa-texto"]}
                onEscolher={(f) => escolherFoto("capa-texto", f, setFotoCapaTexto)}
                onTirar={() => setFotoCapaTexto(null)}
              />
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
                  <CampoFoto
                    label="Foto do slide (opcional)"
                    foto={item.foto ?? null}
                    ocupado={!!tratando[`item-${i}`]}
                    onEscolher={(f) => escolherFoto(`item-${i}`, f, (foto) => setItens((l) => l.map((x, j) => (j === i ? { ...x, foto } : x))))}
                    onTirar={() => setItens((l) => l.map((x, j) => (j === i ? { ...x, foto: null } : x)))}
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
            disabled={gerando || fotoEmAndamento || (tipo === "numeros" && !numeros)}
            className="w-full btn-primary rounded-lg py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {gerando ? "Gerando…" : fotoEmAndamento ? "Esperando a foto…" : slides.length ? "Gerar de novo" : "Gerar post"}
          </button>
          {erro && (
            <p role="alert" className="text-red-300 text-sm">
              {erro}
            </p>
          )}
        </section>
      </div>

      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border border-[#1f1f1f] bg-[#050505] p-4 min-h-[320px]">
          {slides.length ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-white/70 text-sm">{slides.length > 1 ? `Carrossel com ${slides.length} slides` : "Arte pronta"}</p>
                <button type="button" onClick={baixarTodos} className="btn-outline rounded-lg px-4 py-2 text-sm font-semibold">
                  {slides.length > 1 ? "Baixar todos" : "Baixar"}
                </button>
              </div>
              <div className="mt-4 flex gap-3 overflow-x-auto pb-2 snap-x">
                {slides.map((s, i) => (
                  <figure key={s.path} className="shrink-0 w-[260px] sm:w-[300px] snap-start">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.url} alt={`Slide ${i + 1}`} className="w-full rounded-lg border border-[#1f1f1f]" />
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
                {gerando ? "Desenhando as artes…" : "Preencha ao lado e clique em Gerar post. As artes aparecem aqui para conferir, baixar e publicar."}
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-white text-sm font-semibold">Legenda e publicação</h2>
            {legenda && (
              <button type="button" onClick={copiarLegenda} className="text-xs text-gold-400 hover:text-gold-300">
                {copiada ? "Copiada" : "Copiar legenda"}
              </button>
            )}
          </div>
          <textarea
            className="admin-input min-h-[110px]"
            value={legenda}
            maxLength={2200}
            onChange={(e) => {
              setLegenda(e.target.value);
              setCopiada(false);
            }}
            placeholder="Legenda do post. A IA preenche quando você monta o post pela ideia."
            aria-label="Legenda do post"
          />

          {perfis.length === 0 ? (
            <p className="text-white/55 text-xs">
              Nenhum perfil do Instagram conectado. Conecte em{" "}
              <a href="/admin/marketing?view=contas" className="text-gold-400 underline">
                Marketing &gt; Contas
              </a>{" "}
              para publicar daqui.
            </p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo label="Perfil">
                  <select className="admin-input" value={perfilId ?? ""} onChange={(e) => setPerfilId(Number(e.target.value))}>
                    {perfis.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                        {p.principal ? " (principal)" : ""}
                      </option>
                    ))}
                  </select>
                </Campo>
                <div>
                  <span className="admin-label block mb-1">Onde</span>
                  <div className="flex gap-1.5">
                    <Opcao ativa={!comoStory} onClick={() => setComoStory(false)}>
                      Feed
                    </Opcao>
                    <Opcao ativa={comoStory} onClick={() => setComoStory(true)}>
                      Stories
                    </Opcao>
                  </div>
                </div>
              </div>
              {comoStory && slides.length > 1 && <p className="text-white/55 text-xs">Cada slide vira um Story, na ordem. Story não leva legenda.</p>}
              {!comoStory && slides.length === 1 && formato === "9:16" && tipo === "cartaz" && (
                <p className="text-yellow-300/80 text-xs">Arte em formato de Stories no feed: o Instagram corta as bordas. Gere em 4:5 para o feed.</p>
              )}
              <button
                type="button"
                onClick={publicar}
                disabled={!slides.length || publicando || !perfil}
                className="w-full btn-primary rounded-lg py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {publicando ? "Publicando… pode levar até 1 minuto" : !slides.length ? "Gere o post para publicar" : "Publicar no Instagram"}
              </button>
              {publicado && (
                <p role="status" className="text-sm text-green-300">
                  Publicado em {publicado.perfil}.{" "}
                  {publicado.url && (
                    <a href={publicado.url} target="_blank" rel="noreferrer" className="underline">
                      Ver no Instagram
                    </a>
                  )}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
