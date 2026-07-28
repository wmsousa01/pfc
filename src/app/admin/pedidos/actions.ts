"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

const ORDER_STATUSES: OrderStatus[] = [
  "novo",
  "confirmado",
  "producao",
  "pronto",
  "entregue",
  "cancelado",
];

const PAYMENT_STATUSES: PaymentStatus[] = ["pendente", "pago", "estornado"];

function revalidateAll() {
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin/revendedores");
  revalidatePath("/revendedor");
}

/** Avança (ou volta) a entrega. `delivered_at` acompanha o status. */
export async function updateOrderStatus(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrderStatus;
  if (!id || !ORDER_STATUSES.includes(status)) return;

  await supabase
    .from("orders")
    .update({
      status,
      delivered_at: status === "entregue" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidateAll();
}

export async function updatePaymentStatus(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("payment_status") ?? "") as PaymentStatus;
  if (!id || !PAYMENT_STATUSES.includes(status)) return;

  await supabase.from("orders").update({ payment_status: status }).eq("id", id);
  revalidateAll();
}

/** Liga/desliga o repasse da comissão de um pedido específico. */
export async function toggleCommissionPaid(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();

  const id = String(formData.get("id") ?? "");
  const paid = formData.get("paid") === "true";
  if (!id) return;

  await supabase
    .from("orders")
    .update({
      commission_paid: paid,
      commission_paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", id);

  revalidateAll();
}

export async function deleteOrder(formData: FormData) {
  await requireAdmin();
  const supabase = createServerSupabase();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("orders").delete().eq("id", id); // itens caem em cascata
    revalidateAll();
  }
}
