"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/app/admin/producao/actions";
import { requireAdmin, requireArea } from "@/lib/auth";
import { disconnectDrive } from "@/lib/materiais/drive";
import {
  arquivar,
  cancelarEnvio,
  confirmarEnvio,
  iniciarEnvio,
  isCategoria,
  revisar,
  type NovoEnvio,
} from "@/lib/materiais/store";

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function refresh(id?: string) {
  revalidatePath("/admin/materiais");
  if (id) revalidatePath(`/admin/materiais/${id}`);
}

/** Origem do site como o navegador a vê: a sessão do Drive só aceita PUT dela. */
function origemDoPedido(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export type EnvioDados = Omit<NovoEnvio, "categoria"> & { categoria: string };
export type Inicio = { ok: true; id: string; uploadUrl: string } | { ok: false; error: string };

export async function iniciarEnvioAction(dados: EnvioDados, nome: string, mime: string, tamanho: number): Promise<Inicio> {
  const a = await requireArea("materiais");
  try {
    if (!dados.substitui_id && !isCategoria(dados.categoria)) throw new Error("Escolha a categoria.");
    const s = await iniciarEnvio(a, dados as NovoEnvio, { nome, mime, tamanho }, origemDoPedido());
    return { ok: true, ...s };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function confirmarEnvioAction(id: string, fileId: string): Promise<ActionState> {
  const a = await requireArea("materiais");
  try {
    const m = await confirmarEnvio(a, id, fileId);
    refresh(m.substitui_id ?? undefined);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function cancelarEnvioAction(id: string, fileId: string | null): Promise<void> {
  const a = await requireArea("materiais");
  await cancelarEnvio(a, id, fileId).catch(() => undefined);
}

export async function revisarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const a = await requireArea("materiais");
  const id = String(form.get("id") ?? "");
  const decisao = String(form.get("decisao") ?? "") === "ajuste" ? "ajuste" : "aprovado";
  try {
    await revisar(a, id, decisao, String(form.get("comentario") ?? ""));
    refresh(id);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function arquivarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const a = await requireArea("materiais");
  const id = String(form.get("id") ?? "");
  try {
    await arquivar(a, id);
    refresh(id);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function desconectarDriveAction(): Promise<void> {
  await requireAdmin();
  await disconnectDrive();
  refresh();
  redirect("/admin/materiais?view=config");
}
