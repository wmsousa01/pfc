import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminHeader from "@/components/admin/AdminHeader";
import ResellerForm from "@/components/admin/ResellerForm";
import CopyButton from "@/components/CopyButton";
import { requireAdmin } from "@/lib/auth";
import { getOrders, getResellerById, summarizeOrders } from "@/lib/orders";
import { brl } from "@/lib/money";
import { couponFor } from "@/lib/commission";
import { qrDataUrl } from "@/lib/qr";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
} from "@/lib/order-labels";
import { deleteReseller, payResellerCommission } from "../actions";

export const dynamic = "force-dynamic";

function baseUrlFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function EditResellerPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();

  const reseller = await getResellerById(params.id);
  if (!reseller) notFound();

  const orders = await getOrders({ resellerId: reseller.id });
  const stats = summarizeOrders(orders);

  const link = `${baseUrlFromHeaders()}/r/${reseller.slug}`;
  const qr = await qrDataUrl(link);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin/revendedores" className="text-white/40 hover:text-white text-sm">
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold text-white mt-3 mb-8">
          Editar: <span className="text-gold-500">{reseller.name}</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ResellerForm reseller={reseller} />
          </div>

          <div className="flex flex-col gap-6">
            {/* Link + QR */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1">Link de divulgação</h3>
              <p className="text-white/40 text-xs mb-4">
                Manda direto para a loja com o cupom aplicado. O QR serve para
                stories, cartão e material impresso.
              </p>
              <div className="bg-white rounded-xl p-3 w-fit mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code do revendedor" className="w-40 h-40" />
              </div>
              <a
                href={qr}
                download={`qr-${reseller.slug}.png`}
                className="btn-primary block text-center py-2.5 rounded-lg text-sm font-bold mt-4"
              >
                Baixar QR (PNG)
              </a>
              <div className="flex flex-col gap-2 mt-4">
                <code className="text-white/50 text-[11px] break-all bg-[#0a0a0a] border border-[#222] rounded-lg px-2.5 py-2">
                  {link}
                </code>
                <div className="flex gap-2">
                  <CopyButton value={link} label="Copiar link" />
                  <CopyButton value={couponFor(reseller.slug)} label="Copiar cupom" />
                </div>
              </div>
            </div>

            {/* Números */}
            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4">Números</h3>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { v: String(stats.orders), l: "Pedidos" },
                  { v: String(stats.units), l: "Peças" },
                  { v: brl(stats.revenue_cents), l: "Vendas" },
                  { v: brl(stats.commission_cents), l: "Comissão" },
                  { v: brl(stats.commission_paid_cents), l: "Já repassado" },
                  { v: brl(stats.commission_due_cents), l: "A repassar" },
                ].map((s) => (
                  <div key={s.l}>
                    <div className="text-white font-bold break-words">{s.v}</div>
                    <div className="text-white/40 text-xs">{s.l}</div>
                  </div>
                ))}
              </div>

              {stats.commission_due_cents > 0 && (
                <form action={payResellerCommission} className="mt-4">
                  <input type="hidden" name="reseller_id" value={reseller.id} />
                  <button className="w-full text-xs font-bold px-3 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                    Marcar {brl(stats.commission_due_cents)} como repassado
                  </button>
                </form>
              )}
            </div>

            {/* Zona de risco */}
            <form action={deleteReseller} className="bg-[#111] border border-red-500/20 rounded-xl p-5">
              <input type="hidden" name="id" value={reseller.id} />
              <h3 className="text-white font-semibold mb-1">Excluir cadastro</h3>
              <p className="text-white/40 text-xs mb-4">
                Os pedidos dele continuam no histórico, mas deixam de ser
                atribuídos a ninguém.
              </p>
              <button className="w-full text-red-400/80 hover:text-red-400 text-sm border border-red-500/25 rounded-lg py-2.5 transition-colors">
                Excluir revendedor
              </button>
            </form>
          </div>
        </div>

        {/* Pedidos do revendedor */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">
          Pedidos indicados
        </h2>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum pedido pelo link ou cupom dele ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Pedido</th>
                    <th className="text-left font-medium px-3 py-3">Itens</th>
                    <th className="text-right font-medium px-3 py-3">Valor</th>
                    <th className="text-left font-medium px-3 py-3">Entrega</th>
                    <th className="text-left font-medium px-3 py-3">Pagamento</th>
                    <th className="text-right font-medium px-5 py-3">Comissão</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-[#1a1a1a] last:border-0 align-top"
                    >
                      <td className="px-5 py-3">
                        <div className="text-gold-500 font-black text-xs">{o.code}</div>
                        <div className="text-white">{o.customer_name}</div>
                        <div className="text-white/30 text-xs">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")} ·{" "}
                          {DELIVERY_LABEL[o.delivery_method] ?? o.delivery_method}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-white/60 text-xs">
                        {o.items.map((i) => (
                          <div key={i.id}>
                            {i.qty}× {i.product_name}
                            {i.variant ? ` (${i.variant})` : ""}
                          </div>
                        ))}
                      </td>
                      <td className="px-3 py-3 text-right text-white whitespace-nowrap">
                        {brl(o.total_cents)}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${ORDER_STATUS_STYLE[o.status]}`}
                        >
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/50 text-xs">
                        {PAYMENT_STATUS_LABEL[o.payment_status]}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <div className="text-white font-semibold">
                          {brl(o.commission_cents)}
                        </div>
                        <div
                          className={`text-xs ${
                            o.commission_paid ? "text-emerald-400" : "text-white/35"
                          }`}
                        >
                          {o.commission_paid ? "repassada" : "a pagar"}
                        </div>
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
