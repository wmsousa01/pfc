import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";
import { NAV } from "@/components/admin/nav";
import { permite, type Permissao } from "./permissoes";
import type { Reseller } from "./types";

/**
 * Papel do usuário logado.
 *
 * - admin: está em app_admins (função is_admin()) e passa em tudo.
 * - equipe: tem cadastro ativo em equipe; o acesso é a soma das permissões
 *   dos papéis dele (039_papeis_acesso.sql).
 * - reseller: tem cadastro de revendedor ativo.
 */
export type SessionRole =
  | { kind: "anon" }
  | { kind: "admin"; userId: string; email: string | null }
  | {
      kind: "equipe";
      userId: string;
      email: string | null;
      nome: string;
      permissoes: string[];
      /** Cadastro de apresentador ligado ao login (papel Apresentador). */
      apresentadorId: string | null;
    }
  | { kind: "reseller"; userId: string; email: string | null; reseller: Reseller }
  /** Logado, mas sem admin, equipe nem cadastro de revendedor ativo. */
  | { kind: "none"; userId: string; email: string | null };

type MeuAcesso = {
  admin: boolean;
  membro: boolean;
  nome: string | null;
  apresentador_id: string | null;
  permissoes: string[] | null;
};

/** Uma consulta por request: o menu e a página pedem o papel na mesma renderização. */
export const getSessionRole = cache(async (): Promise<SessionRole> => {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { kind: "anon" };
  const base = { userId: user.id, email: user.email ?? null };

  const { data: acesso, error } = await supabase.rpc("meu_acesso");
  if (!error && acesso) {
    const a = acesso as MeuAcesso;
    if (a.admin) return { kind: "admin", ...base };
    if (a.membro) {
      return {
        kind: "equipe",
        ...base,
        nome: a.nome ?? user.email ?? "",
        permissoes: a.permissoes ?? [],
        apresentadorId: a.apresentador_id,
      };
    }
  } else {
    // Antes da 039 aplicada, meu_acesso() não existe: cai no caminho antigo.
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin === true) return { kind: "admin", ...base };
  }

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
});

/** Quem entra no admin: o admin ou alguém da equipe. */
export type Acesso = Extract<SessionRole, { kind: "admin" | "equipe" }>;

/** O acesso tem a permissão? Admin sempre tem. */
export function pode(acesso: SessionRole, p: Permissao): boolean {
  if (acesso.kind === "admin") return true;
  if (acesso.kind !== "equipe") return false;
  return permite(acesso.permissoes, p);
}

/** Nome para registrar quem fez (eventos, created_by). */
export function quem(acesso: Acesso): string {
  return acesso.email ?? acesso.userId;
}

function foraDoAdmin(role: SessionRole): never {
  if (role.kind === "anon") redirect("/admin/login");
  if (role.kind === "reseller") redirect("/revendedor");
  redirect("/sem-acesso");
}

/** Gate das telas só de admin (equipe e papéis, conexão de contas). */
export async function requireAdmin(): Promise<Extract<SessionRole, { kind: "admin" }>> {
  const role = await getSessionRole();
  if (role.kind === "admin") return role;
  if (role.kind === "equipe") redirect("/admin/sem-permissao");
  foraDoAdmin(role);
}

/** Qualquer pessoa do admin (ex.: Minha conta). */
export async function requireEquipe(): Promise<Acesso> {
  const role = await getSessionRole();
  if (role.kind === "admin" || role.kind === "equipe") return role;
  foraDoAdmin(role);
}

/**
 * Gate das PÁGINAS do admin. Sem a permissão, a pessoa da equipe vai para
 * /admin/sem-permissao (ou para a sua tela inicial, quando `inicio` é true —
 * usado em /admin, que é para onde o login manda todo mundo).
 */
export async function requireAcesso(p: Permissao, opts?: { inicio?: boolean }): Promise<Acesso> {
  const role = await requireEquipe();
  if (pode(role, p)) return role;
  if (opts?.inicio) redirect(inicioDoAcesso(role));
  redirect(`/admin/sem-permissao?p=${encodeURIComponent(p)}`);
}

/**
 * Gate das ACTIONS e rotas de API do admin. Sem a permissão, lança erro em vez
 * de redirecionar: o formulário mostra a mensagem no lugar.
 */
export async function exigir(p: Permissao): Promise<Acesso> {
  const role = await requireEquipe();
  if (pode(role, p)) return role;
  throw new Error("Seu acesso não permite esta ação. Fale com o administrador.");
}

/** Primeira tela que a pessoa pode abrir, na ordem do menu. */
export function inicioDoAcesso(role: Acesso): string {
  if (role.kind === "admin") return "/admin";
  for (const g of NAV) for (const i of g.itens) if (permite(role.permissoes, i.perm)) return i.href;
  return "/admin/senha";
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
 * Diferente de requireReseller(): o admin e o comercial da equipe também
 * passam. São páginas que eles abrem para conferir e usar nas próprias
 * reuniões — mandá-los para /admin ali seria só um beco sem saída.
 */
export async function requireResellerOrAdmin(): Promise<SessionRole> {
  const role = await getSessionRole();
  if (role.kind === "reseller" || role.kind === "admin") return role;
  if (role.kind === "equipe" && pode(role, "parceiros.ver")) return role;
  if (role.kind === "anon") redirect("/revendedor/login");
  if (role.kind === "equipe") redirect("/admin/sem-permissao");
  redirect("/sem-acesso");
}
