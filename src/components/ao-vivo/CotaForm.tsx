"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { pedirUploadAction, salvarCotaAction } from "@/app/admin/ao-vivo/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { MOMENTOS, POSICOES, TIPOS, type Momento, type TipoInsercao } from "@/lib/ao-vivo/tipos";

export type CotaInicial = {
  id: string;
  partner_id: string;
  quadro: string;
  modalidade: string | null;
  tipo: TipoInsercao;
  momento: Momento;
  duracao_s: number;
  vezes: number | null;
  a_cada_min: number | null;
  texto: string | null;
  midia_path: string | null;
  midia_mime: string | null;
  posicao: string;
  inicio: string | null;
  fim: string | null;
  prioridade: number;
  observacao: string | null;
};

const input =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const rotulo = "block text-xs text-white/50 mb-1";

/** Duração do vídeo, lida no navegador antes de subir. */
function duracaoDoVideo(f: File): Promise<number | null> {
  return new Promise((ok) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      ok(Number.isFinite(v.duration) ? Math.ceil(v.duration) : null);
    };
    v.onerror = () => ok(null);
    v.src = URL.createObjectURL(f);
  });
}

/**
 * O combinado com o parceiro: em que quadro, que tipo de inserção, quando,
 * por quanto tempo e quantas vezes. Vídeo e arte sobem direto para o Storage.
 */
