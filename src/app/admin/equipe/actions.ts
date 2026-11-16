"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { requireAdmin } from "@/lib/auth";
import { definirAtivo, salvarMembro } from "@/lib/equipe";

export async function salvarMembroAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    await salvarMembro(
      {
        user_id: String(form.get("user_id") ?? "") || undefined,
        nome: String(form.get("nome") ?? ""),
        email: String(form.get("email") ?? ""),
        senha: String(form.get("senha") ?? "").trim(),
        papel: String(form.get("papel") ?? ""),
        areas: form.getAll("areas").map(String),
      },
      role.email ?? role.userId
    );
    revalidatePath("/admin/equipe");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function ativoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await definirAtivo(String(form.get("user_id") ?? ""), String(form.get("ativo") ?? "") === "1");
    revalidatePath("/admin/equipe");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
