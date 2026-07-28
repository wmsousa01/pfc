import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import { requireAdmin } from "@/lib/auth";
import { getResellersWithStats } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { brl } from "@/lib/money";
import { commissionLabel, couponFor } from "@/lib/commission";
import { site } from "@/lib/config";
import { toggleResellerActive, payResellerCommission } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminResellersPage() {
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

  const resellers = await getResellersWithStats();

  const totalDue = resellers.reduce((s, r) => s + r.stats.commission_due_cents, 0);
  const totalRevenue = resellers.reduce((s, r) => s + r.stats.revenue_cents, 0);
  const totalPending = resellers.reduce((s, r) => s + r.stats.pending_delivery, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6 gap-4">
          <h1 className="text-2xl font-bold text-white">Revendedores</h1>
          <a
            href="/admin/revendedores/new"
            className="btn-primary px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap"
          >
            + Novo revendedor
          </a>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { v: String(resellers.filter((r) => r.active).length), l: "Ativos" },
            { v: brl(totalRevenue), l: "Vendas indicadas" },
            { v: brl(totalDue), l: "Comissão a repassar" },
            { v: String(totalPending), l: "Entregas pendentes" },
          ].map((c) => (
            <div key={c.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-2xl font-black text-gold-500 break-words">{c.v}</div>
              <div className="text-white/50 text-sm mt-1">{c.l}</div>
            </div>
          ))}
        </div>

        {resellers.length === 0 ? (
          <div className="bg-[#111] border border-[#222] rounded-xl p-8 text-center text-white/40 text-sm">
            Nenhum revendedor ainda. Cadastre o primeiro apresentador de quadro
            ou influencer.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {resellers.map((r) => {
              const link = `${site.url}/r/${r.slug}`;
              return (
                <div
                  key={r.id}
                  className="bg-[#111] border border-[#222] rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <a
                          href={`/admin/revendedores/${r.id}`}
                          className="text-white font-bold text-lg hover:text-gold-400"
                        >
                          {r.name}
                        </a>
                        <form action={toggleResellerActive}>
                          <input type="hidden" name="id" value={r.id} />
                          <input
                            type="hidden"
                            name="active"
                            value={(!r.active).toString()}
                          />
                          <button
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              r.active
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-white/5 border-white/10 text-white/40"
                            }`}
                          >
                            {r.active ? "Ativo" : "Inativo"}
                          </button>
                        </form>
                        {!r.user_id && (
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400">
                            sem acesso ao painel
                          </span>
                        )}
                      </div>
                      <div className="text-white/40 text-sm mt-1">
                        {r.role_label ?? "Revendedor"} · {commissionLabel(r)}
                        {r.discount_percent > 0 && (
                          <span className="text-emerald-400">
                            {" "}
                            · cupom dá {r.discount_percent}% OFF
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-3 flex-wrap">
                        <code className="text-white/50 text-xs bg-[#0a0a0a] border border-[#222] rounded-lg px-2.5 py-1.5">
                          {link}
                        </code>
                        <CopyButton value={link} label="Copiar link" />
                        <code className="text-gold-500 text-xs bg-[#0a0a0a] border border-[#222] rounded-lg px-2.5 py-1.5">
                          {couponFor(r.slug)}
                        </code>
                        <CopyButton value={couponFor(r.slug)} label="Copiar cupom" />
                      </div>
                    </div>

                    <a
                      href={`/admin/revendedores/${r.id}`}
                      className="text-gold-500 hover:text-gold-400 text-sm font-medium whitespace-nowrap"
                    >
                      Editar
                    </a>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-5 pt-5 border-t border-[#1e1e1e]">
                    {[
                      { v: String(r.stats.orders), l: "Pedidos" },
                      { v: String(r.stats.units), l: "Peças" },
                      { v: brl(r.stats.revenue_cents), l: "Vendas" },
                      { v: brl(r.stats.commission_cents), l: "Comissão gerada" },
                      { v: brl(r.stats.commission_due_cents), l: "A repassar" },
                    ].map((s) => (
                      <div key={s.l}>
                        <div className="text-white font-bold break-words">{s.v}</div>
                        <div className="text-white/40 text-xs">{s.l}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <span className="text-white/40 text-xs">
                      {r.stats.delivered} entregues · {r.stats.pending_delivery} pendentes
                    </span>
                    {r.stats.commission_due_cents > 0 && (
                      <form action={payResellerCommission}>
                        <input type="hidden" name="reseller_id" value={r.id} />
                        <button className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                          Marcar {brl(r.stats.commission_due_cents)} como repassado
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-white/30 text-xs mt-6">
          &quot;A repassar&quot; conta só pedidos já entregues e pagos pelo
          cliente — o que evita repassar comissão de venda que ainda pode cair.
        </p>
      </div>
    </div>
  );
}
