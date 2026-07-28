"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { calcCommissionCents, calcDiscountCents } from "@/lib/commission";
import { getResellerByCode } from "@/lib/shop";
import type { Product } from "@/lib/types";

export type OrderFormState = {
  ok: boolean;
  error: string | null;
  /** Código do pedido criado, mostrado na tela de sucesso. */
  code: string | null;
};

const DELIVERY_METHODS = ["retirada", "entrega", "combinar"];

/** Código curto e legível para o cliente citar no WhatsApp (ex: PFC-7K3QA). */
function generateCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I/O/0/1
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  bytes.forEach((b) => {
    out += alphabet[b % alphabet.length];
  });
  return `PFC-${out}`;
}

type ParsedItem = {
  product: Product;
  variant: string | null;
  qty: number;
};

/**
 * Lê os itens do formulário. Cada produto manda `qty__{id}` e, quando tem
 * variação, `variant__{id}`. Os preços vêm SEMPRE do banco — nunca do
 * formulário, que o cliente controla.
 */
function parseItems(formData: FormData, products: Product[]): ParsedItem[] {
  const items: ParsedItem[] = [];

  for (const product of products) {
    const qty = Number(formData.get(`qty__${product.id}`) ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const variantRaw = String(formData.get(`variant__${product.id}`) ?? "").trim();
    const variant =
      product.variants.length > 0
        ? product.variants.includes(variantRaw)
          ? variantRaw
          : product.variants[0]
        : null;

    items.push({ product, variant, qty: Math.min(Math.trunc(qty), 50) });
  }

  return items;
}

/**
 * Recebe o pedido do formulário público da loja.
 * Insere via service-role (a tabela orders não tem policy de insert anônimo),
 * exatamente como o formulário de leads de /parcerias.
 */
export async function submitOrder(
  _prev: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  // Honeypot: invisível para humanos; bots preenchem. Finge sucesso.
  if (String(formData.get("site_url") ?? "").trim()) {
    return { ok: true, error: null, code: null };
  }

  const fail = (error: string): OrderFormState => ({ ok: false, error, code: null });

  const name = String(formData.get("customer_name") ?? "").trim();
  const whatsappRaw = String(formData.get("customer_whatsapp") ?? "").trim();
  const note = String(formData.get("customer_note") ?? "").trim() || null;
  const address = String(formData.get("delivery_address") ?? "").trim() || null;
  const deliveryRaw = String(formData.get("delivery_method") ?? "").trim();
  const delivery = DELIVERY_METHODS.includes(deliveryRaw) ? deliveryRaw : "combinar";

  if (!name || !whatsappRaw) {
    return fail("Preencha seu nome e WhatsApp.");
  }

  const digits = whatsappRaw.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 13) {
    return fail("Informe um WhatsApp válido com DDD.");
  }

  const admin = createAdminSupabase();
  if (!admin) {
    return fail("Não foi possível enviar agora. Fale direto no WhatsApp.");
  }

  const { data: productRows } = await admin
    .from("products")
    .select("*")
    .eq("active", true);

  const products = ((productRows ?? []) as Product[]).map((p) => ({
    ...p,
    variants: Array.isArray(p.variants) ? p.variants : [],
  }));

  const items = parseItems(formData, products);
  if (items.length === 0) {
    return fail("Escolha pelo menos um produto.");
  }

  const subtotalCents = items.reduce(
    (s, i) => s + i.product.price_cents * i.qty,
    0
  );
  const costCents = items.reduce((s, i) => s + i.product.cost_cents * i.qty, 0);
  const units = items.reduce((s, i) => s + i.qty, 0);

  // O desconto sai do cupom, nunca do formulário. E a comissão incide sobre o
  // que o cliente realmente vai pagar — senão o PFC banca o desconto duas vezes.
  const reseller = await getResellerByCode(formData.get("coupon") as string);
  const discountCents = calcDiscountCents(reseller, subtotalCents);
  const totalCents = subtotalCents - discountCents;
  const commissionCents = calcCommissionCents(reseller, totalCents, units);

  const { data: order, error } = await admin
    .from("orders")
    .insert({
      code: generateCode(),
      reseller_id: reseller?.id ?? null,
      customer_name: name.slice(0, 120),
      customer_whatsapp: digits,
      customer_note: note?.slice(0, 1000) ?? null,
      delivery_method: delivery,
      delivery_address: delivery === "entrega" ? address?.slice(0, 300) ?? null : null,
      total_cents: totalCents,
      discount_cents: discountCents,
      cost_cents: costCents,
      commission_cents: commissionCents,
      source: reseller ? `revendedor:${reseller.slug}` : "loja",
    })
    .select("id, code")
    .single();

  if (error || !order) {
    return fail("Não foi possível registrar o pedido. Fale direto no WhatsApp.");
  }

  const { error: itemsError } = await admin.from("order_items").insert(
    items.map((i) => ({
      order_id: order.id,
      product_id: i.product.id,
      product_name: i.product.name,
      variant: i.variant,
      qty: i.qty,
      unit_price_cents: i.product.price_cents,
      unit_cost_cents: i.product.cost_cents,
    }))
  );

  // Sem itens o pedido não significa nada — desfaz para não sujar o painel.
  if (itemsError) {
    await admin.from("orders").delete().eq("id", order.id);
    return fail("Não foi possível registrar o pedido. Fale direto no WhatsApp.");
  }

  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/revendedor");

  return { ok: true, error: null, code: order.code as string };
}
