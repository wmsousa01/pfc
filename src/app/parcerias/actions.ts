"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";

export type LeadFormState = {
  ok: boolean;
  error: string | null;
};

/**
 * Recebe o formulário público de captação de leads da página /parcerias.
 * Insere via service-role (a tabela leads não tem policy de insert anônimo).
 */
export async function submitLead(
  _prev: LeadFormState,
  formData: FormData
): Promise<LeadFormState> {
  // Honeypot: campo invisível para humanos; bots preenchem.
  // Finge sucesso para não dar sinal ao bot.
  if (String(formData.get("site_url") ?? "").trim()) {
    return { ok: true, error: null };
  }

  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const segment = String(formData.get("segment") ?? "").trim() || null;
  const whatsappRaw = String(formData.get("whatsapp") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!name || !company || !whatsappRaw) {
    return { ok: false, error: "Preencha nome, empresa e WhatsApp." };
  }

  const digits = whatsappRaw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return { ok: false, error: "Informe um WhatsApp válido com DDD." };
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return {
      ok: false,
      error: "Não foi possível enviar agora. Fale direto no WhatsApp.",
    };
  }

  const { error } = await admin.from("leads").insert({
    name: name.slice(0, 120),
    company: company.slice(0, 120),
    segment,
    whatsapp: digits,
    message: message?.slice(0, 1000) ?? null,
    source: "parcerias",
  });

  if (error) {
    return {
      ok: false,
      error: "Não foi possível enviar agora. Fale direto no WhatsApp.",
    };
  }

  return { ok: true, error: null };
}
