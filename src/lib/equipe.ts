import "server-only";
import { MIN_PASSWORD_LENGTH } from "./config";
import { permissoesValidas } from "./permissoes";
import { createAdminSupabase } from "./supabase/admin";

export type Papel = {
  chave: string;
  nome: string;
  descricao: string;
  permissoes: string[];
  ordem: number;
  /** Quantas pessoas têm o papel (para a tela avisar antes de apagar). */
  membros: number;
};

export type Membro = {
  user_id: string;
  nome: string;
  email: string;
  ativo: boolean;
  papeis: string[];
  permissoes_extras: string[];
  apresentador_id: string | null;
  created_at: string;
};

export type CadastroApresentador = { id: string; nome: string; email: string | null };

function sb() {
  const c = createAdminSupabase();
  if (!c) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  return c;
}

export async function listarPapeis(): Promise<Papel[]> {
  const [{ data: papeis }, { data: vinculos }] = await Promise.all([
    sb().from("papeis").select("chave, nome, descricao, permissoes, ordem").order("ordem").order("nome"),
    sb().from("equipe_papeis").select("papel"),
  ]);
  const conta = new Map<string, number>();
  for (const v of (vinculos ?? []) as { papel: string }[]) conta.set(v.papel, (conta.get(v.papel) ?? 0) + 1);
  return ((papeis ?? []) as Omit<Papel, "membros">[]).map((p) => ({ ...p, membros: conta.get(p.chave) ?? 0 }));
}

export async function listarEquipe(): Promise<Membro[]> {
  const [{ data: membros }, { data: vinculos }] = await Promise.all([
    sb()
      .from("equipe")
      .select("user_id, nome, email, ativo, permissoes_extras, apresentador_id, created_at")
      .order("ativo", { ascending: false })
      .order("nome"),
    sb().from("equipe_papeis").select("user_id, papel"),
  ]);
  const porUsuario = new Map<string, string[]>();
  for (const v of (vinculos ?? []) as { user_id: string; papel: string }[]) {
    porUsuario.set(v.user_id, [...(porUsuario.get(v.user_id) ?? []), v.papel]);
  }
  return ((membros ?? []) as Omit<Membro, "papeis">[]).map((m) => ({ ...m, papeis: porUsuario.get(m.user_id) ?? [] }));
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

/** Cadastros aprovados em /admin/apresentadores, para ligar ao login. */
export async function listarCadastrosApresentador(): Promise<CadastroApresentador[]> {
  const { data } = await sb()
    .from("apresentadores_cadastros")
    .select("id, nome, email")
    .eq("status", "aprovado")
    .is("termo_revogado_em", null)
    .order("nome");
  return (data ?? []) as CadastroApresentador[];
}

async function contaPorEmail(email: string) {
  // Base pequena: a primeira página cobre todo mundo (mesmo jeito do cadastro de revendedor).
  const { data } = await sb().auth.admin.listUsers({ page: 1, perPage: 1000 });
  return data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

/**
 * Cria a conta de login do membro, ou reaproveita a que já existe com o e-mail.
 * Travas: conta de admin já abre tudo, e conta de revendedor tem o painel dele
 * (getSessionRole decide por um só papel), então nenhuma das duas vira membro.
 * Conta que já existe só tem a senha trocada se o admin preencheu uma.
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
  papeis: string[];
  extras: string[];
  apresentador_id: string;
};

export async function salvarMembro(d: DadosMembro, actor: string): Promise<void> {
  const nome = d.nome.trim().slice(0, 120);
  const email = d.email.trim().toLowerCase();
  if (!nome) throw new Error("Informe o nome.");
  if (!d.user_id && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("E-mail inválido.");

  const existentes = new Set((await listarPapeis()).map((p) => p.chave));
  const papeis = Array.from(new Set(d.papeis.filter((p) => existentes.has(p))));
  const extras = permissoesValidas(d.extras);
  if (papeis.length === 0 && extras.length === 0) throw new Error("Escolha ao menos um papel.");
  const apresentador_id = d.apresentador_id || null;

  let userId = d.user_id;
  const agora = new Date().toISOString();
  if (userId) {
    if (d.senha) {
      if (d.senha.length < MIN_PASSWORD_LENGTH) throw new Error(`A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      await sb().auth.admin.updateUserById(userId, { password: d.senha });
    }
    const { error } = await sb()
      .from("equipe")
      .update({ nome, permissoes_extras: extras, apresentador_id, updated_at: agora })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
  } else {
    userId = await garantirConta(email, d.senha);
    const { error } = await sb().from("equipe").upsert({
      user_id: userId,
      nome,
      email,
      permissoes_extras: extras,
      apresentador_id,
      ativo: true,
      created_by: actor,
      updated_at: agora,
    });
    if (error) throw new Error(error.message);
  }

  // Troca a lista inteira: apaga o que saiu, insere o que entrou.
  const { error: delErr } = await sb()
    .from("equipe_papeis")
    .delete()
    .eq("user_id", userId)
    .not("papel", "in", `(${papeis.map((p) => `"${p}"`).join(",") || '""'})`);
  if (delErr) throw new Error(delErr.message);
  if (papeis.length) {
    const { error } = await sb()
      .from("equipe_papeis")
      .upsert(papeis.map((papel) => ({ user_id: userId, papel })), { onConflict: "user_id,papel", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
}

export async function definirAtivo(userId: string, ativo: boolean): Promise<void> {
  const { error } = await sb().from("equipe").update({ ativo, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) throw new Error(error.message);
}

function chaveDe(nome: string): string {
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export type DadosPapel = { chave?: string; nome: string; descricao: string; permissoes: string[] };

export async function salvarPapel(d: DadosPapel): Promise<void> {
  const nome = d.nome.trim().slice(0, 60);
  if (!nome) throw new Error("Dê um nome ao papel.");
  const permissoes = permissoesValidas(d.permissoes);
  if (permissoes.length === 0) throw new Error("Marque ao menos uma permissão.");
  const descricao = d.descricao.trim().slice(0, 200);
  const agora = new Date().toISOString();

  if (d.chave) {
    const { error } = await sb().from("papeis").update({ nome, descricao, permissoes, updated_at: agora }).eq("chave", d.chave);
    if (error) throw new Error(error.message);
    return;
  }
  const chave = chaveDe(nome);
  if (chave.length < 2) throw new Error("Use um nome com letras ou números.");
  const { error } = await sb().from("papeis").insert({ chave, nome, descricao, permissoes, ordem: 500 });
  if (error) throw new Error(error.code === "23505" ? `Já existe um papel com o nome "${nome}".` : error.message);
}

export async function apagarPapel(chave: string): Promise<void> {
  const { count } = await sb().from("equipe_papeis").select("user_id", { count: "exact", head: true }).eq("papel", chave);
  if (count) throw new Error("Este papel ainda está em uso. Tire ele das pessoas antes de apagar.");
  const { error } = await sb().from("papeis").delete().eq("chave", chave);
  if (error) throw new Error(error.message);
}
