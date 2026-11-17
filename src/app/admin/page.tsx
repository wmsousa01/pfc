import AdminHeader from "@/components/admin/AdminHeader";
import { getPartnersWithStats, getAllIgHighlights, getLeads } from "@/lib/admin";
import { getOrders, summarizeShop } from "@/lib/orders";
import { requireAdmin } from "@/lib/auth";
import { brl } from "@/lib/money";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  togglePartnerActive,
  saveHighlight,
  deleteHighlight,
  updateLeadStatus,
  deleteLead,
  syncCheckoutAction,
} from "./actions";
import CopyButton from "@/components/CopyButton";
import { listCheckouts } from "@/lib/checkout-store";
import { STATUS_CHECKOUT, PERIODO_NOME, type Periodo } from "@/lib/checkout";
import { plans } from "@/lib/planos";
import { site } from "@/lib/config";

const LEAD_STATUS_STYLES: Record<string, string> = {
  novo: "bg-gold-500/15 border-gold-500/40 text-gold-400",
  contatado: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  fechado: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  descartado: "bg-white/5 border-white/10 text-white/40",
};

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminHeader />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h1 className="text-2xl font-bold text-white">Supabase não configurado</h1>
          <p className="text-white/50 mt-3">
            Preencha <code className="text-gold-400">.env.local</code> com as
            credenciais do Supabase e rode o <code className="text-gold-400">supabase/schema.sql</code>.
          </p>
        </div>
      </div>
    );
  }

  await requireAdmin();

  const partners = await getPartnersWithStats();
  const highlights = await getAllIgHighlights();
  const leads = await getLeads();
  const checkouts = await listCheckouts();
  const checkoutPorLead = new Map<string, (typeof checkouts)[number]>();
  for (const c of checkouts) if (c.lead_id && !checkoutPorLead.has(c.lead_id)) checkoutPorLead.set(c.lead_id, c);
  const pagos = checkouts.filter((c) => c.status === "pago");
  const receita = pagos.reduce((sum, c) => sum + Number(c.valor), 0);
  const shop = summarizeShop(await getOrders({ limit: 500 }));

  const totalClicks30d = partners.reduce((s, p) => s + p.clicks_30d, 0);
  const totalClicksQr = partners.reduce((s, p) => s + p.clicks_qr, 0);
  const activeCount = partners.filter((p) => p.active).length;
  const newLeads = leads.filter((l) => l.status === "novo").length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { v: newLeads, l: "Leads novos" },
            { v: pagos.length, l: "Vendas pelo site" },
            { v: partners.length, l: "Parceiros" },
            { v: activeCount, l: "Ativos" },
            { v: totalClicks30d, l: "Acessos (30 dias)" },
            { v: totalClicksQr, l: "Via QR (90 dias)" },
          ].map((s, i) => (
            <div key={i} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-3xl font-black text-gold-500">{s.v}</div>
              <div className="text-white/50 text-sm mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Loja */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Loja</h2>
          <a href="/admin/pedidos" className="text-gold-500 hover:text-gold-400 text-sm font-medium">
            Ver pedidos →
          </a>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { v: String(shop.awaiting), l: "Pedidos novos" },
            { v: String(shop.pending_delivery), l: "A entregar" },
            { v: brl(shop.commission_due_cents), l: "Comissão a repassar" },
            { v: brl(shop.profit_cents), l: "Lucro líquido" },
          ].map((s) => (
            <div key={s.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className="text-2xl font-black text-gold-500 break-words">{s.v}</div>
              <div className="text-white/50 text-sm mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Leads */}
        <h2 className="text-xl font-bold text-white mb-4">Leads</h2>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden mb-12">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum lead ainda. Eles chegam pelo formulário de /parcerias.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Lead</th>
                    <th className="text-left font-medium px-3 py-3">Segmento</th>
                    <th className="text-left font-medium px-3 py-3">Contato</th>
                    <th className="text-left font-medium px-3 py-3">Data</th>
                    <th className="text-left font-medium px-3 py-3">Status</th>
                    <th className="text-left font-medium px-3 py-3">Jornada</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => {
                    const ck = checkoutPorLead.get(l.id);
                    const wa = l.whatsapp.length <= 11 ? `55${l.whatsapp}` : l.whatsapp;
                    return (
                    <tr key={l.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-white/[0.02] align-top">
                      <td className="px-5 py-3">
                        <div className="text-white font-medium">{l.company}</div>
                        <div className="text-white/40 text-xs">{l.name}</div>
                        {l.message && (
                          <div className="text-white/30 text-xs mt-1 max-w-[260px] whitespace-pre-wrap">
                            {l.message}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-white/50">{l.segment ?? "—"}</td>
                      <td className="px-3 py-3">
                        <a
                          href={`https://wa.me/${l.whatsapp.length <= 11 ? `55${l.whatsapp}` : l.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 font-medium whitespace-nowrap"
                        >
                          {l.whatsapp}
                        </a>
                      </td>
                      <td className="px-3 py-3 text-white/50 whitespace-nowrap">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
                      </td>
                      <td className="px-3 py-3">
                        <form action={updateLeadStatus} className="flex flex-wrap gap-1.5">
                          <input type="hidden" name="id" value={l.id} />
                          {(["novo", "contatado", "fechado", "descartado"] as const).map((s) => (
                            <button
                              key={s}
                              name="status"
                              value={s}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                                l.status === s
                                  ? LEAD_STATUS_STYLES[s]
                                  : "bg-transparent border-[#2a2a2a] text-white/30 hover:text-white/60"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </form>
                      </td>
                      <td className="px-3 py-3 min-w-[190px]">
                        {ck ? (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CHECKOUT[ck.status]?.cor ?? ""}`}>
                            {STATUS_CHECKOUT[ck.status]?.label ?? ck.status}
                            {ck.status === "pago" && (ck.onboarding_done_at ? " · material ok" : " · sem material")}
                          </span>
                        ) : (
                          <details className="text-xs">
                            <summary className="cursor-pointer text-gold-500 hover:text-gold-400 font-medium">
                              Mandar link de checkout
                            </summary>
                            <div className="mt-2 flex flex-col gap-1.5">
                              {plans.map((p) => {
                                const link = `${site.url}/contratar/${p.id}?lead=${l.id}`;
                                const msg = `Oi, ${l.name.split(" ")[0]}! Segue o link para contratar o Plano ${p.name} do PFC, já com seus dados: ${link}`;
                                return (
                                  <div key={p.id} className="flex items-center gap-2">
                                    <span className="text-white/60 w-24">{p.name}</span>
                                    <CopyButton value={link} label="Copiar" className="text-white/50 hover:text-white" />
                                    <a
                                      href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300"
                                    >
                                      WhatsApp
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <form action={deleteLead}>
                          <input type="hidden" name="id" value={l.id} />
                          <button className="text-red-400/70 hover:text-red-400 text-xs">
                            Remover
                          </button>
                        </form>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Vendas pelo site (checkout → onboarding) */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Vendas pelo site</h2>
          <span className="text-white/40 text-sm">
            {pagos.length} pagas · {receita.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden mb-12">
          {checkouts.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum checkout ainda. Apoio e Patrocinador são contratados direto em /parcerias; para o Master, mande o
              link de checkout do lead acima.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Cliente</th>
                    <th className="text-left font-medium px-3 py-3">Plano</th>
                    <th className="text-right font-medium px-3 py-3">Valor</th>
                    <th className="text-left font-medium px-3 py-3">Status</th>
                    <th className="text-left font-medium px-3 py-3">Onboarding</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {checkouts.map((c) => {
                    const st = STATUS_CHECKOUT[c.status] ?? { label: c.status, cor: "" };
                    const onboarding = `${site.url}/comecar/${c.onboarding_token}`;
                    const wa = c.whatsapp.startsWith("55") ? c.whatsapp : `55${c.whatsapp}`;
                    return (
                      <tr key={c.id} className="border-b border-[#1a1a1a] last:border-0 align-top">
                        <td className="px-5 py-3">
                          <div className="text-white font-medium">{c.company}</div>
                          <div className="text-white/40 text-xs">
                            {c.name} · {new Date(c.created_at).toLocaleDateString("pt-BR")}
                            {c.origem === "admin" && " · link do comercial"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-white/60">
                          {c.plan} · {PERIODO_NOME[c.periodo as Periodo] ?? c.periodo} · {c.metodo}
                        </td>
                        <td className="px-3 py-3 text-right text-white/80 whitespace-nowrap">
                          {Number(c.valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${st.cor}`}>{st.label}</span>
                          {c.erro && <div className="text-red-400/80 text-xs mt-1 max-w-[220px]">{c.erro}</div>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {c.status !== "pago" ? (
                            <span className="text-white/30">—</span>
                          ) : c.onboarding_done_at ? (
                            <span className="text-emerald-400">Material recebido</span>
                          ) : (
                            <span className="text-gold-400">Aguardando material</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap text-xs">
                          {c.status === "pago" ? (
                            <div className="flex flex-col items-end gap-1">
                              <a
                                href={`https://wa.me/${wa}?text=${encodeURIComponent(`Oi, ${c.name.split(" ")[0]}! Seu onboarding no PFC: ${onboarding}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300"
                              >
                                Mandar onboarding
                              </a>
                              {c.partner_id && (
                                <a href={`/admin/parceiros/${c.partner_id}`} className="text-gold-500 hover:text-gold-400">
                                  Página do parceiro
                                </a>
                              )}
                            </div>
                          ) : (
                            <form action={syncCheckoutAction}>
                              <input type="hidden" name="id" value={c.id} />
                              <button className="text-gold-500 hover:text-gold-400">Conferir no MP</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Partners */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Parceiros</h2>
          <a
            href="/admin/parceiros/new"
            className="btn-primary px-4 py-2.5 rounded-lg text-sm font-bold"
          >
            + Novo parceiro
          </a>
        </div>

        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden mb-12">
          {partners.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum parceiro ainda. Crie o primeiro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Parceiro</th>
                    <th className="text-left font-medium px-3 py-3">Plano</th>
                    <th className="text-right font-medium px-3 py-3">7d</th>
                    <th className="text-right font-medium px-3 py-3">30d</th>
                    <th className="text-right font-medium px-3 py-3">QR</th>
                    <th className="text-center font-medium px-3 py-3">Status</th>
                    <th className="text-right font-medium px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr key={p.id} className="border-b border-[#1a1a1a] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <div className="text-white font-medium">{p.name}</div>
                        <div className="text-white/30 text-xs">/{p.slug}</div>
                      </td>
                      <td className="px-3 py-3 text-white/50">{p.plan ?? "—"}</td>
                      <td className="px-3 py-3 text-right text-white/70">{p.clicks_7d}</td>
                      <td className="px-3 py-3 text-right text-white/70">{p.clicks_30d}</td>
                      <td className="px-3 py-3 text-right text-gold-500 font-semibold">{p.clicks_qr}</td>
                      <td className="px-3 py-3 text-center">
                        <form action={togglePartnerActive}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="active" value={(!p.active).toString()} />
                          <button
                            className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                              p.active
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-white/5 border-white/10 text-white/40"
                            }`}
                          >
                            {p.active ? "Ativo" : "Inativo"}
                          </button>
                        </form>
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        <a href={`/admin/parceiros/${p.id}`} className="text-gold-500 hover:text-gold-400 font-medium">
                          Editar
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* IG Highlights */}
        <h2 className="text-xl font-bold text-white mb-4">Destaques do Instagram</h2>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Add form */}
          <form action={saveHighlight} className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-3 h-fit">
            <p className="text-white/60 text-sm font-medium">Adicionar destaque</p>
            <input name="title" placeholder="Título (opcional)" className="admin-input" />
            <input name="image_url" required placeholder="URL da imagem *" className="admin-input" />
            <input name="link_url" required placeholder="Link de destino *" className="admin-input" />
            <input name="sort_order" type="number" defaultValue={0} placeholder="Ordem" className="admin-input" />
            <button className="btn-primary py-2.5 rounded-lg text-sm font-bold">Adicionar</button>
          </form>

          {/* List */}
          <div className="flex flex-col gap-2">
            {highlights.length === 0 ? (
              <div className="bg-[#111] border border-[#222] rounded-xl p-5 text-white/40 text-sm">
                Nenhum destaque. Adicione ao lado.
              </div>
            ) : (
              highlights.map((h) => (
                <div key={h.id} className="bg-[#111] border border-[#222] rounded-xl p-3 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.image_url} alt={h.title ?? ""} className="w-12 h-12 rounded-lg object-cover bg-black/40" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm truncate">{h.title || "(sem título)"}</div>
                    <div className="text-white/30 text-xs truncate">{h.link_url}</div>
                  </div>
                  <form action={deleteHighlight}>
                    <input type="hidden" name="id" value={h.id} />
                    <button className="text-red-400/70 hover:text-red-400 text-xs">Remover</button>
                  </form>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
