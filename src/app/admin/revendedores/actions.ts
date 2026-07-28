"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { MAX_DISCOUNT_PERCENT } from "@/lib/commission";
import { toCents } from "@/lib/money";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function revalidateAll(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/revendedores");
  if (id) revalidatePath(`/admin/revendedores/${id}`);
  revalidatePath("/revendedor");
}

/**
 * Cria (ou reaproveita) a conta de login do revendedor e devolve o user_id.
 * Precisa do service-role: criar usuário é operação de admin do Supabase Auth.
 *
 * O caminho de "conta já existe" REDEFINE a senha dela. Isso é intencional
 * quando se trata do próprio revendedor, e desastroso em qualquer outro caso —
 * daí as duas travas abaixo. Sem elas, cadastrar um revendedor com o e-mail do
 * admin trocava a senha do admin e amarrava a conta dele ao revendedor.
 */
async function ensureAuthUser(
  email: string,
  password: string,
  /** Id do revendedor sendo salvo. Vazio quando é um cadastro novo. */
  resellerId: string
): Promise<string> {
  const admin = createAdminSupabase();
  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — não é possível criar o acesso."
    );
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error && created?.user) return created.user.id;

  // Já existe uma conta com esse e-mail.
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existing = list?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!existing) {
    throw new Error(`Não foi possível criar o acesso: ${error?.message}`);
  }

  // Trava 1: nunca sequestrar uma conta de admin. Além de trocar a senha dele,
  // não adiantaria nada — getSessionRole() resolve admin antes de revendedor,
  // então essa conta jamais abriria o painel do parceiro.
  const { data: isAdmin } = await admin
    .from("app_admins")
    .select("user_id")
    .eq("user_id", existing.id)
    .maybeSingle();

  if (isAdmin) {
    throw new Error(
      `${email} é uma conta de administrador. Use outro e-mail para o acesso do revendedor — o painel /revendedor não abre para quem é admin.`
    );
  }

  // Trava 2: a conta já é o acesso de OUTRO revendedor (user_id é unique).
  const { data: owner } = await admin
    .from("resellers")
    .select("id, name")
    .eq("user_id", existing.id)
    .maybeSingle();

  if (owner && owner.id !== resellerId) {
    throw new Error(
      `${email} já é o acesso de "${owner.name}". Use outro e-mail.`
    );
  }

  await admin.auth.admin.updateUserById(existing.id, { password });
  return existing.id;
}

export async function saveReseller(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slug = slugify(String(formData.get("slug") ?? "").trim() || name);

  if (!name || !slug) throw new Error("Nome e link/cupom são obrigatórios.");

  const commissionType =
    String(formData.get("commission_type") ?? "percent") === "fixed"
      ? "fixed"
      : "percent";

  // 'percent' guarda o percentual inteiro; 'fixed' guarda CENTAVOS por peça.
  const rawValue = String(formData.get("commission_value") ?? "").trim();
  const commissionValue =
    commissionType === "fixed"
      ? toCents(rawValue)
      : Math.max(0, Math.round(Number(rawValue.replace(",", ".")) || 0));

  // Trava o teto aqui também: o check do banco rejeitaria com erro cru de
  // Postgres, e quem está no formulário não merece ver isso.
  const discountPercent = Math.min(
    MAX_DISCOUNT_PERCENT,
    Math.max(0, Math.round(Number(formData.get("discount_percent")) || 0))
  );

  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  const password = String(formData.get("password") ?? "");

  const payload: Record<string, unknown> = {
    name,
    slug,
    email,
    whatsapp: String(formData.get("whatsapp") ?? "").replace(/\D/g, "") || null,
    role_label: String(formData.get("role_label") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    commission_type: commissionType,
    commission_value: commissionValue,
    discount_percent: discountPercent,
    active: formData.get("active") === "on",
  };

  // Senha preenchida = admin quer criar/renovar o acesso ao painel.
  if (password) {
    if (password.length < 8) {
      throw new Error("A senha de acesso precisa ter ao menos 8 caracteres.");
    }
    if (!email) {
      throw new Error("Informe o e-mail para criar o acesso ao painel.");
    }
    payload.user_id = await ensureAuthUser(email, password, id);
  }

  if (id) {
    const { error } = await supabase.from("resellers").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateAll(id);
  } else {
    const { error } = await supabase.from("resellers").insert(payload);
    if (error) throw new Error(error.message);
    revalidateAll();
  }

  redirect("/admin/revendedores");
}

export async function toggleResellerActive(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id) {
    await supabase.from("resellers").update({ active }).eq("id", id);
    revalidateAll(id);
  }
}

export async function deleteReseller(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const id = String(formData.get("id") ?? "");
  if (id) {
    // Os pedidos ficam (reseller_id vira null pelo on delete set null) —
    // apagar histórico de venda junto com o cadastro seria perda de dado.
    await supabase.from("resellers").delete().eq("id", id);
    revalidateAll();
  }
  redirect("/admin/revendedores");
}

/**
 * Marca como repassada a comissão de todos os pedidos entregues e pagos
 * de um revendedor. É o "acerto de contas" do mês.
 */
export async function payResellerCommission(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const resellerId = String(formData.get("reseller_id") ?? "");
  if (!resellerId) return;

  await supabase
    .from("orders")
    .update({ commission_paid: true, commission_paid_at: new Date().toISOString() })
    .eq("reseller_id", resellerId)
    .eq("commission_paid", false)
    .eq("status", "entregue")
    .eq("payment_status", "pago");

  revalidateAll(resellerId);
  revalidatePath("/admin/pedidos");
}
