import "server-only";
import { MIN_PASSWORD_LENGTH } from "./config";
import { areasValidas, isPapel, type Papel } from "./permissoes";
import { createAdminSupabase } from "./supabase/admin";

export type Membro = {
  user_id: string;
  nome: string;
  email: string;
  papel: Papel;
  areas: string[];
  ativo: boolean;
  created_at: string;
};

function sb() {
  const c = createAdminSupabase();
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return c;
}

export async function listarEquipe(): Promise<Membro[]> {
  const { data } = await sb().from("equipe").select("*").order("ativo", { ascending: false }).order("nome");
  return (data ?? []) as Membro[];
}

/** E-mails de quem está em app_admins, para a tela mostrar quem já tem acesso total. */
export async function listarAdmins(): Promise<string[]> {
  const { data } = await sb().from("app_admins").select("user_id");
  const ids = ((data ?? []) as { user_id: string }[]).map((a) => a.user_id);
  const out: string[] = [];
  for (const id of ids) {
    const { data: u } = await sb().auth.admin.getUserById(id);
    out.push(u.user?.email ?? id);
  }
  return out;
}

async function contaPorEmail(email: string) {
  // Base pequena: a primeira página cobre todo mundo (mesmo jeito do cadastro de revendedor).
  const { data } = await sb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Cria a conta de login do membro, ou reaproveita a que já existe com o e-mail.
 * Travas: conta de admin já abre tudo, e conta de revendedor cai no painel do
 * revendedor antes de chegar na equipe (getSessionRole), então nenhuma das
 * duas pode virar membro. Conta que já existe só tem a senha trocada se o admin
 * preencheu uma.
 */
async function garantirConta(email: string, senha: string): Promise<string> {
  const existente = await contaPorEmail(email);
  if (!existente) {
    if (senha.length < MIN_PASSWORD_LENGTH) throw new Error(`Defina uma senha inicial com ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    const { data, error } = await sb().auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (error || !data.user) throw new Error(`Não foi possível criar o acesso: ${error?.message}`);
    return data.user.id;
  }

  const { data: admin } = await sb().from("app_admins").select("user_id").eq("user_id", existente.id).maybeSingle();
  if (admin) throw new Error(`${email} já é administrador e abre todas as áreas.`);
  const { data: rev } = await sb().from("resellers").select("name").eq("user_id", existente.id).maybeSingle();
  if (rev) throw new Error(`${email} é o acesso do revendedor "${rev.name}". Use outro e-mail.`);

  if (senha) {
    if (senha.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    await sb().auth.admin.updateUserById(existente.id, { password: senha });
  }
  return existente.id;
}

export type DadosMembro = {
  user_id?: string;
  nome: string;
  email: string;
  senha: string;
  papel: string;
  areas: string[];
};

export async function salvarMembro(d: DadosMembro, actor: string): Promise<void> {
  const nome = d.nome.trim().slice(0, 120);
  const email = d.email.trim().toLowerCase();
  if (!nome) throw new Error("Informe o nome.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");
  const papel = isPapel(d.papel) ? d.papel : "personalizado";
  const areas = areasValidas(d.areas);
  if (areas.length === 0) throw new Error("Libere ao menos uma área.");

  if (d.user_id) {
    if (d.senha) {
      if (d.senha.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      await sb().auth.admin.updateUserById(d.user_id, { password: d.senha });
    }
    const { error } = await sb()
      .from("equipe")
      .update({ nome, papel, areas, updated_at: new Date().toISOString() })
      .eq("user_id", d.user_id);
    if (error) throw new Error(error.message);
    return;
  }

  const userId = await garantirConta(email, d.senha);
  const { error } = await sb()
    .from("equipe")
    .upsert({ user_id: userId, nome, email, papel, areas, ativo: true, created_by: actor, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function definirAtivo(userId: string, ativo: boolean): Promise<void> {
  const { error } = await sb().from("equipe").update({ ativo, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
