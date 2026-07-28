import { headers } from "next/headers";
import CopyButton from "@/components/CopyButton";
import { signOutAction } from "@/lib/auth-actions";
import { requireReseller } from "@/lib/auth";
import { getResellerOrders, summarizeOrders } from "@/lib/orders";
import { brl } from "@/lib/money";
import { commissionLabel, couponFor, discountLabel } from "@/lib/commission";
import { qrDataUrl } from "@/lib/qr";
import { whatsapp } from "@/lib/config";
import { MicIcon, WhatsAppIcon } from "@/components/icons";
import {
  DELIVERY_LABEL,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
} from "@/lib/order-labels";

export const dynamic = "force-dynamic";

function baseUrlFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Painel do revendedor. Ele só enxerga os pedidos atribuídos a ele — quem
 * garante isso é a RLS do Supabase, não esta página.
 */
export default async function ResellerDashboard() {
  const { reseller } = await requireReseller();

  const orders = await getResellerOrders();
  const stats = summarizeOrders(orders);

  const link = `${baseUrlFromHeaders()}/r/${reseller.slug}`;
  const qr = await qrDataUrl(link);
  const coupon = couponFor(reseller.slug);
  const discount = discountLabel(reseller);

  const cards = [
    { v: String(stats.orders), l: "Pedidos" },
    { v: String(stats.units), l: "Peças vendidas" },
    { v: brl(stats.revenue_cents), l: "Vendas geradas" },
    { v: brl(stats.commission_cents), l: "Comissão total" },
    { v: brl(stats.commission_due_cents), l: "A receber" },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <header className="border-b border-[#1a1a1a] bg-[#0d0d0d] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 bg-gold-500 rounded-lg shrink-0">
              <MicIcon className="w-4 h-4 text-black" />
            </div>
            <span className="text-white font-bold truncate">
              {reseller.name}{" "}
              <span className="text-white/40 font-normal hidden sm:inline">
                · Revendedor
              </span>
            </span>
          </div>
          <form action={signOutAction}>
            <input type="hidden" name="to" value="/revendedor/login" />
            <button className="text-white/50 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5 hover:border-[#3a3a3a] transition-colors">
              Sair
            </button>
          </form>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white">
          Olá, {reseller.name.split(" ")[0]} 👋
        </h1>
        <p className="text-white/45 text-sm mt-1">
          {reseller.role_label ? `${reseller.role_label} · ` : ""}
          Sua comissão: <span className="text-gold-500">{commissionLabel(reseller)}</span>
        </p>

        {/* Números */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-8">
          {cards.map((c) => (
            <div key={c.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-2xl font-black text-gold-500 break-words">{c.v}</div>
              <div className="text-white/50 text-sm mt-1">{c.l}</div>
            </div>
          ))}
        </div>

        <p className="text-white/30 text-xs mt-3">
          &quot;A receber&quot; é a comissão de pedidos já entregues e pagos pelo
          cliente. {brl(stats.commission_paid_cents)} já foram repassados a você.
        </p>

        {/* Divulgação */}
        <div className="grid md:grid-cols-3 gap-6 mt-10">
          <div className="md:col-span-2 bg-[#111] border border-[#222] rounded-xl p-6">
            <h2 className="text-white font-bold text-lg">Seu link e seu cupom</h2>
            <p className="text-white/45 text-sm mt-1 leading-relaxed">
              Toda venda feita pelo seu link — ou com seu cupom digitado no
              checkout — entra automaticamente aqui.
              {discount && (
                <>
                  {" "}
                  E quem compra com você paga{" "}
                  <strong className="text-emerald-400">
                    {reseller.discount_percent}% mais barato
                  </strong>{" "}
                  — use isso na divulgação, é o seu argumento.
                </>
              )}
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-white/70 text-sm bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 break-all flex-1 min-w-0">
                  {link}
                </code>
                <CopyButton value={link} label="Copiar link" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <code className="text-gold-500 font-black text-sm bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 tracking-wide">
                  {coupon}
                </code>
                <CopyButton value={coupon} label="Copiar cupom" />
                {discount && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 whitespace-nowrap">
                    {reseller.discount_percent}% OFF
                  </span>
                )}
              </div>
            </div>

            <a
              href={whatsapp(
                `Quero falar sobre minhas vendas na loja do Fora da Caixa (${reseller.name})`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm mt-6"
            >
              <WhatsAppIcon className="w-4 h-4" />
              Falar com a equipe
            </a>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-6 text-center">
            <h2 className="text-white font-bold">QR do seu link</h2>
            <p className="text-white/40 text-xs mt-1 mb-4">
              Use em stories, cartão ou impresso.
            </p>
            <div className="bg-white rounded-xl p-3 w-fit mx-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR code do seu link" className="w-36 h-36" />
            </div>
            <a
              href={qr}
              download={`qr-${reseller.slug}.png`}
              className="btn-primary block text-center py-2.5 rounded-lg text-sm font-bold mt-4"
            >
              Baixar PNG
            </a>
          </div>
        </div>

        {/* Pedidos */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">Suas vendas</h2>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhuma venda ainda. Divulgue seu link e ele aparece aqui na hora.
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
                    <th className="text-right font-medium px-5 py-3">Sua comissão</th>
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
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <div className="text-white">{brl(o.total_cents)}</div>
                        {o.discount_cents > 0 && (
                          <div className="text-emerald-400/70 text-xs">
                            −{brl(o.discount_cents)} de desconto
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${ORDER_STATUS_STYLE[o.status]}`}
                        >
                          {ORDER_STATUS_LABEL[o.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${PAYMENT_STATUS_STYLE[o.payment_status]}`}
                        >
                          {PAYMENT_STATUS_LABEL[o.payment_status]}
                        </span>
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
                          {o.commission_paid ? "recebida" : "a receber"}
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
