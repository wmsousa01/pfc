import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { createClientEpic } from "@/lib/jira";
import { getPayment, findPaymentsByReference, type MpPayment } from "@/lib/mercadopago";
import { planById } from "@/lib/planos";
import { buildTerms, CURRENT_TERMS_VERSION } from "@/lib/terms";
import { entregasDoPlano, type OpcaoPagamento } from "@/lib/checkout";
import type { ClientContract } from "@/lib/types";

export type Checkout = {
  id: string;
  lead_id: string | null;
  reseller_id: string | null;
  origem: string;
  plan: string;
  periodo: string;
  metodo: "pix" | "cartao";
  meses: number;
  valor: number;
  company: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  segment: string | null;
  instagram: string | null;
  contract: ClientContract | null;
  terms_version: string | null;
  terms_hash: string | null;
  accepted_at: string | null;
  ip: string | null;
  user_agent: string | null;
  status: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  paid_at: string | null;
  erro: string | null;
  partner_id: string | null;
  onboarding_token: string;
  onboarding_done_at: string | null;
  created_at: string;
  updated_at: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string) => UUID.test(v);

const db = () => {
  const admin = createAdminSupabase();
  if (!admin) throw new Error("Supabase sem service role");
  return admin;
};

/** Hoje em São Paulo, YYYY-MM-DD. */
export function hojeSP(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function getCheckout(id: string): Promise<Checkout | null> {
  if (!isUuid(id)) return null;
  const { data } = await db().from("checkouts").select("*").eq("id", id).maybeSingle();
  return (data as Checkout) ?? null;
}

export async function getCheckoutByToken(token: string): Promise<Checkout | null> {
  if (!isUuid(token)) return null;
  const { data } = await db().from("checkouts").select("*").eq("onboarding_token", token).maybeSingle();
  return (data as Checkout) ?? null;
}

export async function listCheckouts(limit = 50): Promise<Checkout[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data, error } = await admin
    .from("checkouts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  // Migração 030 ainda não rodou: o admin segue sem a seção.
  if (error) return [];
  return (data as Checkout[]) ?? [];
}

export type LeadPrefill = { id: string; name: string; company: string; whatsapp: string; segment: string | null };

export async function getLeadPrefill(id: string): Promise<LeadPrefill | null> {
  if (!isUuid(id)) return null;
  const { data } = await db()
    .from("leads")
    .select("id, name, company, whatsapp, segment")
    .eq("id", id)
    .maybeSingle();
  return (data as LeadPrefill) ?? null;
}

export async function createCheckout(row: {
  lead_id: string | null;
  reseller_id: string | null;
  origem: string;
  opcao: OpcaoPagamento;
  plan: string;
  company: string;
  name: string;
  document: string;
  email: string;
  whatsapp: string;
  segment: string | null;
  instagram: string | null;
}): Promise<string | null> {
  const { opcao, ...rest } = row;
  const { data, error } = await db()
    .from("checkouts")
    .insert({
      ...rest,
      periodo: opcao.periodo,
      metodo: opcao.metodo,
      meses: opcao.meses,
      valor: opcao.valor,
    })
    .select("id")
    .single();
  if (error) {
    console.error("[checkout] criar", error.message);
    return null;
  }
  return (data as { id: string }).id;
}

/** Contrato que o cliente vê na revisão (início = hoje). */
export function contratoDoCheckout(c: Checkout, pagamento: string): ClientContract | null {
  const plan = planById(c.plan);
  if (!plan) return null;
  return {
    plan: plan.name,
    price: Number(c.valor),
    payment: pagamento,
    start: hojeSP(),
    months: c.meses,
    deliverables: entregasDoPlano(plan, c.meses),
    terms_version: CURRENT_TERMS_VERSION,
  };
}

/** Grava o aceite. O contrato aceito é o que vale no pagamento, sem recalcular. */
export async function acceptTerms(
  c: Checkout,
  contract: ClientContract,
  meta: { ip: string | null; userAgent: string | null }
): Promise<boolean> {
  const terms = buildTerms(c.company, contract);
  if (!terms) return false;
  const { error } = await db()
    .from("checkouts")
    .update({
      contract,
      terms_version: terms.version,
      terms_hash: terms.hash,
      accepted_at: new Date().toISOString(),
      ip: meta.ip,
      user_agent: meta.userAgent?.slice(0, 400) ?? null,
    })
    .eq("id", c.id)
    .in("status", ["aberto", "aguardando", "recusado"]);
  return !error;
}

export async function markAwaiting(id: string, preferenceId: string): Promise<void> {
  await db()
    .from("checkouts")
    .update({ status: "aguardando", mp_preference_id: preferenceId })
    .eq("id", id)
    .in("status", ["aberto", "aguardando", "recusado"]);
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "parceiro";
}

async function uniqueSlug(base: string): Promise<string> {
  const { data } = await db().from("partners").select("slug").like("slug", `${base}%`);
  const taken = new Set(((data ?? []) as { slug: string }[]).map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let i = 2; i < 100; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
  return `${base}-${Date.now().toString(36)}`;
}

/**
 * Aplica o resultado de um pagamento do MP ao checkout. Idempotente: webhook
 * e página de retorno podem chamar ao mesmo tempo, e só quem conseguir trocar
 * o status para "processando" cria o parceiro.
 */
export async function applyPayment(p: MpPayment): Promise<Checkout | null> {
  const ref = p.external_reference ?? "";
  const c = await getCheckout(ref);
  if (!c) return null;
  if (c.status === "pago") return c;

  if (p.status !== "approved") {
    // Pendente (Pix gerado, boleto) ou recusado: só registra.
    const status = p.status === "rejected" || p.status === "cancelled" ? "recusado" : "aguardando";
    await db()
      .from("checkouts")
      .update({ status, mp_payment_id: String(p.id), mp_status: `${p.status}/${p.status_detail}` })
      .eq("id", c.id)
      .in("status", ["aberto", "aguardando", "recusado"]);
    return getCheckout(c.id);
  }

  if (p.currency_id !== "BRL" || p.transaction_amount + 0.01 < Number(c.valor)) {
    await db()
      .from("checkouts")
      .update({
        status: "divergente",
        mp_payment_id: String(p.id),
        mp_status: `${p.status}/${p.status_detail}`,
        erro: `Pago ${p.currency_id} ${p.transaction_amount}, esperado ${c.valor}`,
      })
      .eq("id", c.id)
      .neq("status", "pago");
    return getCheckout(c.id);
  }

  // Trava: só uma execução passa daqui.
  const { data: claimed } = await db()
    .from("checkouts")
    .update({ status: "processando", mp_payment_id: String(p.id), mp_status: `${p.status}/${p.status_detail}` })
    .eq("id", c.id)
    .in("status", ["aberto", "aguardando", "recusado", "erro"])
    .select("id");
  if (!claimed?.length) return getCheckout(c.id);

  try {
    await ativarCliente(c, p);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[checkout] ativar", c.id, msg);
    await db().from("checkouts").update({ status: "erro", erro: msg.slice(0, 500) }).eq("id", c.id);
  }
  return getCheckout(c.id);
}

/** Pagamento aprovado: cria o parceiro, o portal, o aceite e fecha o lead. */
async function ativarCliente(c: Checkout, p: MpPayment): Promise<void> {
  const admin = db();
  const plan = planById(c.plan);
  if (!plan || !c.contract) throw new Error("Checkout sem plano ou sem contrato aceito");

  // 1. Parceiro (inativo até a produção montar a página). Retentativa reusa.
  let partnerId = c.partner_id;
  if (!partnerId) {
    const slug = await uniqueSlug(slugify(c.company));
    const { data, error } = await admin
      .from("partners")
      .insert({
        name: c.company,
        slug,
        plan: plan.name,
        whatsapp: c.whatsapp.startsWith("55") ? c.whatsapp : `55${c.whatsapp}`,
        instagram: c.instagram,
        active: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(`parceiro: ${error.message}`);
    partnerId = (data as { id: string }).id;
    await admin.from("checkouts").update({ partner_id: partnerId }).eq("id", c.id);
  }

  // 2. Epic do cliente no Jira (sem Jira, o portal funciona sem a aba de entregas).
  const { data: panel } = await admin
    .from("partner_panels")
    .select("jira_epic")
    .eq("partner_id", partnerId)
    .maybeSingle();
  let epic = (panel as { jira_epic: string | null } | null)?.jira_epic ?? null;
  if (!epic) {
    epic = await createClientEpic(c.company, plan.name, [
      `Contratado pelo site: Plano ${plan.name}, ${c.meses} meses, R$ ${Number(c.valor).toFixed(2)} (${c.contract.payment}).`,
      `Pagamento Mercado Pago ${p.id}. Contato: ${c.name}, WhatsApp ${c.whatsapp}, ${c.email}.`,
      "Onboarding: o cliente envia logo, cores e WhatsApp de atendimento em /comecar. Depois, montar a página e ativar o parceiro no admin.",
    ]).catch(() => null);
  }

  const { error: panelErr } = await admin
    .from("partner_panels")
    .upsert({ partner_id: partnerId, contract: c.contract, jira_epic: epic }, { onConflict: "partner_id" });
  if (panelErr) throw new Error(`portal: ${panelErr.message}`);

  // 3. Aceite oficial (tabela imutável) com o horário real do aceite.
  const { error: termsErr } = await admin.from("partner_terms_acceptances").insert({
    partner_id: partnerId,
    terms_version: c.terms_version,
    terms_hash: c.terms_hash,
    accepted_name: c.name,
    accepted_document: c.document,
    ip: c.ip,
    user_agent: c.user_agent,
    accepted_at: c.accepted_at,
  });
  if (termsErr && termsErr.code !== "23505") throw new Error(`aceite: ${termsErr.message}`);
  // 4. Lead fechado.
  if (c.lead_id) await admin.from("leads").update({ status: "fechado" }).eq("id", c.lead_id);

  const { error } = await admin
    .from("checkouts")
    .update({
      status: "pago",
      paid_at: p.date_approved ?? new Date().toISOString(),
      erro: null,
    })
    .eq("id", c.id);
  if (error) throw new Error(error.message);
}

/** Confere no MP o que aconteceu com o checkout (retorno do pagamento, botão do admin). */
export async function syncCheckout(c: Checkout, paymentId?: string | null): Promise<Checkout> {
  if (c.status === "pago") return c;
  let p: MpPayment | null = null;
  if (paymentId) p = await getPayment(paymentId);
  if (p && p.external_reference !== c.id) p = null;
  if (!p) {
    const all = await findPaymentsByReference(c.id);
    p = all.find((x) => x.status === "approved") ?? all[0] ?? null;
  }
  if (!p) return c;
  return (await applyPayment(p)) ?? c;
}

export async function getPanelToken(partnerId: string): Promise<string | null> {
  const { data } = await db().from("partner_panels").select("token").eq("partner_id", partnerId).maybeSingle();
  return (data as { token: string } | null)?.token ?? null;
}

export type MarcaDoParceiro = {
  slug: string;
  logo_url: string | null;
  accent: string | null;
  website: string | null;
  tagline: string | null;
  description: string | null;
  whatsapp: string | null;
  instagram: string | null;
  city: string | null;
};

export async function getMarca(partnerId: string): Promise<MarcaDoParceiro | null> {
  const { data } = await db()
    .from("partners")
    .select("slug, logo_url, accent, website, tagline, description, whatsapp, instagram, city")
    .eq("id", partnerId)
    .maybeSingle();
  return (data as MarcaDoParceiro) ?? null;
}
