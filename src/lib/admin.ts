import "server-only";
import { createServerSupabase } from "./supabase/server";
import type { IgHighlight, Partner } from "./types";

export type PartnerStats = Partner & {
  clicks_total: number;
  clicks_7d: number;
  clicks_30d: number;
  clicks_qr: number;
};

/** Lista todos os parceiros (ativos e inativos) com métricas de cliques. */
export async function getPartnersWithStats(): Promise<PartnerStats[]> {
  const supabase = createServerSupabase();

  const { data: partners } = await supabase
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  if (!partners || partners.length === 0) return [];

  // Cliques dos últimos 90 dias (suficiente para os recortes de 7/30 dias e QR).
  const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const { data: clicks } = await supabase
    .from("partner_clicks")
    .select("partner_id, source, created_at")
    .gte("created_at", since);

  // Total histórico por parceiro (contagem exata via head+count seria N queries;
  // usamos os 90 dias como total exibido "recente" e complementamos abaixo).
  const now = Date.now();
  const d7 = now - 7 * 86_400_000;
  const d30 = now - 30 * 86_400_000;

  const map = new Map<string, { total: number; d7: number; d30: number; qr: number }>();
  for (const c of clicks ?? []) {
    const e = map.get(c.partner_id) ?? { total: 0, d7: 0, d30: 0, qr: 0 };
    const t = new Date(c.created_at).getTime();
    e.total += 1;
    if (t >= d7) e.d7 += 1;
    if (t >= d30) e.d30 += 1;
    if (c.source === "qr") e.qr += 1;
    map.set(c.partner_id, e);
  }

  return (partners as Partner[]).map((p) => {
    const e = map.get(p.id) ?? { total: 0, d7: 0, d30: 0, qr: 0 };
    return {
      ...p,
      clicks_total: e.total,
      clicks_7d: e.d7,
      clicks_30d: e.d30,
      clicks_qr: e.qr,
    };
  });
}

/** Total histórico exato de cliques de um parceiro. */
export async function getPartnerClickTotal(partnerId: string): Promise<number> {
  const supabase = createServerSupabase();
  const { count } = await supabase
    .from("partner_clicks")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId);
  return count ?? 0;
}

export async function getPartnerById(id: string): Promise<Partner | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("partners")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Partner) ?? null;
}

export async function getAllIgHighlights(): Promise<IgHighlight[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("ig_highlights")
    .select("*")
    .order("sort_order", { ascending: true });
  return (data as IgHighlight[]) ?? [];
}
