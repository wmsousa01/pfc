import "server-only";
import { createServerSupabase } from "./supabase/server";
import type {
  Order,
  OrderItem,
  OrderWithDetails,
  Product,
  Reseller,
  ResellerOrder,
  ResellerOrderItem,
  ResellerStats,
  ResellerWithStats,
  SummarizableOrder,
} from "./types";

/**
 * Leituras do admin e da área do revendedor. Todas usam o cliente com a
 * sessão do usuário — quem filtra o que cada um enxerga é a RLS
 * (policies em supabase/004_revendedores.sql), não este arquivo.
 */

const ZERO_STATS: ResellerStats = {
  orders: 0,
  units: 0,
  revenue_cents: 0,
  commission_cents: 0,
  commission_paid_cents: 0,
  commission_due_cents: 0,
  delivered: 0,
  pending_delivery: 0,
};

/** Consolida os números de uma lista de pedidos. Cancelados não contam. */
export function summarizeOrders(orders: SummarizableOrder[]): ResellerStats {
  const stats = { ...ZERO_STATS };

  for (const o of orders) {
    if (o.status === "cancelado") continue;

    stats.orders += 1;
    stats.units += o.items.reduce((s, i) => s + i.qty, 0);
    stats.revenue_cents += o.total_cents;
    stats.commission_cents += o.commission_cents;

    if (o.commission_paid) {
      stats.commission_paid_cents += o.commission_cents;
    } else if (o.status === "entregue" && o.payment_status === "pago") {
      // Só vira "a pagar" quando o cliente pagou e o produto foi entregue.
      stats.commission_due_cents += o.commission_cents;
    }

    if (o.status === "entregue") stats.delivered += 1;
    else stats.pending_delivery += 1;
  }

  return stats;
}

type OrderRow = Order & {
  order_items: OrderItem[] | null;
  resellers: Pick<Reseller, "id" | "name" | "slug"> | null;
};

function normalizeOrder(row: OrderRow): OrderWithDetails {
  const { order_items, resellers, ...order } = row;
  return {
    ...(order as Order),
    items: order_items ?? [],
    reseller: resellers ?? null,
  };
}

const ORDER_SELECT =
  "*, order_items(*), resellers(id, name, slug)";

/** Pedidos visíveis para o usuário atual, mais recentes primeiro. */
export async function getOrders(options?: {
  resellerId?: string;
  limit?: number;
}): Promise<OrderWithDetails[]> {
  const supabase = createServerSupabase();
  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 300);

  if (options?.resellerId) query = query.eq("reseller_id", options.resellerId);

  const { data } = await query;
  return ((data as OrderRow[]) ?? []).map(normalizeOrder);
}

/**
 * Pedidos do revendedor LOGADO, para o painel dele.
 *
 * Chama as funções `reseller_orders()` / `reseller_order_items()` (migração
 * 007), que não expõem cost_cents nem os dados de contato do cliente — a
 * tabela `orders` crua deixou de ser legível pelo revendedor de propósito.
 * Eram views até a 006; viraram funções para sair do lint
 * `security_definer_view` do advisor, sem mudar o que o painel enxerga.
 *
 * São duas consultas em vez de um join embutido porque o PostgREST não
 * relaciona esses resultados automaticamente de forma confiável.
 */
export async function getResellerOrders(limit = 300): Promise<ResellerOrder[]> {
  const supabase = createServerSupabase();

  const { data: orderRows } = await supabase
    .rpc("reseller_orders")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orders = (orderRows ?? []) as Omit<ResellerOrder, "items">[];
  if (orders.length === 0) return [];

  const { data: itemRows } = await supabase.rpc("reseller_order_items").in(
    "order_id",
    orders.map((o) => o.id)
  );

  const byOrder = new Map<string, ResellerOrderItem[]>();
  for (const item of (itemRows ?? []) as ResellerOrderItem[]) {
    const list = byOrder.get(item.order_id) ?? [];
    list.push(item);
    byOrder.set(item.order_id, list);
  }

  return orders.map((o) => ({ ...o, items: byOrder.get(o.id) ?? [] }));
}

/** Revendedores com os números consolidados de cada um (admin). */
export async function getResellersWithStats(): Promise<ResellerWithStats[]> {
  const supabase = createServerSupabase();

  const { data: resellers } = await supabase
    .from("resellers")
    .select("*")
    .order("created_at", { ascending: false });

  if (!resellers || resellers.length === 0) return [];

  const orders = await getOrders();
  const byReseller = new Map<string, OrderWithDetails[]>();
  for (const o of orders) {
    if (!o.reseller_id) continue;
    const list = byReseller.get(o.reseller_id) ?? [];
    list.push(o);
    byReseller.set(o.reseller_id, list);
  }

  return (resellers as Reseller[]).map((r) => ({
    ...r,
    stats: summarizeOrders(byReseller.get(r.id) ?? []),
  }));
}

export async function getResellerById(id: string): Promise<Reseller | null> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("resellers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as Reseller) ?? null;
}

/** Todos os produtos (inclusive inativos) — tela de gestão do admin. */
export async function getAllProducts(): Promise<Product[]> {
  const supabase = createServerSupabase();
  const { data } = await supabase
    .from("products")
    .select("*")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as Product[]).map((p) => ({
    ...p,
    variants: Array.isArray(p.variants) ? p.variants : [],
  }));
}

export type ShopSummary = ResellerStats & {
  /** Faturamento menos custo de produção menos comissões. */
  profit_cents: number;
  awaiting: number;
};

/** Resumo da operação inteira, para os cards do dashboard do admin. */
export function summarizeShop(orders: OrderWithDetails[]): ShopSummary {
  const base = summarizeOrders(orders);
  const cost = orders
    .filter((o) => o.status !== "cancelado")
    .reduce((s, o) => s + o.cost_cents, 0);

  return {
    ...base,
    profit_cents: base.revenue_cents - cost - base.commission_cents,
    awaiting: orders.filter((o) => o.status === "novo").length,
  };
}
