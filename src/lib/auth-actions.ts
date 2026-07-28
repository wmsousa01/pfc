"use server";

import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";

/** Encerra a sessão. Usado no admin, na área do revendedor e em /sem-acesso. */
export async function signOutAction(formData: FormData) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect(String(formData.get("to") ?? "") || "/");
}
