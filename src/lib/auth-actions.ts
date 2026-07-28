"use server";

import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "./supabase/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase/env";
import { MIN_PASSWORD_LENGTH } from "./config";

/** Encerra a sessão. Usado no admin, na área do revendedor e em /sem-acesso. */
export async function signOutAction(formData: FormData) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect(String(formData.get("to") ?? "") || "/");
}

export type PasswordFormState = { ok: boolean; error: string | null };

/**
 * Troca a senha de quem está LOGADO (admin ou revendedor).
 *
 * Pede a senha atual de propósito. Só a sessão no cookie não basta: um
 * navegador deixado aberto viraria troca de senha — e, no caso do admin, perda
 * do painel inteiro. A conferência roda num cliente descartável
 * (`persistSession: false`) para não sobrescrever os cookies da sessão em uso.
 */
export async function changeOwnPasswordAction(
  _prev: PasswordFormState,
  formData: FormData
): Promise<PasswordFormState> {
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("password") ?? "");
  const confirm = String(formData.get("password_confirm") ?? "");

  const fail = (error: string): PasswordFormState => ({ ok: false, error });

  if (next.length < MIN_PASSWORD_LENGTH) {
    return fail(`A nova senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  if (next !== confirm) return fail("A confirmação não bate com a nova senha.");
  if (next === current) return fail("A nova senha precisa ser diferente da atual.");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return fail("Supabase não configurado.");
  }

  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return fail("Sua sessão expirou. Entre de novo e tente outra vez.");
  }

  const verifier = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: wrongPassword } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: current,
  });

  if (wrongPassword) return fail("A senha atual está incorreta.");

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return fail(`Não foi possível trocar a senha: ${error.message}`);

  return { ok: true, error: null };
}
