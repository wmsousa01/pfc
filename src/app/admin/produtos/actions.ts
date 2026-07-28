"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { toCents } from "@/lib/money";

function revalidateAll() {
  revalidatePath("/admin/produtos");
  revalidatePath("/loja");
}

function parseVariants(input: string): string[] {
  return input
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function slugifySku(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Cria ou atualiza um produto. Preço e custo entram em reais ("79,90") e são
 * gravados em centavos — é o custo que define o lucro mostrado no painel.
 */
export async function saveProduct(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const sku = slugifySku(String(formData.get("sku") ?? "").trim() || name);
  if (!name || !sku) throw new Error("Nome e SKU são obrigatórios.");

  const payload = {
    sku,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    detail: String(formData.get("detail") ?? "").trim() || null,
    price_cents: toCents(String(formData.get("price") ?? "")),
    cost_cents: toCents(String(formData.get("cost") ?? "")),
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    image_alt_url: String(formData.get("image_alt_url") ?? "").trim() || null,
    variants: parseVariants(String(formData.get("variants") ?? "")),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    active: formData.get("active") === "on",
  };

  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase.from("products").insert(payload);

  if (error) throw new Error(error.message);
  revalidateAll();
}

export async function toggleProductActive(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id) {
    await supabase.from("products").update({ active }).eq("id", id);
    revalidateAll();
  }
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const id = String(formData.get("id") ?? "");
  if (id) {
    // Os itens de pedido guardam nome e preço em snapshot: o histórico
    // continua íntegro mesmo sem o produto.
    await supabase.from("products").delete().eq("id", id);
    revalidateAll();
  }
}
