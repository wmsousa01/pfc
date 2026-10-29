import { notFound } from "next/navigation";
import { headers } from "next/headers";
import AdminHeader from "@/components/admin/AdminHeader";
import PartnerForm from "@/components/admin/PartnerForm";
import CopyButton from "@/components/CopyButton";
import { getPartnerById, getPartnerClickTotal } from "@/lib/admin";
import {
  getOrCreatePanelToken,
  getPartnerLeads,
  summarizePartnerLeads,
} from "@/lib/partner-leads";
import { labelFor, TEMPERATURE_LABEL } from "@/lib/lead-triage";
import { imovelLeadChips, isImovelLead } from "@/lib/lead-triage-imoveis";
import { qrDataUrl, trackingUrl } from "@/lib/qr";
import type { LeadTemperature } from "@/lib/types";

const TEMP_STYLE: Record<LeadTemperature, string> = {
  quente: "bg-orange-500/15 border-orange-500/40 text-orange-400",
  morno: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
  frio: "bg-white/5 border-white/10 text-white/40",
};

export const dynamic = "force-dynamic";

function baseUrlFromHeaders(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export default async function EditPartnerPage({
  params,
}: {
  params: { id: string };
}) {
  const partner = await getPartnerById(params.id);
  if (!partner) notFound();

  const totalClicks = await getPartnerClickTotal(partner.id);
  const base = baseUrlFromHeaders();
  const track = trackingUrl(base, partner.slug);
  const qr = await qrDataUrl(track);

  const [leads, panelToken] = await Promise.all([
    getPartnerLeads(partner.id, 50),
    getOrCreatePanelToken(partner.id),
  ]);
  const leadSummary = summarizePartnerLeads(leads);
  const panelUrl = panelToken
    ? `${base}/parceiros/${partner.slug}/painel?token=${panelToken}`
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin" className="text-white/40 hover:text-white text-sm">← Voltar</a>
        <h1 className="text-2xl font-bold text-white mt-3 mb-8">
          Editar: <span className="text-gold-500">{partner.name}</span>
        </h1>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <PartnerForm partner={partner} />
          </div>

          {/* Sidebar: QR + stats */}
          <div className="flex flex-col gap-6">
            <a
              href={`/admin/parceiros/${partner.id}/conteudo`}
              className="bg-[#111] border border-gold-500/25 hover:border-gold-500/60 rounded-xl p-5 transition-colors group"
            >
              <h3 className="text-white font-semibold group-hover:text-gold-400 transition-colors">
                Conteúdo da página →
              </h3>
              <p className="text-white/40 text-xs mt-1 leading-relaxed">
                Números, benefícios, produtos, passos, FAQ, contato e triagem.
                Seção sem item some da página — é aqui que se tira um bloco.
              </p>
            </a>

            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-1">QR code do episódio</h3>
              <p className="text-white/40 text-xs mb-4">
                Exiba na tela durante a live. Cada leitura conta como acesso.
              </p>
              <div className="bg-white rounded-xl p-3 w-fit mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="QR code" className="w-44 h-44" />
              </div>
              <a
                href={qr}
                download={`qr-${partner.slug}.png`}
                className="btn-primary block text-center py-2.5 rounded-lg text-sm font-bold mt-4"
              >
                Baixar QR (PNG)
              </a>
              <div className="mt-3 text-center">
                <a href={`/parceiros/${partner.slug}`} target="_blank" className="text-gold-500 hover:text-gold-400 text-xs">
                  Ver página do parceiro ↗
                </a>
              </div>
              <p className="text-white/25 text-[10px] mt-3 break-all">{track}</p>
            </div>

            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Acessos</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-2xl font-black text-gold-500">{totalClicks}</div>
                  <div className="text-white/40 text-xs">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{partner.active ? "Ativo" : "Off"}</div>
                  <div className="text-white/40 text-xs">Status</div>
                </div>
              </div>
            </div>

            {/* Link do painel do parceiro */}
            {panelUrl && (
              <div className="bg-[#111] border border-[#222] rounded-xl p-5">
                <h3 className="text-white font-semibold mb-1">Painel do parceiro</h3>
                <p className="text-white/40 text-xs mb-4">
                  Link secreto e somente leitura: ele acompanha os próprios leads
                  e acessos. Envie só para o parceiro.
                </p>
                <div className="flex flex-col gap-2">
                  <CopyButton value={panelUrl} label="Copiar link do painel" />
                  <a
                    href={panelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gold-500 hover:text-gold-400 text-xs text-center"
                  >
                    Abrir painel ↗
                  </a>
                </div>
                <p className="text-white/25 text-[10px] mt-3 break-all">{panelUrl}</p>
              </div>
            )}

            <div className="bg-[#111] border border-[#222] rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3">Leads da página</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-2xl font-black text-gold-500">{leadSummary.total}</div>
                  <div className="text-white/40 text-xs">Total</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-orange-400">{leadSummary.quentes}</div>
                  <div className="text-white/40 text-xs">Quentes</div>
                </div>
                <div>
                  <div className="text-2xl font-black text-white">{leadSummary.last7d}</div>
                  <div className="text-white/40 text-xs">7 dias</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leads qualificados */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">
          Leads qualificados
        </h2>
        <div className="bg-[#111] border border-[#222] rounded-xl overflow-hidden">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhum lead ainda. Eles chegam pela triagem da página do parceiro.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-[#222]">
                    <th className="text-left font-medium px-5 py-3">Lead</th>
                    <th className="text-left font-medium px-3 py-3">Qualificação</th>
                    <th className="text-left font-medium px-3 py-3">Temperatura</th>
                    <th className="text-left font-medium px-3 py-3">Origem</th>
                    <th className="text-left font-medium px-3 py-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((l) => (
                    <tr
                      key={l.id}
                      className="border-b border-[#1a1a1a] last:border-0 hover:bg-white/[0.02] align-top"
                    >
                      <td className="px-5 py-3">
                        <div className="text-white font-medium">{l.name}</div>
                        <a
                          href={`https://wa.me/${l.whatsapp}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 text-xs"
                        >
                          {l.whatsapp}
                        </a>
                        {l.city && (
                          <div className="text-white/30 text-xs mt-0.5">{l.city}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-white/60 text-xs leading-relaxed max-w-[280px]">
                        {(isImovelLead(l)
                          ? imovelLeadChips(l)
                          : [
                              labelFor("need", l.need),
                              l.quantity ? `${l.quantity} un.` : null,
                              labelFor("mode", l.mode),
                              labelFor("timeframe", l.timeframe),
                              labelFor("business_type", l.business_type),
                            ]
                        )
                          .filter((x): x is string => Boolean(x) && x !== "—")
                          .join(" · ")}
                        {l.note && (
                          <div className="text-white/30 mt-1 whitespace-pre-wrap">
                            “{l.note}”
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${TEMP_STYLE[l.temperature]}`}
                        >
                          {TEMPERATURE_LABEL[l.temperature]} {l.score}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/50 text-xs">
                        {l.source ?? "site"}
                        {l.handed_off_at && (
                          <div className="text-emerald-400/70">foi ao WhatsApp</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-white/50 text-xs whitespace-nowrap">
                        {new Date(l.created_at).toLocaleDateString("pt-BR")}
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
