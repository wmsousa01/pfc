import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Area } from "./permissoes";
import { createAdminSupabase } from "./supabase/admin";
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
  /** Membro da equipe (tabela equipe): abre só as áreas da própria lista. */
  | { kind: "equipe"; userId: string; email: string | null; nome: string; papel: string; areas: string[] }
  /** Logado, mas sem admin nem cadastro de revendedor ativo. */
  | { kind: "none"; userId: string; email: string | null };

/** Uma consulta por request: o menu e a página pedem o papel na mesma renderização. */
export const getSessionRole = cache(async function getSessionRole(): Promise<SessionRole> {
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

  // equipe não tem policy para o cliente: só o service-role lê.
  const admin = createAdminSupabase();
  const { data: membro } = admin
    ? await admin.from("equipe").select("nome, papel, areas").eq("user_id", user.id).eq("ativo", true).maybeSingle()
    : { data: null };

  if (membro) {
    return { kind: "equipe", ...base, nome: membro.nome, papel: membro.papel, areas: membro.areas ?? [] };
  }
  return { kind: "none", ...base };
});

/** Quem passou por requireArea/requireEquipe: admin (tudo) ou membro da equipe (a lista dele). */
export type Acesso = {
  userId: string;
  email: string | null;
  nome: string | null;
  admin: boolean;
  /** Áreas e permissões finas; vazio para admin, que não precisa de lista. */
  areas: string[];
};

/** Admin pode tudo; membro, o que estiver na lista. */
export const pode = (a: Acesso, permissao: string) => a.admin || a.areas.includes(permissao);

function acessoDe(role: Extract<SessionRole, { kind: "admin" | "equipe" }>): Acesso {
  return role.kind === "admin"
    ? { userId: role.userId, email: role.email, nome: null, admin: true, areas: [] }
    : { userId: role.userId, email: role.email, nome: role.nome, admin: false, areas: role.areas };
}

/** Primeira tela que o membro abre: a primeira área liberada, na ordem do menu. */
const ORDEM: Area[] = ["pendencias", "materiais", "agenda", "producao", "marketing", "campanhas"];
function inicioDoMembro(areas: string[]): string {
  const a = ORDEM.find((k) => areas.includes(k));
  return a ? `/admin/${a}` : "/sem-acesso";
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
  // Membro da equipe que caiu numa tela só de admin (ex.: /admin depois do login).
  if (role.kind === "equipe") redirect(inicioDoMembro(role.areas));
  redirect("/sem-acesso");
}

/**
 * Gate das áreas que a equipe pode abrir. Admin passa sempre; membro passa se a
 * área estiver na lista dele e, se não estiver, vai para a primeira que tem.
 */
export async function requireArea(area: Area): Promise<Acesso> {
  const role = await getSessionRole();
  if (role.kind === "admin") return acessoDe(role);
  if (role.kind === "equipe") {
    if (role.areas.includes(area)) return acessoDe(role);
    redirect(inicioDoMembro(role.areas));
  }
  if (role.kind === "anon") redirect("/admin/login");
  if (role.kind === "reseller") redirect("/revendedor");
  redirect("/sem-acesso");
}

/** Gate das telas de qualquer pessoa da equipe (ex.: Minha conta). */
export async function requireEquipe(): Promise<Acesso> {
  const role = await getSessionRole();
  if (role.kind === "admin" || role.kind === "equipe") return acessoDe(role);
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
  if (role.kind === "admin" || role.kind === "equipe") redirect("/admin");
  redirect("/sem-acesso");
}

/**
 * Gate do material de apoio comercial (ex.: /revendedor/comparativo).
 *
 * Diferente de requireReseller(): o admin também passa. São páginas que o
 * admin precisa abrir para conferir e para usar nas próprias reuniões —
 * mandá-lo para /admin ali seria só um beco sem saída.
 */
export async function requireResellerOrAdmin(): Promise<SessionRole> {
  const role = await getSessionRole();
  if (role.kind === "reseller" || role.kind === "admin") return role;
  if (role.kind === "anon") redirect("/revendedor/login");
  redirect("/sem-acesso");
}
