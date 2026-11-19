"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { restaurarPresetAction, salvarPresetAction } from "@/app/admin/fotos/actions";
import type { ModoDirecao } from "@/lib/fotos/faixas";
import { calcularRecorte, ENQUADRO_PADRAO, FORMATOS, tamanhoFinal, type Enquadro, type Qualidade } from "@/lib/fotos/enquadro";
import { mesmoPreset, PRESET_PADRAO, type Preset } from "@/lib/fotos/preset";
import { SEM_TRATAMENTO, type Ajustes } from "@/lib/fotos/tratamento";
import type { Pedido, Resposta, ResumoFaixas } from "@/lib/fotos/worker";

type Foto = {
  id: string;
  nome: string;
  largura: number;
  altura: number;
  estado: "abrindo" | "pronta" | "erro";
  erro?: string;
  enquadro: Enquadro;
  modo: ModoDirecao;
  faixas?: ResumoFaixas;
};

const CONTROLES: { chave: keyof Omit<Ajustes, "faixas">; label: string; min: number; max: number }[] = [
  { chave: "exposicao", label: "Exposição", min: -100, max: 100 },
  { chave: "altas", label: "Recuperar altas luzes", min: 0, max: 100 },
  { chave: "sombras", label: "Sombras", min: -100, max: 100 },
  { chave: "contraste", label: "Contraste", min: 0, max: 100 },
  { chave: "cor", label: "Cor cinematográfica", min: 0, max: 100 },
  { chave: "nitidez", label: "Nitidez", min: 0, max: 100 },
  { chave: "profundidade", label: "Profundidade", min: 0, max: 100 },
];

const MODOS: { id: ModoDirecao; label: string }[] = [
  { id: "auto", label: "Automático" },
  { id: "horizontal", label: "Horizontais" },
  { id: "vertical", label: "Verticais" },
];

