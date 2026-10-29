import "server-only";
import { createAdminSupabase } from "./supabase/admin";
import type {
  LeadTemperature,
  Partner,
  PartnerLead,
  PartnerLeadStatus,
} from "./types";
import { scoreLead, type LeadScore, type TriageAnswers } from "./lead-triage";
import { scoreImovelLead, type ImovelAnswers } from "./lead-triage-imoveis";

export type LeadMeta = {
  /** 'qr' | 'direct' | 'ig' ... — de onde a visita veio. */
  source?: string | null;
  channel?: string;
};

/**
 * Grava o lead já pontuado. Usa service-role: `partner_leads` não tem policy
 * anônima, então nem o formulário público nem um scraper leem a tabela.
 */
export async function createPartnerLead(
  partner: Partner,
  answers: TriageAnswers,
  meta: LeadMeta = {}
): Promise<{ lead: PartnerLead | null; result: LeadScore }> {
  const result = scoreLead(answers, partner.content?.triage);

  const admin = createAdminSupabase();
  if (!admin) return { lead: null, result };

  const { data } = await admin
    .from("partner_leads")
    .insert({
      partner_id: partner.id,
      name: answers.name.slice(0, 120),
      whatsapp: answers.whatsapp,
      city: answers.city.trim().slice(0, 120) || null,
      business_type: answers.business_type || null,
      need: answers.need || null,
      mode: answers.mode || null,
      quantity: answers.quantity,
      timeframe: answers.timeframe || null,
      note: answers.note.trim().slice(0, 1000) || null,
      score: result.score,
      temperature: result.temperature,
      channel: meta.channel ?? "site",
      source: meta.source ?? null,
      answers: { ...answers, reasons: result.reasons },
    })
    .select("*")
    .maybeSingle();

  return { lead: (data as PartnerLead) ?? null, result };
}

/**
 * Lead da triagem de imóveis. Mesmas colunas, outro significado (ver
 * lead-triage-imoveis.ts); `answers.kind` é o que o painel lê para rotular.
 */
export async function createImovelLead(
  partner: Partner,
  answers: ImovelAnswers,
  meta: LeadMeta = {}
): Promise<{ lead: PartnerLead | null; result: ReturnType<typeof scoreImovelLead> }> {
  const result = scoreImovelLead(answers);

  const admin = createAdminSupabase();
  if (!admin) return { lead: null, result };

  const { data } = await admin
    .from("partner_leads")
    .insert({
      partner_id: partner.id,
      name: answers.name.slice(0, 120),
      whatsapp: answers.whatsapp,
      city: answers.city.trim().slice(0, 120) || null,
      business_type: answers.business_type || null,
      need: answers.need || null,
      mode: answers.mode || null,
      quantity: null,
      timeframe: answers.timeframe || null,
      note: answers.note.trim().slice(0, 1000) || null,
      score: result.score,
      temperature: result.temperature,
      channel: meta.channel ?? "site",
      source: meta.source ?? null,
      answers: { ...answers, kind: "imoveis", reasons: result.reasons },
    })
    .select("*")
    .maybeSingle();

  return { lead: (data as PartnerLead) ?? null, result };
}

/** Marca que o lead foi levado ao WhatsApp do parceiro (fim do funil no site). */
export async function markLeadHandedOff(leadId: string): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin
    .from("partner_leads")
    .update({ handed_off_at: new Date().toISOString() })
    .eq("id", leadId)
    .is("handed_off_at", null);
}

export async function getPartnerLeads(
  partnerId: string,
  limit = 200
): Promise<PartnerLead[]> {
  const admin = createAdminSupabase();
  if (!admin) return [];
  const { data } = await admin
    .from("partner_leads")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as PartnerLead[]) ?? [];
}

export type PartnerLeadSummary = {
  total: number;
  novos: number;
  quentes: number;
  last7d: number;
  byTemperature: Record<LeadTemperature, number>;
};

export function summarizePartnerLeads(leads: PartnerLead[]): PartnerLeadSummary {
  const since7d = Date.now() - 7 * 86_400_000;
  const byTemperature: Record<LeadTemperature, number> = {
    quente: 0,
    morno: 0,
    frio: 0,
  };

  let novos = 0;
  let last7d = 0;

  for (const l of leads) {
    byTemperature[l.temperature] = (byTemperature[l.temperature] ?? 0) + 1;
    if (l.status === "novo") novos += 1;
    if (new Date(l.created_at).getTime() >= since7d) last7d += 1;
  }

  return {
    total: leads.length,
    novos,
    quentes: byTemperature.quente,
    last7d,
    byTemperature,
  };
}

export async function updatePartnerLeadStatus(
  leadId: string,
  status: PartnerLeadStatus
): Promise<void> {
  const admin = createAdminSupabase();
  if (!admin) return;
  await admin.from("partner_leads").update({ status }).eq("id", leadId);
}

/**
 * Painel do parceiro: resolve o parceiro a partir do token secreto.
 * Token inválido devolve null — a página responde 404.
 */
export async function getPartnerByPanelToken(
  token: string
): Promise<Partner | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  // Token é uuid; qualquer coisa fora desse formato nem vai ao banco.
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
  if (!isUuid) return null;

  const { data } = await admin
    .from("partner_panels")
    .select("partner_id")
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;

  const { data: partner } = await admin
    .from("partners")
    .select("*")
    .eq("id", (data as { partner_id: string }).partner_id)
    .maybeSingle();

  return (partner as Partner) ?? null;
}

/** Token do painel de um parceiro (cria na hora se ainda não existir). */
export async function getOrCreatePanelToken(
  partnerId: string
): Promise<string | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;

  const { data } = await admin
    .from("partner_panels")
    .select("token")
    .eq("partner_id", partnerId)
    .maybeSingle();

  if (data) return (data as { token: string }).token;

  const { data: created } = await admin
    .from("partner_panels")
    .insert({ partner_id: partnerId })
    .select("token")
    .maybeSingle();

  return (created as { token: string } | null)?.token ?? null;
}

export type ClickSummary = {
  total: number;
  last7d: number;
  last30d: number;
  qr: number;
  /** Série diária dos últimos 30 dias (para o mini-gráfico do painel). */
  daily: { day: string; count: number }[];
};

export async function getPartnerClickSummary(
  partnerId: string
): Promise<ClickSummary> {
  const admin = createAdminSupabase();
  const empty: ClickSummary = { total: 0, last7d: 0, last30d: 0, qr: 0, daily: [] };
  if (!admin) return empty;

  const since = new Date(Date.now() - 30 * 86_400_000);
  const { data } = await admin
    .from("partner_clicks")
    .select("source, created_at")
    .eq("partner_id", partnerId)
    .gte("created_at", since.toISOString());

  const { count } = await admin
    .from("partner_clicks")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId);

  const rows = (data ?? []) as { source: string | null; created_at: string }[];
  const d7 = Date.now() - 7 * 86_400_000;

  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  let last7d = 0;
  let qr = 0;
  for (const r of rows) {
    const day = r.created_at.slice(0, 10);
    if (buckets.has(day)) buckets.set(day, (buckets.get(day) ?? 0) + 1);
    if (new Date(r.created_at).getTime() >= d7) last7d += 1;
    if (r.source === "qr") qr += 1;
  }

  return {
    total: count ?? rows.length,
    last7d,
    last30d: rows.length,
    qr,
    daily: Array.from(buckets, ([day, c]) => ({ day, count: c })),
  };
}
