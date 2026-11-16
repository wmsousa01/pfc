"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cancelarEnvioAction, confirmarEnvioAction, iniciarEnvioAction } from "@/app/admin/materiais/actions";
import { CATEGORIAS, TIPOS, tamanhoLegivel, type Categoria } from "@/lib/materiais/tipos";

type Opcao = { value: string; label: string };
type Episodio = { id: string; quadro: string; label: string };

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50";
const labelCls = "block text-white/55 text-xs mb-1";

/** PUT do arquivo na sessão do Drive, com progresso. Devolve o id do arquivo criado. */
function enviarParaDrive(url: string, f: File, onProgresso: (p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgresso(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status !== 200 && xhr.status !== 201) {
        reject(new Error(`O Drive recusou o arquivo (${xhr.status}).`));
        return;
      }
      try {
        const id = (JSON.parse(xhr.responseText) as { id?: string }).id;
        if (id) resolve(id);
        else reject(new Error("O Drive não devolveu o arquivo."));
      } catch {
        reject(new Error("Resposta inesperada do Drive."));
      }
    };
    xhr.onerror = () => reject(new Error("A conexão caiu no meio do envio. Tente de novo."));
    xhr.send(f);
  });
}

/**
 * Envio de materiais. O arquivo vai do navegador direto para o Drive (a função
 * da Vercel recusa corpo acima de 4,5 MB, e vídeo editado tem GB).
 * Com `substitui`, é nova versão de um material: categoria, quadro e título vêm dele.
 */
