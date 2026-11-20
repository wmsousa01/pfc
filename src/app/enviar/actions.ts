"use server";

import { revalidatePath } from "next/cache";
import type { Inicio, Res } from "@/components/arquivos/EnvioGrande";
import {
  MAX_ARQUIVO,
  apagarArquivo,
  concluirEnvio,
  getArquivo,
  iniciarEnvio,
  linkPorToken,
  linkValido,
  partesProntas,
  totalDePartes,
  urlsDasPartes,
} from "@/lib/arquivos/store";

/**
 * Envio por link, sem login: o token do link é a única credencial. Cada
 * chamada confere que o link vale e que o arquivo foi aberto por ele.
 */

async function tentar<T extends object>(fn: () => Promise<T>): Promise<Res<T>> {
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

async function linkAtivo(token: string) {
  const l = await linkPorToken(token);
  if (!l) throw new Error("Link inválido.");
  if (!linkValido(l)) throw new Error("Este link expirou. Peça um novo à produção.");
  return l;
}

async function arquivoDoLink(token: string, id: string) {
  const l = await linkAtivo(token);
  const a = await getArquivo(id);
  if (!a || a.link_id !== l.id) throw new Error("Envio não encontrado.");
  return a;
}

export async function iniciarLinkAction(token: string, nome: string, mime: string, tamanho: number, remetente: string): Promise<Res<Inicio>> {
  return tentar(async () => {
    const l = await linkAtivo(token);
    const quem = remetente.trim().slice(0, 120);
    if (quem.length < 2) throw new Error("Diga seu nome.");
    return iniciarEnvio({ pastaId: l.pasta_id, nome, mime, tamanho, enviadoPor: quem, linkId: l.id, max: l.max_arquivo ?? MAX_ARQUIVO });
  });
}

export async function retomarLinkAction(token: string, id: string): Promise<Res<Inicio & { prontas: number[] }>> {
  return tentar(async () => {
    const a = await arquivoDoLink(token, id);
    return { id: a.id, parteBytes: a.parte_bytes, partes: totalDePartes(a), prontas: await partesProntas(a) };
  });
}

export async function urlsLinkAction(token: string, id: string, numeros: number[]): Promise<Res<{ urls: { numero: number; url: string }[] }>> {
  return tentar(async () => ({ urls: await urlsDasPartes(await arquivoDoLink(token, id), numeros) }));
}

export async function concluirLinkAction(token: string, id: string): Promise<Res<object>> {
  return tentar(async () => {
    await concluirEnvio(await arquivoDoLink(token, id));
    revalidatePath(`/enviar/${token}`);
    revalidatePath("/admin/arquivos");
    return {};
  });
}

export async function cancelarLinkAction(token: string, id: string): Promise<Res<object>> {
  return tentar(async () => {
    const a = await arquivoDoLink(token, id);
    // Quem é de fora só cancela o próprio envio em andamento; o que já chegou fica com a produção.
    if (a.status === "enviando") await apagarArquivo(a);
    return {};
  });
}
