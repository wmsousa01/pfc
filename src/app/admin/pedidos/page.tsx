import AdminHeader from "@/components/admin/AdminHeader";
import StatusSelect from "@/components/admin/StatusSelect";
import { requireAdmin } from "@/lib/auth";
import { getOrders, summarizeShop } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { brl } from "@/lib/money";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_FLOW,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
} from "@/lib/order-labels";
import type { OrderStatus } from "@/lib/types";
import {
  updateOrderStatus,
  updatePaymentStatus,
  toggleCommissionPaid,
  deleteOrder,
} from "./actions";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "abertos", label: "Em aberto" },
  ...ORDER_STATUS_FLOW.map((s) => ({ key: s, label: ORDER_STATUS_LABEL[s] })),
];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminHeader />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-white/50">
          Supabase não configurado.
        </div>
      </div>
    );
  }

  const all = await getOrders();
  const summary = summarizeShop(all);

  const filter = searchParams.status ?? "todos";
  const orders = all.filter((o) => {
    if (filter === "todos") return true;
    if (filter === "abertos")
      return o.status !== "entregue" && o.status !== "cancelado";
    return o.status === filter;
  });

  const cards = [
    { v: String(summary.awaiting), l: "Pedidos novos" },
    { v: String(summary.pending_delivery), l: "A entregar" },
    { v: brl(summary.revenue_cents), l: "Faturamento" },
    { v: brl(summary.commission_due_cents), l: "Comissão a pagar" },
    { v: brl(summary.profit_cents), l: "Lucro líquido" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">Pedidos</h1>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {cards.map((c) => (
            <div key={c.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-2xl font-black text-gold-500 break-words">{c.v}</div>
              <div className="text-white/50 text-sm mt-1">{c.l}</div>
            </div>
          ))}
        </div>

        <p className="text-white/35 text-xs mb-4">
          Lucro líquido = faturamento − custo de produção − comissões, sem contar
          pedidos cancelados.
        </p>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map((f) => (
            <a
              key={f.key}
              href={`/admin/pedidos?status=${f.key}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                filter === f.key
                  ? "bg-gold-500/15 border-gold-500/40 text-gold-400"
                  : "border-[#2a2a2a] text-white/40 hover:text-white/70"
              }`}
            >
              {f.label}
            </a>
          ))}
        </div>

        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum pedido neste filtro. Eles chegam pelo formulário da /loja.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Pedido</th>
                    <th className="text-left font-medium px-3 py-3">Itens</th>
                    <th className="text-left font-medium px-3 py-3">Revendedor</th>
                    <th className="text-right font-medium px-3 py-3">Valor</th>
                    <th className="text-left font-medium px-3 py-3">Entrega</th>
                    <th className="text-left font-medium px-3 py-3">Pagamento</th>
                    <th className="text-left font-medium px-3 py-3">Comissão</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[#1a1a1a] last:border-0 hover:bg-white/[0.02] align-top"
                    >
                      <td className="px-5 py-3">
                        <div className="text-gold-500 font-black text-xs tracking-wide">
                          {o.code}
                        </div>
                        <div className="text-white font-medium">{o.customer_name}</div>
                        <a
                          href={`https://wa.me/${
                            o.customer_whatsapp.length <= 11
                              ? `55${o.customer_whatsapp}`
                              : o.customer_whatsapp
                          }`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-xs"
                        >
                          {o.customer_whatsapp}
                        </a>
                        <div className="text-white/30 text-xs mt-1">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")} ·{" "}
                          {DELIVERY_LABEL[o.delivery_method] ?? o.delivery_method}
                        </div>
                        {o.delivery_address && (
                          <div className="text-white/40 text-xs mt-1 max-w-[220px]">
                            {o.delivery_address}
                          </div>
                        )}
                        {o.customer_note && (
                          <div className="text-white/30 text-xs mt-1 max-w-[220px] whitespace-pre-wrap">
                            {o.customer_note}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3 text-white/60 text-xs">
                        {o.items.map((i) => (
                          <div key={i.id} className="whitespace-nowrap">
                            {i.qty}× {i.product_name}
                            {i.variant ? ` (${i.variant})` : ""}
                          </div>
                        ))}
                      </td>

                      <td className="px-3 py-3">
                        {o.reseller ? (
                          <a
                            href={`/admin/revendedores/${o.reseller.id}`}
                            className="text-gold-500 hover:text-gold-400"
                          >
                            {o.reseller.name}
                          </a>
                        ) : (
                          <span className="text-white/25">Direto</span>
                        )}
                      </td>

                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="text-white font-semibold">
                          {brl(o.total_cents)}
                        </div>
                        {o.discount_cents > 0 && (
                          <div className="text-emerald-400/70 text-xs">
                            −{brl(o.discount_cents)} cupom
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <form action={updateOrderStatus}>
                          <input type="hidden" name="id" value={o.id} />
                          <StatusSelect
                            name="status"
                            value={o.status}
                            className={ORDER_STATUS_STYLE[o.status as OrderStatus]}
                            options={ORDER_STATUS_FLOW.map((s) => ({
                              value: s,
                              label: ORDER_STATUS_LABEL[s],
                            }))}
                          />
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        <form action={updatePaymentStatus}>
                          <input type="hidden" name="id" value={o.id} />
                          <StatusSelect
                            name="payment_status"
                            value={o.payment_status}
                            className={PAYMENT_STATUS_STYLE[o.payment_status]}
                            options={PAYMENT_STATUS_FLOW.map((s) => ({
                              value: s,
                              label: PAYMENT_STATUS_LABEL[s],
                            }))}
                          />
                        </form>
                      </td>

                      <td className="px-3 py-3">
                        {o.reseller_id ? (
                          <form action={toggleCommissionPaid}>
                            <input type="hidden" name="id" value={o.id} />
                            <input
                              type="hidden"
                              name="paid"
                              value={(!o.commission_paid).toString()}
                            />
                            <div className="text-white/70 text-xs mb-1 whitespace-nowrap">
                              {brl(o.commission_cents)}
                            </div>
                            <button
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                o.commission_paid
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : "border-[#2a2a2a] text-white/40 hover:text-white/70"
                              }`}
                            >
                              {o.commission_paid ? "Repassada" : "A pagar"}
                            </button>
                          </form>
                        ) : (
                          <span className="text-white/25 text-xs">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3 text-right">
                        <form action={deleteOrder}>
                          <input type="hidden" name="id" value={o.id} />
                          <button className="text-red-400/70 hover:text-red-400 text-xs">
                            Remover
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
