"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/agenda/store";
import {
  aprovarCadastro,
  atualizarCadastro,
  getCadastro,
  quadrosDe,
  removerMaterialApresentador,
  usarComoFotoPadrao,
} from "@/lib/apresentadores/store";

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh() {
  revalidatePath("/admin/apresentadores");
  revalidatePath("/admin/agenda/config");
}

async function cadastroDo(form: FormData) {
  const c = await getCadastro(str(form, "cadastro"));
  if (!c) throw new Error("Cadastro não encontrado.");
  return c;
}

async function run(fn: () => Promise<unknown>): Promise<ActionState> {
  await requireAdmin();
  try {
    await fn();
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    refresh();
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Aprova (ou atualiza) os quadros do apresentador e, se escolhida, a foto padrão das artes. */
export async function aprovarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const c = await cadastroDo(form);
    if (c.termo_revogado_em) throw new Error("O apresentador pediu para não usar a imagem em conteúdos novos.");
    await aprovarCadastro(c, quadrosDe(form), str(form, "foto") || null);
  });
}

export async function fotoPadraoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const c = await cadastroDo(form);
    await usarComoFotoPadrao(c.id, str(form, "material"));
  });
}

/** Arquiva: sai da grade (apresentadores do quadro inativos) e o link para de receber materiais. */
export async function arquivarAction(form: FormData): Promise<void> {
  await requireAdmin();
  const c = await cadastroDo(form);
  await atualizarCadastro(c.id, { status: "arquivado" });
  await db().from("agenda_apresentadores").update({ ativo: false }).eq("cadastro_id", c.id);
  refresh();
}

export async function reabrirAction(form: FormData): Promise<void> {
  await requireAdmin();
  const c = await cadastroDo(form);
  await atualizarCadastro(c.id, { status: "pendente" });
  refresh();
}

export async function removerMaterialAdminAction(form: FormData): Promise<void> {
  await requireAdmin();
  await removerMaterialApresentador(str(form, "cadastro"), str(form, "material"));
  refresh();
}
