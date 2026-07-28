import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import type { Reseller } from "./types";

/**
 * Papel do usuário logado.
 *
 * Antes desta versão, "autenticado" era sinônimo de "admin". Com o login de
 * revendedores isso deixou de valer: o papel vem da tabela app_admins
 * (função is_admin()) ou de um cadastro em resellers.
 */
export type SessionRole =
  | { kind: "anon" }
  | { kind: "admin"; userId: string; email: string | null }
  | { kind: "reseller"; userId: string; email: string | null; reseller: Reseller }
  /** Logado, mas sem admin nem cadastro de revendedor ativo. */
  | { kind: "none"; userId: string; email: string | null };

export async function getSessionRole(): Promise<SessionRole> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: "anon" };
  const base = { userId: user.id, email: user.email ?? null };

  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (isAdmin === true) return { kind: "admin", ...base };

  const { data: reseller } = await supabase
    .from("resellers")
    .select("*")
    .eq("user_id", user.id)
    .eq("active", true)
    .maybeSingle();

  if (reseller) {
    return { kind: "reseller", ...base, reseller: reseller as Reseller };
  }
  return { kind: "none", ...base };
}

/**
 * Gate das páginas e actions do admin.
 * Revendedor cai no painel dele; conta sem papel vai para /sem-acesso
 * (página fora dos matchers do middleware, então não há loop de redirect).
 */
export async function requireAdmin(): Promise<
  Extract<SessionRole, { kind: "admin" }>
> {
  const role = await getSessionRole();
  if (role.kind === "admin") return role;
  if (role.kind === "anon") redirect("/admin/login");
  if (role.kind === "reseller") redirect("/revendedor");
  redirect("/sem-acesso");
}

/** Gate das páginas e actions da área do revendedor. */
export async function requireReseller(): Promise<
  Extract<SessionRole, { kind: "reseller" }>
> {
  const role = await getSessionRole();
  if (role.kind === "reseller") return role;
  if (role.kind === "anon") redirect("/revendedor/login");
  if (role.kind === "admin") redirect("/admin");
  redirect("/sem-acesso");
}
