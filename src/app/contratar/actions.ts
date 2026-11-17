"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isSelfServe, opcao } from "@/lib/checkout";
import {
  acceptTerms,
  contratoDoCheckout,
  createCheckout,
  getCheckout,
  getLeadPrefill,
  hojeSP,
  markAwaiting,
} from "@/lib/checkout-store";
import { isValidDocument } from "@/lib/client-area";
import { gravarLead, parceiroDoCookie } from "@/lib/indicacoes-store";
import { createPreference, mpConfigured } from "@/lib/mercadopago";
import { planById } from "@/lib/planos";

export type CheckoutFormState = { error: string | null };

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);

/** Passo 1 e 2: plano, prazo, pagamento e dados. Cria o checkout e leva à revisão. */
export async function iniciarCheckout(
  _prev: CheckoutFormState,
  form: FormData
): Promise<CheckoutFormState> {
  if (str(form, "site_url")) return { error: null }; // honeypot

  const planId = str(form, "plan");
  const plan = planById(planId);
  const leadParam = str(form, "lead");
  const lead = leadParam ? await getLeadPrefill(leadParam) : null;
  if (!plan) return { error: "Plano inválido." };
  // Master só pelo link do comercial (exclusividade por segmento).
  if (!isSelfServe(planId) && !lead) {
    return { error: "Este plano é fechado com o comercial. Fale com a gente pelo WhatsApp." };
  }

  const op = opcao(planId, str(form, "periodo"), str(form, "metodo"));
  if (!op) return { error: "Escolha o prazo e a forma de pagamento." };

  const company = str(form, "company", 120);
  const name = str(form, "name", 120);
  const email = str(form, "email", 160).toLowerCase();
  const whatsapp = str(form, "whatsapp", 30).replace(/\D/g, "");
  const document = str(form, "document", 30).replace(/\D/g, "");
  const segment = str(form, "segment", 80) || null;
  const instagram = str(form, "instagram", 80).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "") || null;

  if (!company || !name) return { error: "Preencha o nome da empresa e o seu nome." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Informe um e-mail válido." };
  if (whatsapp.length < 10 || whatsapp.length > 13) return { error: "Informe um WhatsApp válido com DDD." };
  if (!isValidDocument(document)) return { error: "CPF ou CNPJ inválido." };

  let leadId = lead?.id ?? null;
  if (!leadId) {
    const r = await gravarLead({
      name,
      company,
      segment,
      whatsapp,
      message: `Checkout: Plano ${plan.name}, ${op.titulo}, R$ ${op.valor}`,
      source: "checkout",
    });
    leadId = r.id ?? null;
  }
  const parceiro = await parceiroDoCookie();

  const id = await createCheckout({
    lead_id: leadId,
    reseller_id: parceiro?.id ?? null,
    origem: lead ? "admin" : "site",
    opcao: op,
    plan: plan.id,
    company,
    name,
    document,
    email,
    whatsapp,
    segment,
    instagram,
  });
  if (!id) return { error: "Não foi possível seguir agora. Tente de novo ou fale no WhatsApp." };
  redirect(`/contratar/revisao/${id}`);
}

function origin(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "www.pfctv.com.br";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Passo 3 → 4: aceite dos termos e ida ao Mercado Pago. */
export async function aceitarEPagar(form: FormData): Promise<void> {
  const id = str(form, "id", 40);
  const c = await getCheckout(id);
  if (!c) redirect("/parcerias");
  if (c.status === "pago") redirect(`/comecar/${c.onboarding_token}`);
  if (form.get("aceite") !== "on") redirect(`/contratar/revisao/${id}?erro=aceite`);
  if (!mpConfigured()) redirect(`/contratar/revisao/${id}?erro=mp`);

  const op = opcao(c.plan, c.periodo, c.metodo);
  const plan = planById(c.plan);
  if (!op || !plan) redirect("/parcerias");

  // Os termos aceitos são os exibidos: a data de início vem da página
  // (hoje ou ontem, se a pessoa leu virando a meia-noite).
  const contract = contratoDoCheckout(c, op.pagamento);
  if (!contract) redirect("/parcerias");
  const shownStart = str(form, "start", 10);
  const ontem = new Date(Date.now() - 864e5).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  if (shownStart === hojeSP() || shownStart === ontem) contract.start = shownStart;

  const h = headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const ok = await acceptTerms(c, contract, { ip, userAgent: h.get("user-agent") });
  if (!ok) redirect(`/contratar/revisao/${id}?erro=termos`);

  const pref = await createPreference({
    checkoutId: c.id,
    title: `PFC · Plano ${plan.name} (${c.meses} meses)`,
    description: `Patrocínio Fora da Caixa, ${op.titulo}`,
    amount: Number(c.valor),
    metodo: c.metodo,
    payer: { name: c.name, email: c.email },
    origin: origin(),
  });
  if (!pref) redirect(`/contratar/revisao/${id}?erro=mp`);
  await markAwaiting(c.id, pref.id);
  redirect(pref.url);
}
