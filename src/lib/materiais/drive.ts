import "server-only";
import { clearConfig, getConfig, setConfig } from "@/lib/producao/store";
import { tokenRequest } from "@/lib/producao/youtube-api";

/**
 * Drive da produção, onde ficam os materiais dos editores.
 *
 * Escopo `drive.file`: o app só enxerga o que ele mesmo criou (a pasta raiz, as
 * subpastas e os arquivos enviados por aqui). É um escopo não sensível, então
 * não exige verificação do app no Google, ao contrário do `drive` completo.
 * Mesmo client OAuth do YouTube (GOOGLE_CLIENT_ID), outro refresh token.
 *
 * O arquivo nunca passa pela função da Vercel (limite de 4,5 MB): o servidor
 * abre a sessão de upload retomável e o navegador manda o arquivo direto para
 * ela. A sessão é aberta com o Origin do site, e é isso que faz o Google liberar
 * o CORS do PUT vindo do navegador.
 */
const SCOPE = "openid email https://www.googleapis.com/auth/drive.file";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const PASTA = "application/vnd.google-apps.folder";

const K = { refresh: "drive_refresh_token", account: "drive_account", raiz: "materiais_drive_raiz" };
export const NOME_RAIZ = "PFC · Materiais dos editores";

export function driveAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function connectDrive(code: string, redirectUri: string): Promise<string> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("O Google não devolveu refresh_token. Remova o acesso e conecte de novo.");
  const me = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${t.access_token}` },
    cache: "no-store",
  }).then((r) => r.json() as Promise<{ email?: string }>);
  await setConfig(K.refresh, t.refresh_token);
  await setConfig(K.account, me.email ?? "conta Google");
  cached = null;
  // Conta nova não enxerga a raiz criada pela anterior (drive.file): começa outra.
  await clearConfig(K.raiz);
  await garantirRaiz();
  return me.email ?? "conta Google";
}

export async function disconnectDrive(): Promise<void> {
  await clearConfig(K.refresh);
  await clearConfig(K.account);
  cached = null;
}

export const driveAccount = () => getConfig(K.account);
export const raizId = () => getConfig(K.raiz);

export const linkDrive = (id: string) => `https://drive.google.com/file/d/${id}/view`;
export const linkPasta = (id: string) => `https://drive.google.com/drive/folders/${id}`;

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const refresh = await getConfig(K.refresh);
  if (!refresh) throw new Error("Drive não conectado. Um admin precisa conectar em Materiais → Configurar.");
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

async function drive<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const json = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json as { error?: { message?: string } };
    throw new Error(`Drive ${res.status}: ${e.error?.message ?? "erro desconhecido"}`);
  }
  return json as T;
}

export type ArquivoDrive = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  parents?: string[];
  trashed?: boolean;
};

export async function arquivo(id: string): Promise<ArquivoDrive | null> {
  try {
    return await drive<ArquivoDrive>(`/files/${encodeURIComponent(id)}?fields=id,name,mimeType,size,parents,trashed`);
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Drive 404")) return null;
    throw e;
  }
}

/** Nome que o Drive aceita e que lê bem na lista: sem barra, sem espaço sobrando. */
export function nomePasta(v: string): string {
  return v.replace(/[\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Sem nome";
}

const q = (v: string) => v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

/** A subpasta com esse nome dentro de `pai`, criada se ainda não existe. */
async function pasta(nome: string, pai: string): Promise<string> {
  const busca = `name = '${q(nome)}' and '${q(pai)}' in parents and mimeType = '${PASTA}' and trashed = false`;
  const { files } = await drive<{ files: { id: string }[] }>(`/files?q=${encodeURIComponent(busca)}&fields=files(id)&pageSize=1`);
  if (files[0]) return files[0].id;
  const nova = await drive<{ id: string }>("/files?fields=id", {
    method: "POST",
    body: JSON.stringify({ name: nome, mimeType: PASTA, parents: [pai] }),
  });
  return nova.id;
}

/** A pasta raiz dos materiais; recriada se alguém a apagou ou mandou para a lixeira. */
export async function garantirRaiz(): Promise<string> {
  const atual = await getConfig(K.raiz);
  if (atual) {
    const a = await arquivo(atual);
    if (a && !a.trashed) return atual;
  }
  const nova = await drive<{ id: string }>("/files?fields=id", {
    method: "POST",
    body: JSON.stringify({ name: NOME_RAIZ, mimeType: PASTA }),
  });
  await setConfig(K.raiz, nova.id);
  return nova.id;
}

/** Desce (criando o que faltar) pelo caminho a partir da raiz e devolve a última pasta. */
export async function garantirCaminho(caminho: string[]): Promise<string> {
  let atual = await garantirRaiz();
  for (const nome of caminho) atual = await pasta(nomePasta(nome), atual);
  return atual;
}

/**
 * Abre a sessão de upload retomável. O que volta é a URL para onde o navegador
 * faz o PUT do arquivo (vale por uma semana, sem precisar de token).
 */
export async function abrirUpload(p: { pastaId: string; nome: string; mime: string; tamanho: number; origin: string }): Promise<string> {
  const res = await fetch(`${UPLOAD}?uploadType=resumable&fields=id`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": p.mime,
      "X-Upload-Content-Length": String(p.tamanho),
      Origin: p.origin,
    },
    body: JSON.stringify({ name: p.nome, parents: [p.pastaId] }),
    cache: "no-store",
  });
  const url = res.headers.get("location");
  if (!res.ok || !url) {
    const e = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(`Drive ${res.status}: ${e.error?.message ?? "não abriu a sessão de upload"}`);
  }
  return url;
}

/** Arquivo enviado que não foi confirmado: tira do Drive para não ficar órfão. */
export async function apagar(id: string): Promise<void> {
  await drive(`/files/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
}
