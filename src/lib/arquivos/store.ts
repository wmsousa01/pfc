import "server-only";
import { randomUUID } from "crypto";
import { db, newToken } from "@/lib/agenda/store";
import {
  cancelarEnvioEmPartes,
  concluirEnvioEmPartes,
  info,
  iniciarEnvioEmPartes,
  partesEnviadas,
  remover,
  urlAssinada,
  urlDeParte,
} from "@/lib/storage";

/**
 * Central de arquivos: pastas, arquivos grandes no R2 (área "arquivos/") e
 * links de envio para quem é de fora. O arquivo sobe em partes direto do
 * navegador; o banco guarda o envio aberto (upload_id) até ele ser concluído.
 */

const AREA = "arquivos" as const;
const MB = 1024 * 1024;
const GB = 1024 * MB;
/** Teto de sanidade por arquivo (o R2 aceita até ~5 TB). */
export const MAX_ARQUIVO = 500 * GB;
/** Parte mínima de 32 MB; cresce para o arquivo caber em até 9.500 partes (o limite é 10.000). */
const PARTE_MIN = 32 * MB;

export type Pasta = { id: string; parent_id: string | null; nome: string; created_by: string | null; created_at: string };

export type Arquivo = {
  id: string;
  pasta_id: string;
  link_id: string | null;
  nome: string;
  path: string;
  mime: string;
  tamanho: number;
  parte_bytes: number;
  upload_id: string | null;
  status: "enviando" | "pronto";
  enviado_por: string;
  created_at: string;
  concluido_em: string | null;
};

export type LinkEnvio = {
  id: string;
  token: string;
  pasta_id: string;
  titulo: string;
  mensagem: string | null;
  expira_em: string;
  max_arquivo: number | null;
  ativo: boolean;
  created_by: string | null;
  created_at: string;
};

function nomeSeguro(nome: string): string {
  const s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-100);
  return s || "arquivo";
}

export const totalDePartes = (a: Pick<Arquivo, "tamanho" | "parte_bytes">) => Math.max(1, Math.ceil(a.tamanho / a.parte_bytes));

