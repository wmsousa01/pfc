import "server-only";
import { BUCKET, db, signedUrls } from "@/lib/producao/store";
import { driveUrl } from "@/lib/agenda/video";

export { db };

export type Objetivo = "alcance" | "trafego" | "video";
export type Plataforma = "meta" | "google";
export type EstrategiaStatus = "rascunho" | "ativa" | "pausada" | "encerrada";
export type Origem = "drive" | "upload" | "contenta" | "gerado";
export type Formato = "9:16" | "4:5" | "1:1" | "16:9";
export type EntregaStatus = "rascunho" | "aprovado" | "enviando" | "no_gerenciador" | "erro";

export const OBJETIVOS: Record<Objetivo, { label: string; detalhe: string }> = {
  alcance: { label: "Alcance", detalhe: "Aparecer para o máximo de gente da região (Meta: REACH)" },
  trafego: { label: "Tráfego / leads", detalhe: "Cliques para a landing com formulário (Meta: LINK_CLICKS)" },
  video: { label: "Visualização de vídeo", detalhe: "Gente assistindo até o fim (Meta: THRUPLAY) — só vídeo" },
};

/** Botões de ação aceitos pela Meta que fazem sentido para o PFC. */
export const CTAS: Record<string, string> = {
  LEARN_MORE: "Saiba mais",
  SIGN_UP: "Cadastre-se",
  CONTACT_US: "Fale conosco",
  WATCH_MORE: "Assistir mais",
  GET_QUOTE: "Pedir orçamento",
};

export const FORMATOS: Formato[] = ["9:16", "4:5", "1:1", "16:9"];