export default function EnvioMaterial({
  quadros,
  episodios,
  substitui,
  categoriaInicial,
}: {
  quadros: Opcao[];
  episodios: Episodio[];
  substitui?: { id: string; titulo: string };
  categoriaInicial?: Categoria;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [categoria, setCategoria] = useState<Categoria>(categoriaInicial ?? "quadro");
  const [quadro, setQuadro] = useState(quadros[0]?.value ?? "");
  const [episodio, setEpisodio] = useState("");
  const [referencia, setReferencia] = useState("");
  const [tipo, setTipo] = useState(CATEGORIAS[categoriaInicial ?? "quadro"].tipos[0]);
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [progresso, setProgresso] = useState<{ nome: string; i: number; total: number; p: number } | null>(null);
  const [feito, setFeito] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const enviando = progresso !== null;

  // Fechar a aba no meio derruba o envio: avisa antes.
  useEffect(() => {
    if (!enviando) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [enviando]);

  const quadroDoEp = categoria === "visita" ? "pfc-visita" : quadro;
  const epsDaCategoria = useMemo(
    () => (categoria === "quadro" || categoria === "visita" ? episodios.filter((e) => e.quadro === quadroDoEp) : []),
    [categoria, quadroDoEp, episodios]
  );

  function trocarCategoria(c: Categoria) {
    setCategoria(c);
    setTipo(CATEGORIAS[c].tipos[0]);
    setEpisodio("");
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (arquivos.length === 0) {
      setErro("Escolha os arquivos.");
      return;
    }
    if (!substitui && !titulo.trim()) {
      setErro("Dê um título ao material.");
      return;
    }
    setErro(null);
    setFeito(null);
    let feitos = 0;
    try {
      for (let i = 0; i < arquivos.length; i++) {
        const f = arquivos[i];
        setProgresso({ nome: f.name, i, total: arquivos.length, p: 0 });
        const semExt = f.name.replace(/\.[^.]+$/, "");
        const ini = await iniciarEnvioAction(
          {
            categoria,
            quadro: categoria === "quadro" ? quadro : null,
            episodio_id: episodio || null,
            referencia: referencia || null,
            tipo,
            titulo: arquivos.length > 1 ? `${titulo.trim()} · ${semExt}` : titulo.trim(),
            nota: nota || null,
            substitui_id: substitui?.id ?? null,
          },
          f.name,
          f.type || "application/octet-stream",
          f.size
        );
        if (!ini.ok) throw new Error(`${f.name}: ${ini.error}`);
        let fileId: string | null = null;
        try {
          fileId = await enviarParaDrive(ini.uploadUrl, f, (p) => setProgresso({ nome: f.name, i, total: arquivos.length, p }));
          const c = await confirmarEnvioAction(ini.id, fileId);
          if (!c.ok) throw new Error(c.error ?? "Não confirmou o envio.");
        } catch (err) {
          await cancelarEnvioAction(ini.id, fileId);
          throw new Error(`${f.name}: ${err instanceof Error ? err.message : String(err)}`);
        }
        feitos++;
      }
      setFeito(`${feitos} ${feitos === 1 ? "material enviado" : "materiais enviados"} para revisão.`);
      setArquivos([]);
      setTitulo("");
      setNota("");
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setFeito(feitos ? `${feitos} enviado(s) antes do erro.` : null);
      setErro(err instanceof Error ? err.message : String(err));
    } finally {
      setProgresso(null);
      router.refresh();
    }
  }

  const total = arquivos.reduce((s, f) => s + f.size, 0);

  return (
    <form onSubmit={enviar} className="space-y-4">
      {!substitui && (
        <>
          <div>
            <span className={labelCls}>Categoria</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => trocarCategoria(c)}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    categoria === c ? "border-gold-500/60 bg-gold-500/10" : "border-[#2a2a2a] hover:border-[#3a3a3a]"
                  }`}
                >
                  <span className={`block text-sm font-semibold ${categoria === c ? "text-gold-400" : "text-white"}`}>
                    {CATEGORIAS[c].label}
                  </span>
                  <span className="block text-white/40 text-[11px] leading-snug mt-0.5">{CATEGORIAS[c].descricao}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {categoria === "quadro" && (
              <label>
                <span className={labelCls}>Quadro</span>
                <select value={quadro} onChange={(e) => (setQuadro(e.target.value), setEpisodio(""))} className={inputCls}>
                  {quadros.map((q) => (
                    <option key={q.value} value={q.value}>{q.label}</option>
                  ))}
                </select>
              </label>
            )}

            {(categoria === "quadro" || categoria === "visita") && (
              <label>
                <span className={labelCls}>Episódio</span>
                <select value={episodio} onChange={(e) => setEpisodio(e.target.value)} className={inputCls}>
                  <option value="">{epsDaCategoria.length ? "Escolha o episódio" : "Nenhum episódio na agenda"}</option>
                  {epsDaCategoria.map((ep) => (
                    <option key={ep.id} value={ep.id}>{ep.label}</option>
                  ))}
                </select>
              </label>
            )}

            {!(categoria === "quadro" && episodio) && !(categoria === "visita" && episodio) && (
              <label>
                <span className={labelCls}>
                  {categoria === "visita"
                    ? "Negócio visitado"
                    : categoria === "anuncio"
                      ? "Cliente ou campanha"
                      : categoria === "vinheta"
                        ? "Pacote / uso (opcional)"
                        : "Assunto (sem episódio na agenda)"}
                </span>
                <input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder={
                    categoria === "visita" ? "Ex.: Padaria São José" : categoria === "anuncio" ? "Ex.: Imobiliária X · Black Friday" : ""
                  }
                  className={inputCls}
                />
              </label>
            )}

            <label>
              <span className={labelCls}>Tipo</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
                {CATEGORIAS[categoria].tipos.map((t) => (
                  <option key={t} value={t}>{TIPOS[t]}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className={labelCls}>Título</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Corte 3: o dia em que a loja quase fechou"
              className={inputCls}
              maxLength={160}
            />
          </label>
        </>
      )}

      <label className="block">
        <span className={labelCls}>{substitui ? "O que mudou nesta versão" : "Recado para a revisão (opcional)"}</span>
        <textarea value={nota} onChange={(e) => setNota(e.target.value)} rows={2} className={inputCls} maxLength={1000} />
      </label>

      <div>
        <span className={labelCls}>Arquivos</span>
        <input
          ref={fileRef}
          type="file"
          multiple={!substitui}
          onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
          className="block w-full text-sm text-white/60 file:mr-3 file:rounded-md file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-white"
        />
        {arquivos.length > 0 && (
          <p className="text-white/40 text-xs mt-1.5">
            {arquivos.length} {arquivos.length === 1 ? "arquivo" : "arquivos"} · {tamanhoLegivel(total)}
            {arquivos.length > 1 && " · cada arquivo vira um material, com o nome dele no título"}
          </p>
        )}
      </div>

      {progresso && (
        <div>
          <div className="flex justify-between text-xs text-white/60 mb-1">
            <span className="truncate">
              {progresso.total > 1 && `${progresso.i + 1} de ${progresso.total} · `}
              {progresso.nome}
            </span>
            <span>{Math.round(progresso.p * 100)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gold-500 transition-[width]" style={{ width: `${progresso.p * 100}%` }} />
          </div>
          <p className="text-white/35 text-[11px] mt-1">Não feche esta aba até terminar.</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button disabled={enviando} className="btn-primary px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-wait">
          {enviando ? "Enviando..." : substitui ? "Enviar nova versão" : "Enviar para revisão"}
        </button>
      </div>
      {feito && <p className="text-emerald-400 text-xs">{feito}</p>}
      {erro && <p className="text-red-400 text-xs break-words">{erro}</p>}
    </form>
  );
}
