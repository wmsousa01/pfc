import "server-only";
import { cookies } from "next/headers";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getResellerByCode } from "@/lib/shop";
import type { Reseller } from "@/lib/types";

type LeadPayload = {
  name: string;
  company: string;
  segment: string | null;
  whatsapp: string;
  message: string | null;
  source: string;
};

/** Parceiro do cookie gravado por /r/{slug} (30 dias), se ainda estiver ativo. */
export async function parceiroDoCookie(): Promise<Reseller | null> {
  const slug = cookies().get("pfc_ref")?.value;
  return slug ? getResellerByCode(slug).catch(() => null) : null;
}

/**
 * Grava o lead e, se ele chegou pelo link de um parceiro, credita a indicação
 * a ele (aparece no painel como "chegou pelo seu link").
 *
 * Nunca deixa a atribuição derrubar o lead: se a migração 029 ainda não rodou
 * (sem leads.reseller_id), grava o lead sem ela.
 */
export async function gravarLead(
  lead: LeadPayload,
  extra: { interesse?: string; quadro?: string | null } = {},
): Promise<{ error: string | null; id?: string }> {
  const admin = createAdminSupabase();
  if (!admin) return { error: "sem service role" };

  const parceiro = await parceiroDoCookie();
  const source = parceiro ? `${lead.source}:parceiro:${parceiro.slug}` : lead.source;

  let leadId: string | null = null;
  if (parceiro) {
    const r = await admin
      .from("leads")
      .insert({ ...lead, source, reseller_id: parceiro.id })
      .select("id")
      .single();
    if (!r.error) leadId = (r.data as { id: string }).id;
  }
  if (!leadId) {
    const r = await admin.from("leads").insert({ ...lead, source }).select("id").single();
    if (r.error) return { error: r.error.message };
    leadId = (r.data as { id: string }).id;
  }

  if (parceiro) {
    // Falha aqui não é do cliente: o lead já entrou e o source guarda o parceiro.
    await admin.from("indicacoes").insert({
      reseller_id: parceiro.id,
      lead_id: leadId,
      empresa: lead.company.slice(0, 120),
      contato: lead.name.split(" ")[0].slice(0, 60),
      interesse: extra.interesse?.slice(0, 300) ?? null,
      quadro: extra.quadro ?? null,
      papel: "indicou",
      origem: "link",
    });
  }
  return { error: null, id: leadId };
}
