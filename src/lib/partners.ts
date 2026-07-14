import "server-only";
import { createPublicSupabase } from "./supabase/public";
import { createAdminSupabase } from "./supabase/admin";
import type { IgHighlight, Partner } from "./types";

/** Landing de um parceiro (apenas ativos, leitura pública). */
export async function getPartnerBySlug(slug: string): Promise<Partner | null> {
  const supabase = createPublicSupabase();
  if (!supabase) return null;
  const { data } = await supabase
    .from("partners")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  return (data as Partner) ?? null;
}

/** Slugs de todos os parceiros ativos (para generateStaticParams). */
export async function getActivePartnerSlugs(): Promise<string[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("partners")
    .select("slug")
    .eq("active", true);
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

/** Parceiros ativos para vitrine pública (home/página de parcerias). */
export async function getActivePartners(): Promise<Partner[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("partners")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as Partner[]) ?? [];
}

/** Destaques ativos do Instagram (curados no admin). */
export async function getIgHighlights(): Promise<IgHighlight[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("ig_highlights")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data as IgHighlight[]) ?? [];
}

/**
 * Registra um clique/visita para um parceiro. Usa service-role (server-only).
 * Retorna o slug do parceiro se ativo, ou null.
 */
export async function recordClick(
  slug: string,
  meta: { source?: string; referer?: string | null; userAgent?: string | null }
): Promise<Partner | null> {
  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data: partner } = await supabase
    .from("partners")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (!partner) return null;

  await supabase.from("partner_clicks").insert({
    partner_id: (partner as Partner).id,
    source: meta.source ?? "direct",
    referer: meta.referer ?? null,
    user_agent: meta.userAgent ?? null,
  });

  return partner as Partner;
}
