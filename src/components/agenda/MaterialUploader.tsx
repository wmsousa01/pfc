"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/app/admin/producao/actions";
import { createBrowserSupabase } from "@/lib/supabase/client";

type Upload = { ok: true; path: string; token: string } | { ok: false; error: string };
type Opcao = { value: string; label: string };

/**
 * Envio de materiais direto do navegador para o Storage (URL assinada): o
 * arquivo não passa pela função da Vercel, que recusa corpo acima de 4,5 MB.
 * `pedir` e `registrar` são server actions já ligadas ao episódio/convidado.
 */
export default function MaterialUploader({
  pedir,
  registrar,
  tipos,
  alvos,
  inputCls,
  buttonCls,
}: {
  pedir: (nome: string, mime: string, tamanho: number) => Promise<Upload>;
  registrar: (path: string, nome: string, mime: string, tipo: string, alvo: string | null) => Promise<ActionState>;
  tipos: Opcao[];
  /** De quem é o arquivo (admin): convidado ou apresentador. */
  alvos?: Opcao[];
  inputCls: string;
  buttonCls: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipo, setTipo] = useState(tipos[0]?.value ?? "foto");
  const [alvo, setAlvo] = useState(alvos?.[0]?.value ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) {
      setErro("Escolha os arquivos.");
      return;
    }
    setEnviando(true);
    setErro(null);
    const supabase = createBrowserSupabase();
    let feitos = 0;
    try {
      for (const f of files) {
        setStatus(`Enviando ${f.name} (${feitos + 1} de ${files.length})...`);
        const mime = f.type || "application/octet-stream";
        const p = await pedir(f.name, mime, f.size);
        if (!p.ok) throw new Error(`${f.name}: ${p.error}`);
        const { error } = await supabase.storage.from("producao").uploadToSignedUrl(p.path, p.token, f, { contentType: mime });
        if (error) throw new Error(`${f.name}: ${error.message}`);
        const r = await registrar(p.path, f.name, mime, tipo, alvo || null);
        if (!r.ok) throw new Error(`${f.name}: ${r.error}`);
        feitos++;
      }
      setStatus(`${feitos} ${feitos === 1 ? "arquivo enviado" : "arquivos enviados"}.`);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e) {
      setStatus(feitos ? `${feitos} enviado(s) antes do erro.` : null);
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setEnviando(false);
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputCls}>
          {tipos.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        {alvos && alvos.length > 0 && (
          <select value={alvo} onChange={(e) => setAlvo(e.target.value)} className={inputCls}>
            {alvos.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        )}
        <input ref={fileRef} type="file" multiple accept="image/*,video/*,application/pdf" className="text-xs text-white/60 max-w-[16rem]" />
        <button type="button" onClick={enviar} disabled={enviando} className={`${buttonCls} disabled:opacity-50 disabled:cursor-wait`}>
          {enviando ? "Enviando..." : "Enviar"}
        </button>
      </div>
      {status && <p className="text-emerald-400 text-xs">{status}</p>}
      {erro && <p className="text-red-400 text-xs break-words">{erro}</p>}
    </div>
  );
}
