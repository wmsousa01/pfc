import "server-only";
import { createPublicSupabase } from "./supabase/public";
import { createAdminSupabase } from "./supabase/admin";
import { normalizeCoupon } from "./commission";
import type { Product, Reseller } from "./types";

function normalizeProduct(row: Record<string, unknown>): Product {
  const variants = row.variants;
  return {
    ...(row as Product),
    variants: Array.isArray(variants) ? (variants as string[]) : [],
  };
}

/** Produtos ativos da loja, na ordem definida no admin. */
export async function getActiveProducts(): Promise<Product[]> {
  const supabase = createPublicSupabase();
  if (!supabase) return [];
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map(normalizeProduct);
}

/**
 * Resolve o revendedor a partir do slug do link (/r/{slug}) ou do cupom
 * digitado no formulário. Usa service-role porque a tabela `resellers` não
 * tem leitura pública — comissão é dado interno.
 */
export async function getResellerByCode(
  code: string | null | undefined
): Promise<Reseller | null> {
  const slug = normalizeCoupon(String(code ?? ""));
  if (!slug) return null;

  const supabase = createAdminSupabase();
  if (!supabase) return null;

  const { data } = await supabase
    .from("resellers")
    .select("*")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  return (data as Reseller) ?? null;
}