function Regua({
  label,
  valor,
  min,
  max,
  sufixo = "",
  onChange,
}: {
  label: string;
  valor: number;
  min: number;
  max: number;
  sufixo?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs">
        <span className="text-white/70">{label}</span>
        <span className="text-white/45 tabular-nums">
          {valor}
          {sufixo}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-8 accent-[#FFD700] cursor-pointer"
      />
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

function textoFaixas(f: Foto): { titulo: string; detalhe: string; achou: boolean } {
  if (!f.faixas) return { titulo: "Analisando a foto…", detalhe: "", achou: false };
  if (!f.faixas.encontrou) {
    return {
      titulo: "Nenhuma faixa clara encontrada",
      detalhe: f.modo === "auto" ? "Se você vê faixas, escolha a direção delas abaixo." : "Nessa direção também não apareceu um padrão regular.",
      achou: false,
    };
  }
  const direcao = f.faixas.direcao === "horizontal" ? "horizontais" : "verticais";
  return {
    titulo: `Faixas ${direcao} detectadas`,
    detalhe: `Cerca de ${f.faixas.faixas} na foto, com ${f.faixas.intensidade.toFixed(0)}% de diferença de luz.`,
    achou: true,
  };
}

function nomeFinal(nome: string): string {
  return `${nome.replace(/\.[^.]+$/, "").replace(/\.(jpe?g|png|webp)$/i, "")}-pfc.jpg`;
}

export type QuadroFoto = { id: string; nome: string; cor: string };

const LEMBRAR_QUADRO = "pfc-fotos-quadro";

export default function EditorFotos({ quadros, presets }: { quadros: QuadroFoto[]; presets: Record<string, Preset> }) {
  const [salvos, setSalvos] = useState(presets);
  const [quadro, setQuadro] = useState(quadros[0]?.id ?? "");
  const presetDe = (q: string) => salvos[q] ?? PRESET_PADRAO;
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [ativaId, setAtivaId] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<Ajustes>(() => presetDe(quadros[0]?.id ?? "").ajustes);
  const [qualidade, setQualidade] = useState<Qualidade>(() => presetDe(quadros[0]?.id ?? "").qualidade);
  const [salvando, iniciarSalvar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const [corte, setCorte] = useState(50);
  const [processando, setProcessando] = useState(false);
  const [exportando, setExportando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const antesRef = useRef<HTMLCanvasElement>(null);
  const depoisRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seqRef = useRef(0);
  const esperas = useRef(new Map<number, { ok: (b: Blob) => void; falha: (m: string) => void }>());

  const ativa = fotos.find((f) => f.id === ativaId) ?? null;

  const enviar = useCallback((p: Pedido) => workerRef.current?.postMessage(p), []);

  /** Cada quadro abre com o ajuste salvo dele; as fotos já abertas mudam de formato junto. */
  function escolherQuadro(q: string) {
    const preset = presetDe(q);
    setQuadro(q);
    setAjustes(preset.ajustes);
    setQualidade(preset.qualidade);
    setAviso(null);
    setFotos((l) => l.map((f) => (f.enquadro.formato === preset.formato ? f : { ...f, enquadro: { ...f.enquadro, formato: preset.formato, zoom: 1 } })));
    try {
      localStorage.setItem(LEMBRAR_QUADRO, q);
    } catch {
      // Sem armazenamento: só não lembra o quadro na próxima visita.
    }
  }

  useEffect(() => {
    try {
      const q = localStorage.getItem(LEMBRAR_QUADRO);
      if (q && q !== quadro && quadros.some((x) => x.id === q)) escolherQuadro(q);
    } catch {
      // Sem armazenamento: fica o primeiro quadro.
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const worker = new Worker(new URL("../../../lib/fotos/worker.ts", import.meta.url));
    workerRef.current = worker;
    const pendentes = esperas.current;

    worker.onmessage = (e: MessageEvent<Resposta>) => {
      const r = e.data;
      if (r.tipo === "aberta") {
        setFotos((l) => l.map((f) => (f.id === r.id ? { ...f, estado: "pronta", largura: r.largura, altura: r.altura } : f)));
      } else if (r.tipo === "previa") {
        if (r.seq === seqRef.current) {
          for (const [ref, bmp] of [
            [antesRef.current, r.antes],
            [depoisRef.current, r.depois],
          ] as const) {
            if (!ref) continue;
            ref.width = bmp.width;
            ref.height = bmp.height;
            ref.getContext("2d")?.drawImage(bmp, 0, 0);
          }
          setProcessando(false);
        }
        r.antes.close();
        r.depois.close();
        setFotos((l) => l.map((f) => (f.id === r.id ? { ...f, faixas: r.faixas } : f)));
      } else if (r.tipo === "exportada") {
        pendentes.get(r.seq)?.ok(r.blob);
        pendentes.delete(r.seq);
      } else if (r.seq !== undefined && pendentes.has(r.seq)) {
        pendentes.get(r.seq)?.falha(r.mensagem);
        pendentes.delete(r.seq);
      } else {
        setProcessando(false);
        setFotos((l) => l.map((f) => (f.id === r.id ? { ...f, estado: "erro", erro: r.mensagem } : f)));
      }
    };
    worker.onerror = () => {
      setProcessando(false);
      setErro("O processamento parou. Recarregue a página e tente de novo.");
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
      pendentes.clear();
    };
  }, []);

  // A prévia espera a régua parar um instante: cada cálculo leva alguns décimos.
  useEffect(() => {
    if (!ativa || ativa.estado !== "pronta") return;
    setProcessando(true);
    const seq = ++seqRef.current;
    const t = setTimeout(() => {
      enviar({ tipo: "previa", id: ativa.id, seq, modo: ativa.modo, ajustes, enquadro: ativa.enquadro });
    }, 140);
    return () => clearTimeout(t);
  }, [ativa?.id, ativa?.estado, ativa?.modo, ativa?.enquadro, ajustes, enviar]); // eslint-disable-line react-hooks/exhaustive-deps

  function adicionar(lista: FileList | File[]) {
    setErro(null);
    const novas: Foto[] = [];
    for (const arquivo of Array.from(lista)) {
      if (!arquivo.type.startsWith("image/") && !/\.(heic|heif)$/i.test(arquivo.name)) continue;
      const id = crypto.randomUUID();
      novas.push({ id, nome: arquivo.name, largura: 0, altura: 0, estado: "abrindo", enquadro: { ...ENQUADRO_PADRAO, formato: presetDe(quadro).formato }, modo: "auto" });
      enviar({ tipo: "abrir", id, arquivo });
    }
    if (!novas.length) {
      setErro("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
      return;
    }
    setFotos((l) => [...l, ...novas]);
    setAtivaId((a) => a ?? novas[0].id);
  }

  function remover(id: string) {
    enviar({ tipo: "fechar", id });
    const resto = fotos.filter((f) => f.id !== id);
    setFotos(resto);
    if (ativaId === id) setAtivaId(resto[0]?.id ?? null);
  }

  function atualizar(mudanca: Partial<Foto>) {
    if (!ativaId) return;
    setFotos((l) => l.map((f) => (f.id === ativaId ? { ...f, ...mudanca } : f)));
  }

  function enquadrar(mudanca: Partial<Enquadro>) {
    if (ativa) atualizar({ enquadro: { ...ativa.enquadro, ...mudanca } });
  }

  function exportarFoto(f: Foto): Promise<void> {
    return new Promise((resolve, reject) => {
      const seq = -Date.now() - Math.floor(Math.random() * 1000);
      esperas.current.set(seq, {
        ok: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = nomeFinal(f.nome);
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 5000);
          resolve();
        },
        falha: (m) => reject(new Error(m)),
      });
      enviar({ tipo: "exportar", id: f.id, seq, modo: f.modo, ajustes, enquadro: f.enquadro, qualidade });
    });
  }

  async function baixar(lista: Foto[]) {
    setErro(null);
    try {
      for (let i = 0; i < lista.length; i++) {
        setExportando(lista.length > 1 ? `Gerando ${i + 1} de ${lista.length}…` : "Gerando a foto…");
        await exportarFoto(lista[i]);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não consegui gerar a foto.");
    } finally {
      setExportando(null);
    }
  }

  const prontas = fotos.filter((f) => f.estado === "pronta");
  const info = ativa ? textoFaixas(ativa) : null;
  const final =
    ativa && ativa.largura > 0
      ? tamanhoFinal(calcularRecorte(ativa.largura, ativa.altura, ativa.enquadro), ativa.enquadro.formato, qualidade)
      : null;
  const tratamentoLigado = CONTROLES.some((c) => ajustes[c.chave] !== SEM_TRATAMENTO[c.chave]);
  const salvo = presetDe(quadro);
  const atual: Preset = { ajustes, qualidade, formato: ativa?.enquadro.formato ?? salvo.formato };
  const alterado = !mesmoPreset(atual, salvo);
  const nomeQuadro = quadros.find((q) => q.id === quadro)?.nome ?? "quadro";

  function salvar() {
    setAviso(null);
    iniciarSalvar(async () => {
      const r = await salvarPresetAction(quadro, atual);
      if (r.ok && r.preset) {
        setSalvos((s) => ({ ...s, [quadro]: r.preset! }));
        setAviso(`Ajuste do ${nomeQuadro} salvo para toda a equipe.`);
      } else setAviso(r.erro ?? "Não consegui salvar.");
    });
  }

  function restaurar() {
    setAviso(null);
    iniciarSalvar(async () => {
      const r = await restaurarPresetAction(quadro);
      if (!r.ok) return setAviso(r.erro ?? "Não consegui restaurar.");
      setSalvos((s) => {
        const resto = { ...s };
        delete resto[quadro];
        return resto;
      });
      setAjustes(PRESET_PADRAO.ajustes);
      setQualidade(PRESET_PADRAO.qualidade);
      setAviso(`O ${nomeQuadro} voltou ao ajuste padrão.`);
    });
  }

  const seletorQuadro = (
    <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-white text-sm font-semibold">Quadro</h2>
        <span className={`text-xs ${alterado ? "text-yellow-300" : "text-white/45"}`}>
          {alterado ? "Alterado, ainda não salvo" : salvos[quadro] ? "Usando o ajuste salvo" : "Usando o ajuste padrão"}
        </span>
      </div>
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
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button
          type="button"
          disabled={!alterado || salvando}
          onClick={salvar}
          className="min-h-9 px-3 rounded-lg bg-gold-500 text-black text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {salvando ? "Salvando…" : `Salvar como ajuste do ${nomeQuadro}`}
        </button>
        {alterado && (
          <button type="button" onClick={() => escolherQuadro(quadro)} className="min-h-9 px-2 text-xs text-white/65 hover:text-white">
            Desfazer mudanças
          </button>
        )}
        {salvos[quadro] && !alterado && (
          <button type="button" disabled={salvando} onClick={restaurar} className="min-h-9 px-2 text-xs text-white/65 hover:text-white">
            Voltar ao padrão
          </button>
        )}
      </div>
      {aviso && (
        <p role="status" className="text-xs text-white/70 mt-2">
          {aviso}
        </p>
      )}
    </section>
  );

  const seletor = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,.heic,.heif"
      multiple
      className="hidden"
      onChange={(e) => {
        if (e.target.files) adicionar(e.target.files);
        e.target.value = "";
      }}
    />
  );

  if (!fotos.length) {
    return (
      <div className="mt-6 space-y-4">
        {seletor}
        {seletorQuadro}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastando(false);
            adicionar(e.dataTransfer.files);
          }}
          className={`w-full rounded-2xl border-2 border-dashed px-6 py-16 sm:py-24 text-center transition-colors ${
            arrastando ? "border-gold-500 bg-gold-500/5" : "border-[#2a2a2a] hover:border-white/25"
          }`}
        >
          <span className="block text-white font-semibold text-lg">Arraste as fotos aqui</span>
          <span className="block text-white/55 text-sm mt-2">ou clique para escolher. JPG, PNG ou WebP, uma ou várias da mesma sessão.</span>
          <span className="inline-block mt-6 btn-primary px-5 py-2.5 rounded-lg text-sm font-bold">Escolher fotos</span>
        </button>
        {erro && <p className="text-red-300 text-sm mt-3">{erro}</p>}
        <p className="text-white/45 text-xs mt-4 max-w-2xl">
          As fotos são processadas neste navegador e não são enviadas para nenhum servidor. O rosto e os objetos não são redesenhados: só luz e cor mudam.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
      {seletor}
      <div className="min-w-0">
        <div className="relative rounded-xl overflow-hidden bg-[#050505] border border-[#1f1f1f] flex items-center justify-center min-h-[280px]">
          {ativa?.estado === "erro" ? (
            <p className="text-red-300 text-sm p-8 text-center">{ativa.erro}</p>
          ) : (
            <div className="relative max-w-full select-none">
              <canvas ref={depoisRef} className="block max-w-full max-h-[72vh] w-auto h-auto" />
              <canvas
                ref={antesRef}
                className="absolute inset-0 w-full h-full"
                style={{ clipPath: `inset(0 ${100 - corte}% 0 0)` }}
              />
              <div className="absolute inset-y-0 w-0.5 bg-white/90 pointer-events-none" style={{ left: `${corte}%` }} />
              <span className="absolute top-2 left-2 text-[11px] font-semibold bg-black/70 text-white px-2 py-1 rounded pointer-events-none">Antes</span>
              <span className="absolute top-2 right-2 text-[11px] font-semibold bg-black/70 text-gold-400 px-2 py-1 rounded pointer-events-none">Depois</span>
              <input
                type="range"
                min={0}
                max={100}
                value={corte}
                onChange={(e) => setCorte(Number(e.target.value))}
                aria-label="Comparar antes e depois"
                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
              />
            </div>
          )}
          {(processando || ativa?.estado === "abrindo") && (
            <span role="status" className="absolute bottom-2 left-2 text-[11px] bg-black/70 text-white/80 px-2 py-1 rounded">
              Processando…
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {fotos.map((f) => (
            <div
              key={f.id}
              className={`shrink-0 flex items-center rounded-lg border text-xs ${
                f.id === ativaId ? "border-gold-500 bg-gold-500/10" : "border-[#2a2a2a]"
              }`}
            >
              <button type="button" onClick={() => setAtivaId(f.id)} className="max-w-[170px] truncate pl-3 pr-1 py-2 text-white/80" title={f.nome}>
                {f.estado === "erro" ? "⚠ " : ""}
                {f.nome}
              </button>
              <button type="button" onClick={() => remover(f.id)} aria-label={`Remover ${f.nome}`} className="px-2 py-2 text-white/40 hover:text-white">
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="shrink-0 rounded-lg border border-dashed border-[#2a2a2a] px-3 py-2 text-xs text-white/65 hover:text-white hover:border-white/25"
          >
            + Adicionar
          </button>
        </div>
      </div>

      <aside className="space-y-4">
        {seletorQuadro}
        {ativa && info && (
          <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
            <h2 className="text-white text-sm font-semibold">Faixas de luz</h2>
            <p className={`text-sm mt-2 font-medium ${info.achou ? "text-gold-400" : "text-white/75"}`}>{info.titulo}</p>
            {info.detalhe && <p className="text-white/50 text-xs mt-0.5">{info.detalhe}</p>}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {MODOS.map((m) => (
                <Opcao key={m.id} ativa={ativa.modo === m.id} onClick={() => atualizar({ modo: m.id, faixas: undefined })}>
                  {m.label}
                </Opcao>
              ))}
            </div>
            <div className="mt-3">
              <Regua label="Força da correção" valor={ajustes.faixas} min={0} max={200} sufixo="%" onChange={(v) => setAjustes((a) => ({ ...a, faixas: v }))} />
            </div>
          </section>
        )}

        <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-white text-sm font-semibold">Acabamento PFC</h2>
            <button
              type="button"
              onClick={() => setAjustes((a) => (tratamentoLigado ? { ...a, ...SEM_TRATAMENTO } : { ...salvo.ajustes, faixas: a.faixas }))}
              className="text-xs text-gold-400 hover:text-gold-300"
            >
              {tratamentoLigado ? "Desligar" : "Aplicar padrão"}
            </button>
          </div>
          <div className="mt-2 space-y-1">
            {CONTROLES.map((c) => (
              <Regua key={c.chave} label={c.label} valor={ajustes[c.chave]} min={c.min} max={c.max} onChange={(v) => setAjustes((a) => ({ ...a, [c.chave]: v }))} />
            ))}
          </div>
        </section>

        {ativa && (
          <section className="rounded-xl border border-[#1f1f1f] bg-[#111] p-4">
            <h2 className="text-white text-sm font-semibold">Formato do post</h2>
            <div className="grid grid-cols-3 gap-1.5 mt-3">
              {FORMATOS.map((f) => (
                <Opcao key={f.id} ativa={ativa.enquadro.formato === f.id} onClick={() => enquadrar({ formato: f.id, zoom: 1 })}>
                  <span className="block">{f.label}</span>
                  <span className="block text-[10px] font-normal opacity-70">{f.uso}</span>
                </Opcao>
              ))}
            </div>
            {ativa.enquadro.formato !== "original" && (
              <div className="mt-3 space-y-1">
                <Regua label="Mover na horizontal" valor={Math.round(ativa.enquadro.x * 100)} min={0} max={100} onChange={(v) => enquadrar({ x: v / 100 })} />
                <Regua label="Mover na vertical" valor={Math.round(ativa.enquadro.y * 100)} min={0} max={100} onChange={(v) => enquadrar({ y: v / 100 })} />
                <Regua label="Aproximar" valor={Math.round(ativa.enquadro.zoom * 100)} min={100} max={250} sufixo="%" onChange={(v) => enquadrar({ zoom: v / 100 })} />
              </div>
            )}
            <div className="flex gap-1.5 mt-3">
              <Opcao ativa={qualidade === "instagram"} onClick={() => setQualidade("instagram")}>
                Instagram
              </Opcao>
              <Opcao ativa={qualidade === "alta"} onClick={() => setQualidade("alta")}>
                Alta resolução
              </Opcao>
            </div>
            {final && (
              <p className="text-white/50 text-xs mt-2 tabular-nums">
                Sai em {final.width} × {final.height} px, JPG
              </p>
            )}
          </section>
        )}

        <div className="space-y-2">
          <button
            type="button"
            disabled={!ativa || ativa.estado !== "pronta" || !!exportando}
            onClick={() => ativa && baixar([ativa])}
            className="w-full btn-primary rounded-lg py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exportando ?? "Baixar esta foto"}
          </button>
          {prontas.length > 1 && (
            <button
              type="button"
              disabled={!!exportando}
              onClick={() => baixar(prontas)}
              className="w-full btn-outline rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              Baixar todas ({prontas.length})
            </button>
          )}
          {erro && (
            <p role="alert" className="text-red-300 text-sm">
              {erro}
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
