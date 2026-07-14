import AdminHeader from "@/components/admin/AdminHeader";
import { getPartnersWithStats, getAllIgHighlights } from "@/lib/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  togglePartnerActive,
  saveHighlight,
  deleteHighlight,
} from "./actions";

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

  const partners = await getPartnersWithStats();
  const highlights = await getAllIgHighlights();

  const totalClicks30d = partners.reduce((s, p) => s + p.clicks_30d, 0);
  const totalClicksQr = partners.reduce((s, p) => s + p.clicks_qr, 0);
  const activeCount = partners.filter((p) => p.active).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
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
