import "server-only";
import { createAdminSupabase } from "./supabase/admin";
import type { ClientContract, TermsAcceptance } from "./types";

/**
 * Dados privados da área do cliente: contrato, Epic do Jira e aceite.
 * Tudo via service-role, sempre depois de o painel validar o token.
 */

export type PanelExtras = {
  jiraEpic: string | null;
  contract: ClientContract | null;
};

export async function getPanelExtras(partnerId: string): Promise<PanelExtras> {
  const admin = createAdminSupabase();
  const empty: PanelExtras = { jiraEpic: null, contract: null };
  if (!admin) return empty;

  // Antes da migration 009 as colunas não existem: o painel segue só com
  // leads e acessos, como era.
  const { data, error } = await admin
    .from("partner_panels")
    .select("jira_epic, contract")
    .eq("partner_id", partnerId)
    .maybeSingle();
  if (error || !data) return empty;

  const row = data as { jira_epic: string | null; contract: ClientContract | null };
  return { jiraEpic: row.jira_epic, contract: row.contract };
}

export async function getTermsAcceptance(
  partnerId: string,
  version: string
): Promise<TermsAcceptance | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data } = await admin
    .from("partner_terms_acceptances")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("terms_version", version)
    .maybeSingle();
  return (data as TermsAcceptance) ?? null;
}

export async function recordTermsAcceptance(row: {
  partner_id: string;
  terms_version: string;
  terms_hash: string;
  accepted_name: string;
  accepted_document: string;
  ip: string | null;
  user_agent: string | null;
}): Promise<TermsAcceptance | null> {
  const admin = createAdminSupabase();
  if (!admin) return null;
  const { data, error } = await admin
    .from("partner_terms_acceptances")
    .insert(row)
    .select("*")
    .maybeSingle();
  if (error) {
    // Aceite repetido da mesma versão (clique duplo): vale o primeiro.
    if (error.code === "23505") {
      return getTermsAcceptance(row.partner_id, row.terms_version);
    }
    console.error("[client-area] aceite", error.message);
    return null;
  }
  return data as TermsAcceptance;
}

/** CPF (11) ou CNPJ (14) com dígitos verificadores válidos. */
export function isValidDocument(digits: string): boolean {
  if (/^(\d)\1+$/.test(digits)) return false;
  const n = digits.split("").map(Number);

  if (digits.length === 11) {
    for (const len of [9, 10]) {
      let sum = 0;
      for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
      const dv = ((sum * 10) % 11) % 10;
      if (dv !== n[len]) return false;
    }
    return true;
  }

  if (digits.length === 14) {
    const weights = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    for (const len of [12, 13]) {
      const w = weights.slice(13 - len);
      let sum = 0;
      for (let i = 0; i < len; i++) sum += n[i] * w[i];
      const r = sum % 11;
      const dv = r < 2 ? 0 : 11 - r;
      if (dv !== n[len]) return false;
    }
    return true;
  }

  return false;
}

export function formatDocument(d: string): string {
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14)
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d;
}