export default function CotaForm({
  parceiros,
  quadros,
  inicial,
}: {
  parceiros: { id: string; name: string; plan: string | null; active: boolean }[];
  quadros: { id: string; nome: string; modalidades: string[] }[];
  inicial?: CotaInicial;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [quadro, setQuadro] = useState(inicial?.quadro ?? quadros[0]?.id ?? "");
  const [tipo, setTipo] = useState<TipoInsercao>(inicial?.tipo ?? "faixa");
  const [momento, setMomento] = useState<Momento>(inicial?.momento ?? "durante");
  const [freq, setFreq] = useState(inicial?.a_cada_min ? "minutos" : "vezes");
  const [duracao, setDuracao] = useState(String(inicial?.duracao_s ?? TIPOS.faixa.duracao));
  const [removerMidia, setRemoverMidia] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const mods = quadros.find((q) => q.id === quadro)?.modalidades ?? [];
  const momentos = (Object.keys(MOMENTOS) as Momento[]).filter((m) => m !== "continuo" || tipo === "logo");

  async function onArquivo() {
    const f = fileRef.current?.files?.[0];
    if (f?.type.startsWith("video/")) {
      const d = await duracaoDoVideo(f);
      if (d) setDuracao(String(d));
    }
  }

  async function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const form = new FormData(ev.currentTarget);
    setEnviando(true);
    setErro(null);
    setStatus(null);
    try {
      const f = fileRef.current?.files?.[0];
      if (f) {
        setStatus(`Enviando ${f.name}...`);
        const mime = f.type || "application/octet-stream";
        const p = await pedirUploadAction(f.name, mime, f.size);
        if (!p.ok) throw new Error(p.error);
        const { error } = await createBrowserSupabase()
          .storage.from("producao")
          .uploadToSignedUrl(p.path, p.token, f, { contentType: mime });
        if (error) throw new Error(error.message);
        form.set("midia_path", p.path);
        form.set("midia_mime", mime);
      }
      const r = await salvarCotaAction(form);
      if (!r.ok) throw new Error(r.error ?? "Não salvou.");
      setStatus("Salvo.");
      router.push("/admin/ao-vivo?aba=cotas");
      router.refresh();
    } catch (x) {
      setStatus(null);
      setErro(x instanceof Error ? x.message : String(x));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="bg-[#121212] border border-[#242424] rounded-xl p-4 space-y-4">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      {inicial?.midia_path && !removerMidia && (
        <>
          <input type="hidden" name="midia_path" value={inicial.midia_path} />
          <input type="hidden" name="midia_mime" value={inicial.midia_mime ?? ""} />
        </>
      )}
      {removerMidia && <input type="hidden" name="remover_midia" value="1" />}

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={rotulo}>Parceiro</span>
          <select name="partner_id" defaultValue={inicial?.partner_id ?? ""} className={input} required>
            <option value="">Escolha...</option>
            {parceiros.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.plan ? ` · ${p.plan}` : ""}
                {p.active ? "" : " (inativo)"}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={rotulo}>Quadro</span>
          <select name="quadro" value={quadro} onChange={(e) => setQuadro(e.target.value)} className={input}>
            {quadros.map((q) => (
              <option key={q.id} value={q.id}>
                {q.nome}
              </option>
            ))}
          </select>
        </label>
        {mods.length > 0 ? (
          <label>
            <span className={rotulo}>Modalidade</span>
            <select name="modalidade" defaultValue={inicial?.modalidade ?? ""} className={input}>
              <option value="">Todos os episódios</option>
              {mods.map((m) => (
                <option key={m} value={m}>
                  Só {m}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className={rotulo}>Tipo</span>
          <select
            name="tipo"
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoInsercao;
              setTipo(t);
              setDuracao(String(TIPOS[t].duracao));
              if (t !== "logo" && momento === "continuo") setMomento("durante");
            }}
            className={input}
          >
            {(Object.keys(TIPOS) as TipoInsercao[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS[t].label}
              </option>
            ))}
          </select>
          <span className="block text-[11px] text-white/35 mt-1">{TIPOS[tipo].dica}</span>
        </label>
        <label>
          <span className={rotulo}>Quando</span>
          <select name="momento" value={momento} onChange={(e) => setMomento(e.target.value as Momento)} className={input}>
            {momentos.map((m) => (
              <option key={m} value={m}>
                {MOMENTOS[m]}
              </option>
            ))}
          </select>
        </label>
        {momento !== "continuo" && (
          <label>
            <span className={rotulo}>Duração (segundos)</span>
            <input name="duracao_s" type="number" min={3} max={600} value={duracao} onChange={(e) => setDuracao(e.target.value)} className={input} />
          </label>
        )}
      </div>

      {momento === "durante" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label>
            <span className={rotulo}>Frequência</span>
            <select name="freq" value={freq} onChange={(e) => setFreq(e.target.value)} className={input}>
              <option value="vezes">Vezes por episódio</option>
              <option value="minutos">A cada N minutos</option>
            </select>
          </label>
          <label>
            <span className={rotulo}>{freq === "minutos" ? "A cada (min)" : "Vezes"}</span>
            <input
              name="freq_n"
              type="number"
              min={1}
              max={freq === "minutos" ? 180 : 30}
              defaultValue={inicial?.a_cada_min ?? inicial?.vezes ?? 3}
              className={input}
            />
          </label>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {tipo !== "vinheta" && (
          <label className="sm:col-span-2">
            <span className={rotulo}>
              {tipo === "faixa" ? "Frase da faixa" : tipo === "qr" ? "Chamada do QR" : "Rótulo acima do logo"}
            </span>
            <input
              name="texto"
              maxLength={140}
              defaultValue={inicial?.texto ?? ""}
              placeholder={
                tipo === "faixa"
                  ? "Ex.: 20% off na primeira consulta"
                  : tipo === "qr"
                    ? "Aponte a câmera do celular"
                    : "Oferecimento / Apresentado por"
              }
              className={input}
            />
          </label>
        )}
        {tipo === "logo" && (
          <label>
            <span className={rotulo}>Canto</span>
            <select name="posicao" defaultValue={inicial?.posicao ?? "inferior-direito"} className={input}>
              {Object.entries(POSICOES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div>
        <span className={rotulo}>
          {tipo === "vinheta" ? "Vídeo da vinheta (obrigatório, até 50 MB)" : "Arte própria (opcional: substitui a arte gerada)"}
        </span>
        {inicial?.midia_path && !removerMidia && (
          <p className="text-xs text-white/60 mb-1">
            Arquivo atual: {inicial.midia_path.split("/").pop()} ({inicial.midia_mime}){" "}
            {tipo !== "vinheta" && (
              <button type="button" onClick={() => setRemoverMidia(true)} className="text-red-300 underline">
                remover
              </button>
            )}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept={tipo === "vinheta" ? "video/*" : "image/*"}
          onChange={onArquivo}
          className="text-xs text-white/60"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          <span className={rotulo}>Vale de</span>
          <input name="inicio" type="date" defaultValue={inicial?.inicio ?? ""} className={input} />
        </label>
        <label>
          <span className={rotulo}>Até</span>
          <input name="fim" type="date" defaultValue={inicial?.fim ?? ""} className={input} />
        </label>
        <label>
          <span className={rotulo}>Prioridade</span>
          <select name="prioridade" defaultValue={String(inicial?.prioridade ?? 0)} className={input}>
            <option value="10">Master (entra antes)</option>
            <option value="5">Patrocinador</option>
            <option value="0">Apoio</option>
          </select>
        </label>
        <label>
          <span className={rotulo}>Observação interna</span>
          <input name="observacao" defaultValue={inicial?.observacao ?? ""} className={input} />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="bg-gold-500 text-black font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-50 disabled:cursor-wait"
        >
          {enviando ? "Salvando..." : inicial ? "Salvar alterações" : "Criar cota"}
        </button>
        {inicial && (
          <a href="/admin/ao-vivo?aba=cotas" className="text-sm text-white/50 hover:text-white">
            Cancelar
          </a>
        )}
        {status && <span className="text-emerald-400 text-xs">{status}</span>}
        {erro && <span className="text-red-400 text-xs">{erro}</span>}
      </div>
    </form>
  );
}
