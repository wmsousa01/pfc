"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { quem, requireAdmin } from "@/lib/auth";
import { apagarPapel, definirAtivo, salvarMembro, salvarPapel } from "@/lib/equipe";

// Equipe e papéis são só de admin: quem distribui acesso controla todo o resto.

async function rodar(fn: () => Promise<void>): Promise<ActionState> {
  try {
    await fn();
    revalidatePath("/admin/equipe");
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function salvarMembroAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  return rodar(() =>
    salvarMembro(
      {
        user_id: String(form.get("user_id") ?? "") || undefined,
        nome: String(form.get("nome") ?? ""),
        email: String(form.get("email") ?? ""),
        senha: String(form.get("senha") ?? "").trim(),
        papeis: form.getAll("papeis").map(String),
        extras: form.getAll("extras").map(String),
        apresentador_id: String(form.get("apresentador_id") ?? ""),
      },
      quem(role)
    )
  );
}

export async function ativoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return rodar(() => definirAtivo(String(form.get("user_id") ?? ""), String(form.get("ativo") ?? "") === "1"));
}

export async function salvarPapelAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return rodar(() =>
    salvarPapel({
      chave: String(form.get("chave") ?? "") || undefined,
      nome: String(form.get("nome") ?? ""),
      descricao: String(form.get("descricao") ?? ""),
      permissoes: form.getAll("permissoes").map(String),
    })
  );
}

export async function apagarPapelAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  return rodar(() => apagarPapel(String(form.get("chave") ?? "")));
}
