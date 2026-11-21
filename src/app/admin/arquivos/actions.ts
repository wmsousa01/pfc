"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/producao/actions";
import type { Inicio, Res } from "@/components/arquivos/EnvioGrande";
import { requireAdmin } from "@/lib/auth";
import {
  MAX_ARQUIVO,
  apagarArquivo,
  apagarPasta,
  concluirEnvio,
  criarLink,
  criarPasta,
  desativarLink,
  getArquivo,
  getPasta,
  iniciarEnvio,
  linkDeDownload,
  moverArquivo,
  partesProntas,
  renomearArquivo,
  renomearPasta,
  totalDePartes,
  urlsDasPartes,
} from "@/lib/arquivos/store";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function ator(): Promise<string> {
  const r = await requireAdmin();
  return r.email ?? r.userId;
}

async function tentar<T extends object>(fn: () => Promise<T>): Promise<Res<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

async function arquivoAberto(id: string) {
  const a = await getArquivo(id);
  if (!a) throw new Error("Envio não encontrado.");
  return a;
}

// ---- Envio em partes (o componente EnvioGrande chama estas) ----

export async function iniciarAdminAction(pastaId: string, nome: string, mime: string, tamanho: number): Promise<Res<Inicio>> {
  const quem = await ator();
  return tentar(async () => {
    if (!(await getPasta(pastaId))) throw new Error("Pasta não encontrada.");
    return iniciarEnvio({ pastaId, nome, mime, tamanho, enviadoPor: quem, linkId: null, max: MAX_ARQUIVO });
  });
}

export async function retomarAdminAction(id: string): Promise<Res<Inicio & { prontas: number[] }>> {
  await ator();
  return tentar(async () => {
    const a = await arquivoAberto(id);
    return { id: a.id, parteBytes: a.parte_bytes, partes: totalDePartes(a), prontas: await partesProntas(a) };
  });
}

export async function urlsAdminAction(id: string, numeros: number[]): Promise<Res<{ urls: { numero: number; url: string }[] }>> {
  await ator();
  return tentar(async () => ({ urls: await urlsDasPartes(await arquivoAberto(id), numeros) }));
}

export async function concluirAdminAction(id: string): Promise<Res<object>> {
  await ator();
  return tentar(async () => {
    await concluirEnvio(await arquivoAberto(id));
    revalidatePath("/admin/arquivos");
    return {};
  });
}

export async function cancelarAdminAction(id: string): Promise<Res<object>> {
  await ator();
  return tentar(async () => {
    const a = await getArquivo(id);
    if (a?.status === "enviando") await apagarArquivo(a);
    return {};
  });
}

// ---- Pastas e arquivos ----

const voltar = (pastaId: string | null) => redirect(pastaId ? `/admin/arquivos?pasta=${pastaId}` : "/admin/arquivos");

async function run(fn: (quem: string) => Promise<unknown>): Promise<ActionState> {
  const quem = await ator();
  try {
    await fn(quem);
    revalidatePath("/admin/arquivos");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function criarPastaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((quem) => criarPasta(str(form, "parent") || null, str(form, "nome"), quem));
}

export async function renomearPastaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(() => renomearPasta(str(form, "pasta"), str(form, "nome")));
}

export async function apagarPastaAction(form: FormData): Promise<void> {
  await ator();
  const p = await getPasta(str(form, "pasta"));
  if (!p) return voltar(null);
  if (str(form, "confirmar") !== p.nome) return voltar(p.id);
  await apagarPasta(p.id);
  revalidatePath("/admin/arquivos");
  voltar(p.parent_id);
}

export async function apagarArquivoAction(form: FormData): Promise<void> {
  await ator();
  const a = await getArquivo(str(form, "arquivo"));
  if (a) await apagarArquivo(a);
  revalidatePath("/admin/arquivos");
}

export async function renomearArquivoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const a = await getArquivo(str(form, "arquivo"));
    if (!a) throw new Error("Arquivo não encontrado.");
    await renomearArquivo(a, str(form, "nome"));
  });
}

export async function moverArquivoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const a = await getArquivo(str(form, "arquivo"));
    if (!a) throw new Error("Arquivo não encontrado.");
    await moverArquivo(a, str(form, "destino"));
  });
}

/** Link para mandar a alguém de fora baixar, direto do R2, válido por alguns dias. */
export async function linkDownloadAction(id: string, dias: number): Promise<Res<{ url: string }>> {
  await ator();
  return tentar(async () => {
    const a = await getArquivo(id);
    if (!a) throw new Error("Arquivo não encontrado.");
    return { url: await linkDeDownload(a, dias) };
  });
}

// ---- Links de envio ----

export async function criarLinkAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((quem) =>
    criarLink({
      pastaId: str(form, "pasta"),
      titulo: str(form, "titulo"),
      mensagem: str(form, "mensagem") || null,
      dias: Number(str(form, "dias")) || 7,
      maxGb: Number(str(form, "max_gb")) || null,
      actor: quem,
    })
  );
}

export async function desativarLinkAction(form: FormData): Promise<void> {
  await ator();
  await desativarLink(str(form, "link"));
  revalidatePath("/admin/arquivos");
}
