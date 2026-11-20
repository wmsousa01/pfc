"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Res<T> = ({ ok: true } & T) | { ok: false; error: string };
export type Inicio = { id: string; parteBytes: number; partes: number };

/** Server actions já ligadas à pasta (admin) ou ao token do link (quem é de fora). */
export type AcoesDeEnvio = {
  iniciar: (nome: string, mime: string, tamanho: number, remetente: string) => Promise<Res<Inicio>>;
  retomar: (id: string) => Promise<Res<Inicio & { prontas: number[] }>>;
  urls: (id: string, numeros: number[]) => Promise<Res<{ urls: { numero: number; url: string }[] }>>;
  concluir: (id: string) => Promise<Res<object>>;
  cancelar: (id: string) => Promise<Res<object>>;
};

type Item = {
  key: string;
  file: File;
  enviados: number;
  status: "fila" | "enviando" | "concluindo" | "pronto" | "erro" | "cancelado";
  erro?: string;
  inicio?: number;
  base?: number;
};

const PARALELO = 4;
const TENTATIVAS = 5;

function legivel(b: number): string {
  const GB = 1024 ** 3, MB = 1024 ** 2;
  if (b >= GB) return `${(b / GB).toFixed(1)} GB`;
  if (b >= MB) return `${(b / MB).toFixed(b >= 10 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

function tempo(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "";
  if (s < 60) return `${Math.ceil(s)} s`;
  if (s < 3600) return `${Math.ceil(s / 60)} min`;
  return `${Math.floor(s / 3600)} h ${Math.ceil((s % 3600) / 60)} min`;
}

// O envio aberto fica guardado por arquivo: se a página fechar, escolher o mesmo arquivo de novo continua de onde parou.
const chaveLocal = (escopo: string, f: File) => `pfc-envio:${escopo}:${f.name}:${f.size}:${f.lastModified}`;
function lerLocal(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function gravarLocal(k: string, v: string | null) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch {
    /* modo privado: segue sem retomada */
  }
}

/** PUT de uma parte, com progresso. Resolve no fim; rejeita com o status HTTP. */
function enviarParte(url: string, blob: Blob, progresso: (n: number) => void, xhrs: Set<XMLHttpRequest>): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    xhrs.add(x);
    x.open("PUT", url);
    x.upload.onprogress = (e) => progresso(e.loaded);
    x.onload = () => {
      xhrs.delete(x);
      if (x.status >= 200 && x.status < 300) resolve();
      else reject(Object.assign(new Error(`O R2 recusou a parte (${x.status}).`), { status: x.status }));
    };
    x.onerror = () => {
      xhrs.delete(x);
      reject(Object.assign(new Error("Conexão caiu."), { status: 0 }));
    };
    x.onabort = () => {
      xhrs.delete(x);
      reject(Object.assign(new Error("Cancelado."), { status: -1 }));
    };
    x.send(blob);
  });
}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function EnvioGrande({
  acoes,
  escopo,
  pedirRemetente = false,
  maxBytes,
  inputCls,
  buttonCls,
}: {
  acoes: AcoesDeEnvio;
  /** Separa a retomada por pasta/link. */
  escopo: string;
  /** Link de fora: pede o nome de quem envia. */
  pedirRemetente?: boolean;
  maxBytes?: number | null;
  inputCls: string;
  buttonCls: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<Item[]>([]);
  const [remetente, setRemetente] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cancelados = useRef(new Set<string>());
  const xhrs = useRef(new Map<string, Set<XMLHttpRequest>>());

  useEffect(() => {
    try {
      setRemetente(localStorage.getItem("pfc-envio:remetente") ?? "");
    } catch {
      /* sem storage */
    }
  }, []);

  // Fechar a aba no meio do envio perde o que está subindo (o resto retoma depois).
  useEffect(() => {
    if (!rodando) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [rodando]);

  const atualizar = (key: string, patch: Partial<Item>) => setItens((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function enviarUm(item: Item) {
    const f = item.file;
    const local = chaveLocal(escopo, f);
    const mime = f.type || "application/octet-stream";

    // Retoma o envio guardado, se o servidor ainda o tiver aberto.
    let ini: Inicio | null = null;
    let prontas = new Set<number>();
    const guardado = lerLocal(local);
    if (guardado) {
      const r = await acoes.retomar(guardado);
      if (r.ok) {
        ini = { id: r.id, parteBytes: r.parteBytes, partes: r.partes };
        prontas = new Set(r.prontas);
      } else gravarLocal(local, null);
    }
    if (!ini) {
      const r = await acoes.iniciar(f.name, mime, f.size, remetente.trim());
      if (!r.ok) throw new Error(r.error);
      ini = { id: r.id, parteBytes: r.parteBytes, partes: r.partes };
      gravarLocal(local, ini.id);
    }
    const { id, parteBytes, partes } = ini;

    const tamanhoDa = (n: number) => Math.min(parteBytes, f.size - (n - 1) * parteBytes);
    let feitos = Array.from(prontas).reduce((s, n) => s + tamanhoDa(n), 0);
    atualizar(item.key, { status: "enviando", enviados: feitos, inicio: Date.now(), base: feitos });

    const fila = Array.from({ length: partes }, (_, i) => i + 1).filter((n) => !prontas.has(n));
    const urls = new Map<number, string>();
    const emAndamento = new Map<number, number>();
    const meus = new Set<XMLHttpRequest>();
    xhrs.current.set(item.key, meus);

    async function urlDa(n: number, renovar = false): Promise<string> {
      if (!renovar && urls.has(n)) return urls.get(n)!;
      const lote = [n, ...fila.slice(0, 19)].filter((x, i, a) => a.indexOf(x) === i && (renovar ? x === n : !urls.has(x)));
      const r = await acoes.urls(id, lote);
      if (!r.ok) throw new Error(r.error);
      for (const u of r.urls) urls.set(u.numero, u.url);
      if (!urls.has(n)) throw new Error(`Sem link para a parte ${n}.`);
      return urls.get(n)!;
    }

    const mostrar = () => atualizar(item.key, { enviados: feitos + Array.from(emAndamento.values()).reduce((s, v) => s + v, 0) });

    async function trabalhador() {
      for (;;) {
        if (cancelados.current.has(item.key)) return;
        const n = fila.shift();
        if (n === undefined) return;
        const blob = f.slice((n - 1) * parteBytes, (n - 1) * parteBytes + tamanhoDa(n));
        for (let t = 1; ; t++) {
          try {
            const url = await urlDa(n, t > 1);
            emAndamento.set(n, 0);
            await enviarParte(url, blob, (b) => {
              emAndamento.set(n, b);
              mostrar();
            }, meus);
            emAndamento.delete(n);
            feitos += blob.size;
            mostrar();
            break;
          } catch (e) {
            emAndamento.delete(n);
            mostrar();
            const status = (e as { status?: number }).status;
            if (status === -1 || cancelados.current.has(item.key)) return;
            if (t >= TENTATIVAS) throw e;
            await espera(1000 * 2 ** t);
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(PARALELO, Math.max(1, fila.length)) }, trabalhador));
    xhrs.current.delete(item.key);
    if (cancelados.current.has(item.key)) {
      await acoes.cancelar(id);
      gravarLocal(local, null);
      atualizar(item.key, { status: "cancelado" });
      return;
    }
    atualizar(item.key, { status: "concluindo", enviados: f.size });
    const c = await acoes.concluir(id);
    if (!c.ok) throw new Error(c.error);
    gravarLocal(local, null);
    atualizar(item.key, { status: "pronto" });
  }

  async function enviar() {
    setErro(null);
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) return setErro("Escolha os arquivos.");
    if (pedirRemetente && remetente.trim().length < 2) return setErro("Diga seu nome, para a produção saber de quem é o arquivo.");
    const grande = maxBytes ? files.find((f) => f.size > maxBytes) : null;
    if (grande) return setErro(`${grande.name} passa do limite de ${legivel(maxBytes!)} deste link.`);
    if (pedirRemetente) {
      try {
        localStorage.setItem("pfc-envio:remetente", remetente.trim());
      } catch {
        /* sem storage */
      }
    }

    const novos: Item[] = files.map((file) => ({ key: `${file.name}:${file.size}:${file.lastModified}:${Math.random()}`, file, enviados: 0, status: "fila" }));
    setItens((l) => [...novos, ...l]);
    if (fileRef.current) fileRef.current.value = "";
    setRodando(true);
    for (const item of novos) {
      if (cancelados.current.has(item.key)) {
        atualizar(item.key, { status: "cancelado" });
        continue;
      }
      try {
        await enviarUm(item);
      } catch (e) {
        atualizar(item.key, { status: "erro", erro: e instanceof Error ? e.message : String(e) });
      }
    }
    setRodando(false);
    router.refresh();
  }

  function cancelar(key: string) {
    cancelados.current.add(key);
    for (const x of Array.from(xhrs.current.get(key) ?? [])) x.abort();
    setItens((l) => l.map((i) => (i.key === key && i.status === "fila" ? { ...i, status: "cancelado" } : i)));
  }

  return (
    <div className="space-y-3">
      {pedirRemetente && (
        <input
          value={remetente}
          onChange={(e) => setRemetente(e.target.value)}
          maxLength={120}
          placeholder="Seu nome *"
          className={`${inputCls} w-full`}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" multiple className="text-sm text-white/60 max-w-full" />
        <button type="button" onClick={enviar} disabled={rodando} className={`${buttonCls} disabled:opacity-50 disabled:cursor-wait`}>
          {rodando ? "Enviando..." : "Enviar"}
        </button>
      </div>
      <p className="text-white/35 text-xs">
        Arquivos grandes sobem em partes. Se a conexão cair ou a página fechar, escolha o mesmo arquivo de novo: o envio continua de
        onde parou.
      </p>
      {erro && <p className="text-red-400 text-xs">{erro}</p>}

      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((i) => {
            const pct = i.file.size ? Math.min(100, (i.enviados / i.file.size) * 100) : 0;
            const seg = i.inicio ? (Date.now() - i.inicio) / 1000 : 0;
            const vel = seg > 2 ? (i.enviados - (i.base ?? 0)) / seg : 0;
            const resta = vel > 0 ? (i.file.size - i.enviados) / vel : NaN;
            return (
              <li key={i.key} className="bg-[#0a0a0a] border border-[#222] rounded-lg p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-white truncate">{i.file.name}</span>
                  <span className="text-white/40 whitespace-nowrap">
                    {i.status === "enviando" && `${legivel(i.enviados)} de ${legivel(i.file.size)}${vel ? ` · ${legivel(vel)}/s · falta ${tempo(resta)}` : ""}`}
                    {i.status === "fila" && `${legivel(i.file.size)} · na fila`}
                    {i.status === "concluindo" && "conferindo..."}
                    {i.status === "pronto" && <span className="text-emerald-400">enviado</span>}
                    {i.status === "cancelado" && "cancelado"}
                    {i.status === "erro" && <span className="text-red-400">erro</span>}
                  </span>
                </div>
                {(i.status === "enviando" || i.status === "concluindo" || i.status === "fila") && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-gold-500 transition-[width]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-white/50 w-10 text-right">{Math.floor(pct)}%</span>
                    {i.status !== "concluindo" && (
                      <button type="button" onClick={() => cancelar(i.key)} className="text-white/30 hover:text-red-400">
                        cancelar
                      </button>
                    )}
                  </div>
                )}
                {i.erro && <p className="text-red-400 mt-1 break-words">{i.erro} Escolha o arquivo de novo para continuar.</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
