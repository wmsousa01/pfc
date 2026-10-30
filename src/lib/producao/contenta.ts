import "server-only";

/**
 * Rota interna do Contenta (/api/internal/hub): dispara cortes na conta do PFC
 * e lista os jobs dela. O dono dos jobs é fixado do lado do Contenta
 * (HUB_OWNER_ID); daqui só vai o segredo compartilhado.
 */
const BASE = (process.env.CONTENTA_HUB_URL || "https://www.contentaai.com.br").replace(/\/$/, "");

export function isContentaConfigured(): boolean {
  return !!process.env.CONTENTA_HUB_SECRET;
}

export type ContentaJob = {
  jobId: string;
  status: "done" | "processing";
  runStatus: string | null;
  totalCuts: number;
  createdAt: string | null;
  videoSource: string | null;
};

export type CutMode = "shorts" | "long";

export const MODES: Record<CutMode, { label: string; cutMode: string; outputFormat: string; subtitles?: boolean }> = {
  shorts: { label: "Shorts 9:16", cutMode: "shorts", outputFormat: "portrait", subtitles: true },
  long: { label: "Longos 16:9", cutMode: "long", outputFormat: "landscape" },
};

/** Run que terminou sem entregar o meta.json — o job morreu. */
const RUN_FAILED = new Set(["FAILED", "CRASHED", "SYSTEM_FAILURE", "TIMED_OUT", "CANCELED", "INTERRUPTED", "EXPIRED"]);

export function jobFailed(j: ContentaJob): boolean {
  return j.status === "processing" && !!j.runStatus && RUN_FAILED.has(j.runStatus);
}

export function contentaJobUrl(jobId: string): string {
  return `${BASE}/cuts?jobId=${jobId}`;
}

async function call<T>(init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}/api/internal/hub`, {
    ...init,
    headers: {
      "x-internal-secret": process.env.CONTENTA_HUB_SECRET ?? "",
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Contenta ${res.status}: ${json.error ?? "erro"}${json.detail ? ` (${json.detail})` : ""}`);
  return json as T;
}

export async function listContentaJobs(): Promise<ContentaJob[]> {
  return (await call<{ items: ContentaJob[] }>()).items;
}

/** Enfileira um job. Repetir com o mesmo jobId devolve o mesmo run. */
export async function startCuts(youtubeId: string, jobId: string, mode: CutMode): Promise<string> {
  const m = MODES[mode];
  const r = await call<{ runId: string }>({
    method: "POST",
    body: JSON.stringify({
      videoSource: `https://www.youtube.com/watch?v=${youtubeId}`,
      jobId,
      cutMode: m.cutMode,
      outputFormat: m.outputFormat,
      subtitles: m.subtitles,
    }),
  });
  return r.runId;
}
