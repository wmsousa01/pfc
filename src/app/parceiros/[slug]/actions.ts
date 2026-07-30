"use server";

import { getPartnerBySlug } from "@/lib/partners";
import {
  createPartnerLead,
  markLeadHandedOff,
} from "@/lib/partner-leads";
import {
  buildLeadBrief,
  normalizeWhatsapp,
  type TriageAnswers,
} from "@/lib/lead-triage";
import { site, whatsappNumber } from "@/lib/config";
import type { LeadTemperature } from "@/lib/types";

export type PartnerLeadState = {
  ok: boolean;
  error: string | null;
  /** Link do WhatsApp do parceiro já com o briefing do lead. */
  waUrl: string | null;
  temperature: LeadTemperature | null;
  leadId: string | null;
};

// Arquivo "use server" só pode exportar funções async — o estado inicial mora
// no componente do formulário (src/components/partner/PartnerLeadForm.tsx).
const EMPTY_STATE: PartnerLeadState = {
  ok: false,
  error: null,
  waUrl: null,
  temperature: null,
  leadId: null,
};

function fail(error: string): PartnerLeadState {
  return { ...EMPTY_STATE, error };
}

/**
 * Triagem da página do parceiro: valida, pontua, grava e devolve o link do
 * WhatsApp do parceiro já com o briefing pronto. O lead fica registrado no
 * PFC mesmo que ele não clique — é assim que a parceria vira número.
 */
export async function submitPartnerLead(
  _prev: PartnerLeadState,
  formData: FormData
): Promise<PartnerLeadState> {
  // Honeypot invisível: bot preenche, humano não. Finge sucesso sem gravar.
  if (String(formData.get("site_url") ?? "").trim()) {
    return { ...EMPTY_STATE, ok: true };
  }

  const slug = String(formData.get("slug") ?? "").trim();
  const partner = slug ? await getPartnerBySlug(slug) : null;
  if (!partner) return fail("Parceiro indisponível no momento.");

  const name = String(formData.get("name") ?? "").trim();
  const whatsapp = normalizeWhatsapp(String(formData.get("whatsapp") ?? ""));

  if (!name) return fail("Diga seu nome para a gente te chamar direito.");
  if (!whatsapp) return fail("Informe um WhatsApp válido com DDD.");

  const qtyRaw = String(formData.get("quantity") ?? "").trim();
  const qty = Number.parseInt(qtyRaw, 10);

  const answers: TriageAnswers = {
    name: name.slice(0, 120),
    whatsapp,
    business_type: String(formData.get("business_type") ?? "").trim(),
    need: String(formData.get("need") ?? "").trim(),
    mode: String(formData.get("mode") ?? "").trim(),
    quantity: Number.isFinite(qty) && qty > 0 ? Math.min(qty, 99) : null,
    timeframe: String(formData.get("timeframe") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    note: String(formData.get("note") ?? "").trim(),
  };

  const source = String(formData.get("source") ?? "").trim() || null;

  const { lead, result } = await createPartnerLead(partner, answers, { source });

  const brief = buildLeadBrief(answers, result, partner.name, site.brand);
  const destination = partner.whatsapp?.replace(/\D/g, "") || whatsappNumber;

  return {
    ok: true,
    error: null,
    waUrl: `https://wa.me/${destination}?text=${encodeURIComponent(brief)}`,
    temperature: result.temperature,
    leadId: lead?.id ?? null,
  };
}

/** Registra que o lead seguiu para o WhatsApp do parceiro. */
export async function handOffLead(leadId: string): Promise<void> {
  if (!leadId) return;
  await markLeadHandedOff(leadId);
}
