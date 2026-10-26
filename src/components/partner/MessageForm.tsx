"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";
import {
  prepareUploadAction,
  sendMessageAction,
} from "@/app/parceiros/[slug]/painel/actions";

type Theme = {
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  border: string;
  surfaceStrong: string;
  primary: string;
  onPrimary: string;
  radius: number | string;
};

const ACCEPT =
  "image/png,image/jpeg,image/webp,image/heic,image/svg+xml,application/pdf,video/mp4,video/quicktime,application/zip,.docx,.xlsx,.pptx";

function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/**
 * Envio em dois passos: o servidor assina uma URL por arquivo, o navegador
 * sobe direto no Storage (sem o limite de 4,5 MB das funções) e só então a
 * mensagem é publicada com os arquivos já confirmados.
 */
export default function MessageForm({ token, t }: { token: string; t: Theme }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const prep = await prepareUploadAction(
        token,
        files.map((f) => ({ name: f.name, size: f.size, type: f.type }))
      );
      if (!prep.ok) throw new Error(prep.error);

      const supabase = createBrowserSupabase();
      for (let i = 0; i < prep.targets.length; i++) {
        const target = prep.targets[i];
        setStatus(`Enviando ${i + 1} de ${prep.targets.length}: ${target.name}`);
        const { error: upErr } = await supabase.storage
          .from("client-files")
          .uploadToSignedUrl(target.path, target.token, files[i], {
            contentType: files[i].type,
          });
        if (upErr) throw new Error(`Falha ao enviar "${target.name}". Tente de novo.`);
      }

      setStatus("Publicando a mensagem…");
      const sent = await sendMessageAction(
        token,
        text,
        prep.targets.map((tg) => ({ path: tg.path, name: tg.name }))
      );
      if (!sent.ok) throw new Error(sent.error ?? "Não foi possível enviar.");

      setText("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar.");
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Escreva para a equipe do PFC: ideias, dados de um imóvel, dúvidas…"
        className="w-full px-4 py-3 text-base outline-none resize-y"
        style={{
          backgroundColor: t.surfaceStrong,
          border: `1px solid ${t.border}`,
          borderRadius: t.radius,
          color: t.fg,
        }}
      />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm" style={{ color: t.fgMuted }}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3">
              <span className="truncate">📎 {f.name}</span>
              <span className="flex items-center gap-3 flex-shrink-0" style={{ color: t.fgSubtle }}>
                {mb(f.size)}
                <button
                  type="button"
                  onClick={() => setFiles(files.filter((_, j) => j !== i))}
                  aria-label={`Remover ${f.name}`}
                  disabled={busy}
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          className="text-sm font-semibold px-4 py-2.5 cursor-pointer"
          style={{ border: `1px solid ${t.border}`, borderRadius: t.radius, color: t.fg }}
        >
          Anexar arquivos
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            disabled={busy}
            onChange={(e) => setFiles([...files, ...Array.from(e.target.files ?? [])].slice(0, 10))}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-3 font-bold text-sm disabled:opacity-60"
          style={{ backgroundColor: t.primary, color: t.onPrimary, borderRadius: t.radius }}
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>

      <p className="text-xs" style={{ color: t.fgSubtle }}>
        Fotos, PDF, vídeo MP4/MOV, ZIP ou Office · até 50 MB por arquivo, 10 por mensagem.
      </p>
      {status && (
        <p className="text-sm" style={{ color: t.fgMuted }}>
          {status}
        </p>
      )}
      {error && (
        <p className="text-sm font-semibold" style={{ color: "#f87171" }}>
          {error}
        </p>
      )}
    </form>
  );
}
