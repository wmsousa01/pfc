import "server-only";
import { createAdminSupabase } from "./supabase/admin";
import type { ClientContract, TermsAcceptance } from "./types";

/**
 * Dados privados da área do cliente: contrato, Epic do Jira e aceite.
 * Tudo via service-role, sempre depois de o painel validar o token.
 */

export type PanelExtras = {
  jiraEpic: string | null;
  /** Tarefa "Conversa com o cliente" no Jira (criada na primeira mensagem). */
  jiraChat: string | null;
  contract: ClientContract | null;
};

export async function getPanelExtras(partnerId: string): Promise<PanelExtras> {
  const admin = createAdminSupabase();
  const empty: PanelExtras = { jiraEpic: null, jiraChat: null, contract: null };
  if (!admin) return empty;

  // Antes das migrations 009/010 as colunas não existem: o painel segue com
  // o que houver, até só leads e acessos, como era.
  let { data, error } = await admin
    .from("partner_panels")
    .select("jira_epic, jira_chat, contract")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error) {
    ({ data, error } = await admin
      .from("partner_panels")
      .select("jira_epic, contract")
      .eq("partner_id", partnerId)
      .maybeSingle());
  }
  if (error || !data) return empty;

  const row = data as {
    jira_epic: string | null;
    jira_chat?: string | null;
    contract: ClientContract | null;
  };
  return { jiraEpic: row.jira_epic, jiraChat: row.jira_chat ?? null, contract: row.contract };
}

export async function getTermsAcceptance(
  partnerId: string,
  version: string
): Promise<TermsAcceptance | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("partner_terms_acceptances")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("terms_version", version)
    .maybeSingle();
  return (data as TermsAcceptance) ?? null;
}

export async function recordTermsAcceptance(row: {
  partner_id: string;
  terms_version: string;
  terms_hash: string;
  accepted_name: string;
  accepted_document: string;
  ip: string | null;
  user_agent: string | null;
}): Promise<TermsAcceptance | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from("partner_terms_acceptances")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error) {
    // Aceite repetido da mesma versão (clique duplo): vale o primeiro.
    if (error.code === "23505") {
      return getTermsAcceptance(row.partner_id, row.terms_version);
    }
    console.error("[client-area] aceite", error.message);
    return null;
  }
  return data as TermsAcceptance;
}

/** CPF (11) ou CNPJ (14) com dígitos verificadores válidos. */
export function isValidDocument(digits: string): boolean {
  if (/^(\d)\1+$/.test(digits)) return false;
  const n = digits.split("").map(Number);

  if (digits.length === 11) {
    for (const len of [9, 10]) {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
      const dv = ((sum * 10) % 11) % 10;
      if (dv !== n[len]) return false;
    }
    return true;
  }

  if (digits.length === 14) {
    const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (const len of [12, 13]) {
      const w = weights.slice(13 - len);
      let sum = 0;
      for (let i = 0; i < len; i++) sum += n[i] * w[i];
      const r = sum % 11;
      const dv = r < 2 ? 0 : 11 - r;
      if (dv !== n[len]) return false;
    }
    return true;
  }

  return false;
}

export function formatDocument(d: string): string {
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}

export async function setJiraChat(partnerId: string, key: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin.from("partner_panels").update({ jira_chat: key }).eq("partner_id", partnerId);
}

/* ---------------------------------------------------------------------
 * Arquivos do cliente (bucket privado `client-files`)
 * ------------------------------------------------------------------- */

const BUCKET = "client-files";
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_FILES_PER_MESSAGE = 10;
export const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/svg+xml",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

export type ClientFile = {
  id: string;
  partner_id: string;
  storage_path: string;
  file_name: string;
  size_bytes: number;
  mime: string | null;
  jira_comment_id: string | null;
  created_at: string;
};

export type UploadTarget = { path: string; token: string; name: string };

function safeName(name: string): string {
  const base = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "arquivo";
}

/** URLs assinadas para o navegador subir direto no Storage. */
export async function createUploadTargets(
  partnerId: string,
  files: { name: string; size: number; type: string }[]
): Promise<UploadTarget[] | string> {
  if (files.length === 0) return [];
  if (files.length > MAX_FILES_PER_MESSAGE)
    return `Envie no máximo ${MAX_FILES_PER_MESSAGE} arquivos por mensagem.`;
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return `"${f.name}" passa de 50 MB.`;
    if (!ALLOWED_MIME.includes(f.type))
      return `"${f.name}" não é um formato aceito (imagem, PDF, vídeo MP4/MOV, ZIP ou Office).`;
  }

  const admin = createAdminSupabase();
  if (!admin) return "Envio indisponível no momento.";

  const month = new Date().toISOString().slice(0, 7);
  const targets: UploadTarget[] = [];
  for (const f of files) {
    const path = `${partnerId}/${month}/${crypto.randomUUID()}-${safeName(f.name)}`;
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return "Não foi possível preparar o envio. Tente de novo.";
    targets.push({ path, token: data.token, name: f.name });
  }
  return targets;
}

/**
 * Registra os arquivos que o navegador já subiu. Confere que cada caminho é
 * do próprio parceiro e que o objeto existe — o cliente não registra arquivo
 * de outro nem um caminho inventado.
 */
export async function registerClientFiles(
  partnerId: string,
  uploaded: { path: string; name: string }[]
): Promise<ClientFile[] | null> {
  if (uploaded.length === 0) return [];
  const admin = createAdminSupabase();
  if (!admin) return null;

  const rows = [];
  for (const u of uploaded) {
    if (!u.path.startsWith(`${partnerId}/`) || u.path.includes("..")) return null;
    const dir = u.path.slice(0, u.path.lastIndexOf("/"));
    const file = u.path.slice(u.path.lastIndexOf("/") + 1);
    const { data } = await admin.storage.from(BUCKET).list(dir, { search: file });
    const obj = data?.find((o) => o.name === file);
    if (!obj) return null;
    const meta = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
    rows.push({
      partner_id: partnerId,
      storage_path: u.path,
      file_name: u.name.slice(0, 200),
      size_bytes: meta.size ?? 0,
      mime: meta.mimetype ?? null,
    });
  }

  const { data, error } = await admin.from("client_files").insert(rows).select("*");
  if (error) {
    console.error("[client-area] arquivos", error.message);
    return null;
  }
  return data as ClientFile[];
}

export async function linkFilesToComment(ids: string[], commentId: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin || ids.length === 0) return;
  await admin.from("client_files").update({ jira_comment_id: commentId }).in("id", ids);
}

export async function getClientFiles(partnerId: string): Promise<ClientFile[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("client_files")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false });
  return (data as ClientFile[]) ?? [];
}

export async function getClientFile(id: string): Promise<ClientFile | null> {
  const admin = createAdminSupabase();
  if (!admin || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await admin.from("client_files").select("*").eq("id", id).maybeSingle();
  return (data as ClientFile) ?? null;
}

/** Link de download que expira em 5 minutos. */
export async function signedDownloadUrl(file: ClientFile): Promise<string | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(file.storage_path, 300, { download: file.file_name });
  return data?.signedUrl ?? null;
}