export type Estrategia = {
  id: string;
  nome: string;
  objetivo: Objetivo;
  plataformas: Plataforma[];
  publico: string;
  oferta: string;
  mensagem: string;
  angulos: string[];
  link: string | null;
  cta: string;
  geo_lat: number;
  geo_lng: number;
  geo_raio_km: number;
  idade_min: number;
  idade_max: number;
  /** Centavos de real. */
  orcamento_diario: number;
  inicio: string | null;
  fim: string | null;
  kpi: string;
  status: EstrategiaStatus;
  meta_campaign_id: string | null;
  meta_adset_id: string | null;
  google_campaign_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Nota de 0 a 100 por critério, com o porquê. */
export type Criterio = { nota: number; comentario: string };

export type Analise = {
  nota: number;
  resumo: string;
  gancho: Criterio;
  clareza: Criterio;
  ritmo: Criterio;
  cta: Criterio;
  formato: Criterio;
  alinhamento: Criterio;
  pontos_fortes: string[];
  problemas: string[];
  sugestoes: string[];
  riscos_politica: string[];
  posicionamentos: string[];
  copy: { headline: string; texto: string };
  /** Estratégia usada como contexto, quando houve. */
  estrategia?: string;
  modelo: string;
};

export type Criativo = {
  id: string;
  nome: string;
  tipo: "video" | "imagem";
  origem: Origem;
  ref: string;
  thumb_url: string | null;
  mime: string | null;
  tamanho: number | null;
  duracao_s: number | null;
  formato: Formato | null;
  /** Código da peça do plano que o criativo cumpre (plano.ts); null = avulso. */
  peca: string | null;
  gerado_com: Record<string, unknown> | null;
  analise: Analise | null;
  analise_nota: number | null;
  analisado_em: string | null;
  arquivado: boolean;
  created_by: string | null;
  created_at: string;
};

/** Métricas normalizadas das duas redes; valores em reais. */
export type Metricas = {
  gasto?: number;
  impressoes?: number;
  alcance?: number;
  cliques?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
  thruplays?: number;
  conversoes?: number;
  erro?: string;
};

export type Entrega = {
  id: string;
  estrategia_id: string;
  criativo_id: string;
  plataforma: Plataforma;
  angulo: string | null;
  headline: string;
  texto: string;
  status: EntregaStatus;
  analise: Analise | null;
  analise_nota: number | null;
  meta_video_id: string | null;
  meta_image_hash: string | null;
  meta_creative_id: string | null;
  meta_ad_id: string | null;
  google_ad_id: string | null;
  erro: string | null;
  metrics: Metricas | null;
  metrics_at: string | null;
  aprovado_por: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const CAMPANHAS_DIR = "campanhas";

export async function listEstrategias(): Promise<Estrategia[] | null> {
  const { data, error } = await db().from("mkt_estrategias").select("*").order("created_at", { ascending: false });
  return error ? null : ((data ?? []) as Estrategia[]);
}

export async function getEstrategia(id: string): Promise<Estrategia | null> {
  const { data } = await db().from("mkt_estrategias").select("*").eq("id", id).maybeSingle();
  return (data as Estrategia) ?? null;
}

export async function updateEstrategia(id: string, patch: Partial<Estrategia>): Promise<void> {
  const { error } = await db()
    .from("mkt_estrategias")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listCriativos(): Promise<Criativo[]> {
  const { data } = await db()
    .from("mkt_criativos")
    .select("*")
    .eq("arquivado", false)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []) as Criativo[];
}

export async function getCriativo(id: string): Promise<Criativo | null> {
  const { data } = await db().from("mkt_criativos").select("*").eq("id", id).maybeSingle();
  return (data as Criativo) ?? null;
}

export async function updateCriativo(id: string, patch: Partial<Criativo>): Promise<void> {
  const { error } = await db().from("mkt_criativos").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Grava o criativo; se o mesmo arquivo já está na biblioteca, devolve o existente. */
export async function addCriativo(
  c: Omit<Criativo, "id" | "created_at" | "analise" | "analise_nota" | "analisado_em" | "arquivado" | "peca"> & { peca?: string | null }
): Promise<Criativo> {
  const { data: existing } = await db().from("mkt_criativos").select("*").eq("origem", c.origem).eq("ref", c.ref).maybeSingle();
  if (existing) {
    if ((existing as Criativo).arquivado) await updateCriativo(existing.id, { arquivado: false });
    return existing as Criativo;
  }
  const { data, error } = await db().from("mkt_criativos").insert(c).select("*").single();
  if (error) throw new Error(error.message);
  return data as Criativo;
}

export async function listEntregas(estrategiaId?: string): Promise<Entrega[]> {
  let q = db().from("mkt_entregas").select("*").order("created_at", { ascending: true });
  if (estrategiaId) q = q.eq("estrategia_id", estrategiaId);
  const { data } = await q;
  return (data ?? []) as Entrega[];
}

export async function getEntrega(id: string): Promise<Entrega | null> {
  const { data } = await db().from("mkt_entregas").select("*").eq("id", id).maybeSingle();
  return (data as Entrega) ?? null;
}

export async function updateEntrega(id: string, patch: Partial<Entrega>): Promise<void> {
  const { error } = await db()
    .from("mkt_entregas")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * URL que um serviço de fora (Meta, Gemini) consegue baixar. Contenta e Drive
 * já são públicos; arquivo do Storage vai por URL assinada de 6 h, tempo de
 * sobra para a Meta processar o vídeo.
 */
export async function urlPublica(c: Criativo): Promise<string> {
  if (c.origem === "contenta") return c.ref;
  if (c.origem === "drive") return driveUrl(c.ref);
  const { data, error } = await db().storage.from(BUCKET).createSignedUrl(c.ref, 6 * 3600);
  if (error || !data) throw new Error(`Storage: ${error?.message ?? "sem URL"}`);
  return data.signedUrl;
}

/** Miniatura para o painel: a pública quando há, senão a própria imagem assinada. */
export async function previews(criativos: Criativo[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const doStorage = criativos.filter((c) => (c.origem === "upload" || c.origem === "gerado") && !c.thumb_url);
  const signed = await signedUrls(doStorage.map((c) => c.ref));
  for (const c of criativos) {
    const u = c.thumb_url ?? signed.get(c.ref);
    if (u) out.set(c.id, u);
  }
  return out;
}

/** Baixa o arquivo inteiro (para o Gemini ou para a Meta em bytes). */
export async function bytesDe(c: Criativo, max = 300 * 1024 * 1024): Promise<{ buf: Buffer; mime: string }> {
  if (c.origem === "upload" || c.origem === "gerado") {
    const { data } = await db().storage.from(BUCKET).download(c.ref);
    if (!data) throw new Error("Arquivo não encontrado no Storage.");
    return { buf: Buffer.from(await data.arrayBuffer()), mime: c.mime ?? data.type ?? "application/octet-stream" };
  }
  const res = await fetch(await urlPublica(c), { cache: "no-store", signal: AbortSignal.timeout(180_000) });
  if (!res.ok) throw new Error(`Não consegui baixar o criativo (${res.status}). No Drive, o arquivo precisa estar com link público.`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > max) throw new Error(`Arquivo com ${(len / 1e6).toFixed(0)} MB: o limite para análise é ${max / 1e6} MB.`);
  const type = res.headers.get("content-type") ?? "";
  // O Drive responde text/html quando o link não é público.
  if (type.includes("text/html")) throw new Error("O Drive devolveu uma página em vez do arquivo: deixe o link público.");
  return { buf: Buffer.from(await res.arrayBuffer()), mime: c.mime ?? (type || "application/octet-stream") };
}

export const reais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
