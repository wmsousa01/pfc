import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPartnerByPanelToken,
  getPartnerLeads,
  getPartnerClickSummary,
  summarizePartnerLeads,
} from "@/lib/partner-leads";
import { labelFor, TEMPERATURE_LABEL } from "@/lib/lead-triage";
import { buildPartnerTheme, withAlpha } from "@/lib/brandkit";
import { site } from "@/lib/config";
import type { LeadTemperature, PartnerLead } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Painel é privado por link secreto: fora do índice dos buscadores. */
export const metadata: Metadata = {
  title: "Painel do parceiro | Fora da Caixa",
  robots: { index: false, follow: false, nocache: true },
};

const TEMP_COLOR: Record<LeadTemperature, string> = {
  quente: "#f97316",
  morno: "#eab308",
  frio: "#64748b",
};

function waLink(lead: PartnerLead, partnerName: string): string {
  const msg =
    `Olá, ${lead.name}! Aqui é da ${partnerName}. ` +
    `Recebi seu pedido pelo ${site.brand} e já posso te passar as opções. ` +
    `Podemos falar agora?`;
  return `https://wa.me/${lead.whatsapp}?text=${encodeURIComponent(msg)}`;
}

function formatPhone(digits: string): string {
  const d = digits.startsWith("55") ? digits.slice(2) : digits;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digits;
}

export default async function PartnerPanelPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";
  const partner = await getPartnerByPanelToken(token);

  // Token inválido ou de outro parceiro: 404, sem pistas.
  if (!partner || partner.slug !== params.slug) notFound();

  const [leads, clicks] = await Promise.all([
    getPartnerLeads(partner.id),
    getPartnerClickSummary(partner.id),
  ]);
  const summary = summarizePartnerLeads(leads);
  const t = buildPartnerTheme(partner);

  const maxDaily = Math.max(1, ...clicks.daily.map((d) => d.count));

  const card = {
    backgroundColor: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: t.radius,
  } as const;

  const kpis = [
    { v: summary.total, l: "Leads recebidos" },
    { v: summary.quentes, l: "Leads quentes" },
    { v: summary.last7d, l: "Leads em 7 dias" },
    { v: clicks.total, l: "Acessos na página" },
    { v: clicks.qr, l: "Acessos via QR (30d)" },
  ];

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: t.bg, color: t.fg, fontFamily: t.fontFamily }}
    >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 pb-24">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span
              className="text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ color: t.primaryText }}
            >
              Painel do parceiro · {site.brand}
            </span>
            <h1 className="text-3xl mt-2" style={t.heading}>
              {partner.name}
            </h1>
          </div>
          <a
            href={`/parceiros/${partner.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm px-4 py-2.5 font-semibold"
            style={{ borderRadius: t.radius, border: `1px solid ${t.border}`, color: t.fg }}
          >
            Ver minha página ↗
          </a>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-8">
          {kpis.map((k) => (
            <div key={k.l} className="p-5" style={card}>
              <div className="text-3xl font-black" style={{ color: t.primaryText }}>
                {k.v}
              </div>
              <div className="text-xs mt-1.5 leading-snug" style={{ color: t.fgSubtle }}>
                {k.l}
              </div>
            </div>
          ))}
        </div>

        {/* Acessos por dia */}
        <div className="mt-6 p-6" style={card}>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-bold" style={{ color: t.fg }}>
              Acessos nos últimos 30 dias
            </h2>
            <span className="text-xs" style={{ color: t.fgSubtle }}>
              {clicks.last30d} acessos · {clicks.qr} pelo QR do episódio
            </span>
          </div>
          <div className="mt-5 flex items-end gap-[3px] h-24">
            {clicks.daily.map((d) => (
              <div
                key={d.day}
                title={`${new Date(`${d.day}T12:00:00`).toLocaleDateString("pt-BR")}: ${d.count}`}
                className="flex-1 rounded-t-sm transition-all"
                style={{
                  height: `${Math.max(3, (d.count / maxDaily) * 100)}%`,
                  backgroundColor: d.count
                    ? t.primary
                    : withAlpha(t.fg, "14"),
                }}
              />
            ))}
          </div>
        </div>

        {/* Leads */}
        <h2 className="text-xl mt-12 mb-4" style={t.heading}>
          Seus leads
        </h2>

        {leads.length === 0 ? (
          <div className="p-10 text-center" style={card}>
            <p style={{ color: t.fgMuted }}>
              Nenhum lead ainda. Assim que alguém preencher a triagem da sua
              página, ele aparece aqui — já classificado por urgência.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {leads.map((l) => (
              <div key={l.id} className="p-5" style={card}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-lg" style={{ color: t.fg }}>
                        {l.name}
                      </span>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1"
                        style={{
                          borderRadius: 999,
                          backgroundColor: withAlpha(TEMP_COLOR[l.temperature], "22"),
                          color: TEMP_COLOR[l.temperature],
                          border: `1px solid ${withAlpha(TEMP_COLOR[l.temperature], "55")}`,
                        }}
                      >
                        {TEMPERATURE_LABEL[l.temperature]} · {l.score}
                      </span>
                      {l.source === "qr" && (
                        <span
                          className="text-[11px] font-semibold px-2.5 py-1"
                          style={{
                            borderRadius: 999,
                            backgroundColor: withAlpha(t.primary, "1a"),
                            color: t.primaryText,
                          }}
                        >
                          veio do QR
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: t.fgSubtle }}>
                      {new Date(l.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {l.city ? ` · ${l.city}` : ""}
                    </div>
                  </div>

                  <a
                    href={waLink(l, partner.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2.5 text-sm font-bold whitespace-nowrap"
                    style={{
                      backgroundColor: t.primary,
                      color: t.onPrimary,
                      borderRadius: t.radius,
                    }}
                  >
                    Chamar {formatPhone(l.whatsapp)}
                  </a>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    labelFor("need", l.need),
                    l.quantity ? `${l.quantity}${l.quantity >= 3 ? "+" : ""} unidade${l.quantity > 1 ? "s" : ""}` : null,
                    labelFor("mode", l.mode),
                    labelFor("timeframe", l.timeframe),
                    labelFor("business_type", l.business_type),
                  ]
                    .filter((x): x is string => Boolean(x) && x !== "—")
                    .map((chip) => (
                      <span
                        key={chip}
                        className="text-xs px-2.5 py-1"
                        style={{
                          borderRadius: 999,
                          backgroundColor: t.surfaceStrong,
                          border: `1px solid ${t.border}`,
                          color: t.fgMuted,
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                </div>

                {l.note && (
                  <p
                    className="mt-3 text-sm leading-relaxed whitespace-pre-line"
                    style={{ color: t.fgMuted }}
                  >
                    “{l.note}”
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-xs mt-10 leading-relaxed" style={{ color: t.fgSubtle }}>
          Este link é pessoal e dá acesso aos seus leads — não compartilhe.
          Precisa de um novo link ou quer incluir alguém da sua equipe? Fale com
          o time do {site.brand}.
        </p>
      </div>
    </main>
  );
}