export function tamanhoLegivel(b: number): string {
  if (b >= GB) return `${(b / GB).toFixed(b >= 10 * GB ? 0 : 1)} GB`;
  if (b >= MB) return `${(b / MB).toFixed(b >= 10 * MB ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}

// ---- Pastas ----

export async function getPasta(id: string): Promise<Pasta | null> {
  if (!id) return null;
  const { data } = await db().from("arquivos_pastas").select("*").eq("id", id).maybeSingle();
  return (data as Pasta | null) ?? null;
}

export async function criarPasta(parentId: string | null, nome: string, actor: string): Promise<Pasta> {
  const n = nome.trim().slice(0, 120);
  if (!n) throw new Error("Dê um nome à pasta.");
  if (parentId && !(await getPasta(parentId))) throw new Error("Pasta de cima não existe mais.");
  const { data, error } = await db().from("arquivos_pastas").insert({ parent_id: parentId, nome: n, created_by: actor }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Pasta;
}

export async function renomearPasta(id: string, nome: string): Promise<void> {
  const n = nome.trim().slice(0, 120);
  if (!n) throw new Error("Dê um nome à pasta.");
  const { error } = await db().from("arquivos_pastas").update({ nome: n }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Todas as pastas abaixo desta, ela inclusive. */
async function arvore(id: string): Promise<string[]> {
  const ids = [id];
  for (let i = 0; i < ids.length && i < 5000; i++) {
    const { data } = await db().from("arquivos_pastas").select("id").eq("parent_id", ids[i]);
    for (const r of data ?? []) ids.push(r.id as string);
  }
  return ids;
}

/** Apaga a pasta com tudo dentro, no R2 também. */
export async function apagarPasta(id: string): Promise<void> {
  const ids = await arvore(id);
  const { data } = await db().from("arquivos").select("*").in("pasta_id", ids);
  await limparNoR2((data ?? []) as Arquivo[]);
  const { error } = await db().from("arquivos_pastas").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---- Arquivos ----

export async function getArquivo(id: string): Promise<Arquivo | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("arquivos").select("*").eq("id", id).maybeSingle();
  return (data as Arquivo | null) ?? null;
}

export async function arquivosDa(pastaId: string): Promise<Arquivo[]> {
  const { data } = await db().from("arquivos").select("*").eq("pasta_id", pastaId).order("created_at", { ascending: false });
  return (data ?? []) as Arquivo[];
}

export async function arquivosDoLink(linkId: string): Promise<Arquivo[]> {
  const { data } = await db().from("arquivos").select("*").eq("link_id", linkId).order("created_at", { ascending: false }).limit(200);
  return (data ?? []) as Arquivo[];
}

async function limparNoR2(arqs: Arquivo[]): Promise<void> {
  for (const a of arqs) if (a.upload_id) await cancelarEnvioEmPartes(AREA, a.path, a.upload_id).catch(() => null);
  await remover(AREA, arqs.filter((a) => a.status === "pronto").map((a) => a.path));
}

export async function apagarArquivo(a: Arquivo): Promise<void> {
  await limparNoR2([a]);
  await db().from("arquivos").delete().eq("id", a.id);
}

export async function moverArquivo(a: Arquivo, pastaId: string): Promise<void> {
  if (!(await getPasta(pastaId))) throw new Error("Pasta não encontrada.");
  await db().from("arquivos").update({ pasta_id: pastaId }).eq("id", a.id);
}

export async function renomearArquivo(a: Arquivo, nome: string): Promise<void> {
  const n = nome.trim().slice(0, 200);
  if (!n) throw new Error("Dê um nome ao arquivo.");
  await db().from("arquivos").update({ nome: n }).eq("id", a.id);
}

/** Link de download direto do R2, que salva com o nome original. O máximo da assinatura é 7 dias. */
export async function linkDeDownload(a: Arquivo, dias = 1): Promise<string> {
  if (a.status !== "pronto") throw new Error("O arquivo ainda está subindo.");
  return urlAssinada(AREA, a.path, Math.min(7, Math.max(1, dias)) * 86400, a.nome);
}

export type InicioEnvio = { id: string; parteBytes: number; partes: number };

/** Abre o envio em partes e registra o arquivo como "enviando". */
export async function iniciarEnvio(p: {
  pastaId: string;
  nome: string;
  mime: string;
  tamanho: number;
  enviadoPor: string;
  linkId: string | null;
  max: number;
}): Promise<InicioEnvio> {
  if (!Number.isFinite(p.tamanho) || p.tamanho <= 0) throw new Error("Arquivo vazio.");
  if (p.tamanho > p.max) throw new Error(`Arquivo acima do limite de ${tamanhoLegivel(p.max)}.`);
  const nome = p.nome.trim().slice(0, 200) || "arquivo";
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(p.mime) ? p.mime : "application/octet-stream";
  const id = randomUUID();
  const path = `${p.pastaId}/${id}-${nomeSeguro(nome)}`;
  const parteBytes = Math.max(PARTE_MIN, Math.ceil(p.tamanho / 9500 / MB) * MB);
  const uploadId = await iniciarEnvioEmPartes(AREA, path, mime);
  const { error } = await db().from("arquivos").insert({
    id,
    pasta_id: p.pastaId,
    link_id: p.linkId,
    nome,
    path,
    mime,
    tamanho: p.tamanho,
    parte_bytes: parteBytes,
    upload_id: uploadId,
    enviado_por: p.enviadoPor.slice(0, 200),
  });
  if (error) {
    await cancelarEnvioEmPartes(AREA, path, uploadId).catch(() => null);
    throw new Error(error.message);
  }
  return { id, parteBytes, partes: totalDePartes({ tamanho: p.tamanho, parte_bytes: parteBytes }) };
}

function aberto(a: Arquivo): string {
  if (a.status !== "enviando" || !a.upload_id) throw new Error("Esse envio já terminou.");
  return a.upload_id;
}

/** Links assinados para as partes pedidas (até 50 por vez). */
export async function urlsDasPartes(a: Arquivo, numeros: number[]): Promise<{ numero: number; url: string }[]> {
  const uploadId = aberto(a);
  const total = totalDePartes(a);
  const validos = Array.from(new Set(numeros)).filter((n) => Number.isInteger(n) && n >= 1 && n <= total).slice(0, 50);
  return Promise.all(validos.map(async (numero) => ({ numero, url: await urlDeParte(AREA, a.path, uploadId, numero) })));
}

/** Para retomar: que partes já estão no R2. */
export async function partesProntas(a: Arquivo): Promise<number[]> {
  const uploadId = aberto(a);
  return (await partesEnviadas(AREA, a.path, uploadId)).map((p) => p.numero);
}

/** Fecha o envio: confere que todas as partes chegaram e somam o tamanho anunciado. */
export async function concluirEnvio(a: Arquivo): Promise<void> {
  const uploadId = aberto(a);
  const partes = await partesEnviadas(AREA, a.path, uploadId);
  const total = totalDePartes(a);
  const faltam = total - partes.length;
  if (faltam > 0) throw new Error(`Faltam ${faltam} de ${total} partes. Continue o envio.`);
  const soma = partes.reduce((n, p) => n + p.tamanho, 0);
  if (soma !== a.tamanho) throw new Error("O arquivo chegou com tamanho diferente do anunciado. Envie de novo.");
  await concluirEnvioEmPartes(AREA, a.path, uploadId, partes);
  const i = await info(AREA, a.path);
  if (!i) throw new Error("O R2 não confirmou o arquivo. Envie de novo.");
  const { error } = await db()
    .from("arquivos")
    .update({ status: "pronto", upload_id: null, tamanho: i.tamanho, concluido_em: new Date().toISOString() })
    .eq("id", a.id);
  if (error) throw new Error(error.message);
}

// ---- Links de envio ----

export async function criarLink(p: {
  pastaId: string;
  titulo: string;
  mensagem: string | null;
  dias: number;
  maxGb: number | null;
  actor: string;
}): Promise<LinkEnvio> {
  if (!(await getPasta(p.pastaId))) throw new Error("Pasta não encontrada.");
  const titulo = p.titulo.trim().slice(0, 120);
  if (!titulo) throw new Error("Dê um título ao link (aparece para quem envia).");
  const dias = Math.min(90, Math.max(1, Math.round(p.dias || 7)));
  const { data, error } = await db()
    .from("arquivos_links")
    .insert({
      token: newToken(),
      pasta_id: p.pastaId,
      titulo,
      mensagem: p.mensagem?.trim().slice(0, 1000) || null,
      expira_em: new Date(Date.now() + dias * 86400_000).toISOString(),
      max_arquivo: p.maxGb && p.maxGb > 0 ? Math.round(p.maxGb * GB) : null,
      created_by: p.actor,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as LinkEnvio;
}

export async function linksDa(pastaId: string): Promise<LinkEnvio[]> {
  const { data } = await db().from("arquivos_links").select("*").eq("pasta_id", pastaId).order("created_at", { ascending: false });
  return (data ?? []) as LinkEnvio[];
}

export const linkValido = (l: LinkEnvio) => l.ativo && new Date(l.expira_em).getTime() > Date.now();

export async function linkPorToken(token: string): Promise<LinkEnvio | null> {
  if (!token || token.length < 16) return null;
  const { data } = await db().from("arquivos_links").select("*").eq("token", token).maybeSingle();
  return (data as LinkEnvio | null) ?? null;
}

export async function desativarLink(id: string): Promise<void> {
  await db().from("arquivos_links").update({ ativo: false }).eq("id", id);
}
