import type { Metadata } from "next";
import {
  getPartnerByPanelToken,
  getPartnerLeads,
  getPartnerClickSummary,
  summarizePartnerLeads,
} from "@/lib/partner-leads";
import { labelFor, TEMPERATURE_LABEL } from "@/lib/lead-triage";
import { imovelLeadChips, isImovelLead } from "@/lib/lead-triage-imoveis";
import { buildPartnerTheme, withAlpha } from "@/lib/brandkit";
import { site, whatsapp } from "@/lib/config";
import { getPartnerBySlug } from "@/lib/partners";
import type { LeadTemperature, PartnerLead } from "@/lib/types";
import {
  getPanelExtras,
  getTermsAcceptance,
  formatDocument,
  getClientFiles,
} from "@/lib/client-area";
import { buildTerms } from "@/lib/terms";
import {
  getClientDeliveries,
  getChatAttachments,
  getChatMessages,
  type DeliveryStatus,
} from "@/lib/jira";
import MessageForm from "@/components/partner/MessageForm";
import AcceptTermsForm from "@/components/partner/AcceptTermsForm";

type Tab = "entregas" | "mensagens" | "termos" | "resultados";

const STATUS_LABEL: Record<DeliveryStatus, string> = {
  programado: "Programado",
  em_producao: "Em produção",
  entregue: "Entregue",
};

const STATUS_COLOR: Record<DeliveryStatus, string> = {
  programado: "#64748b",
  em_producao: "#eab308",
  entregue: "#22c55e",
};

function dataBR(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

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
  searchParams: { token?: string; aba?: string };
}) {
  const token = searchParams.token ?? "";
  const partner = await getPartnerByPanelToken(token);

  // Token inválido ou de outro parceiro: 404, sem pistas.
  // Link sem token, antigo (token trocado) ou de outro parceiro: em vez de
  // 404, uma saída para pedir o link novo. Não revela nada além do nome que
  // a página pública do parceiro já mostra.
  if (!partner || partner.slug !== params.slug) {
    const known = await getPartnerBySlug(params.slug);
    return <LostLink partnerName={known?.name ?? null} />;
  }

  const [leads, clicks, extras] = await Promise.all([
    getPartnerLeads(partner.id),
    getPartnerClickSummary(partner.id),
    getPanelExtras(partner.id),
  ]);

  /*
   * Área do cliente: só aparece para quem tem contrato registrado. Parceiro
   * sem contrato continua vendo o painel de sempre, sem abas.
   */
  const terms = extras.contract ? buildTerms(partner.name, extras.contract) : null;
  const [acceptance, deliveries] = await Promise.all([
    terms ? getTermsAcceptance(partner.id, terms.version) : null,
    extras.jiraEpic ? getClientDeliveries(extras.jiraEpic) : null,
  ]);
  const hasClientArea = Boolean(terms);
  const requested = searchParams.aba;
  const tab: Tab = !hasClientArea
    ? "resultados"
    : requested === "termos" ||
        requested === "entregas" ||
        requested === "mensagens" ||
        requested === "resultados"
      ? requested
      : acceptance
        ? "entregas"
        : "termos";
  // A conversa só é buscada na aba dela: são 3 chamadas ao Jira a cada visita.
  const [messages, teamFiles, clientFiles] =
    tab === "mensagens"
      ? await Promise.all([
          extras.jiraChat ? getChatMessages(extras.jiraChat) : [],
          extras.jiraChat ? getChatAttachments(extras.jiraChat) : [],
          getClientFiles(partner.id),
        ])
      : [null, null, []];
  const fileHref = (id: string) =>
    `/parceiros/${partner.slug}/painel/arquivo?token=${token}&id=${id}`;
  const anexoHref = (id: string) =>
    `/parceiros/${partner.slug}/painel/anexo?token=${token}&id=${id}`;

  const tabHref = (a: Tab) =>
    `/parceiros/${partner.slug}/painel?token=${token}&aba=${a}`;
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
              {hasClientArea ? "Área do cliente" : "Painel do parceiro"} · {site.brand}
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

        {hasClientArea && (
          <nav
            className="mt-8 flex gap-1 p-1 overflow-x-auto"
            style={{ ...card, borderRadius: t.radius }}
          >
            {(
              [
                ["entregas", "Entregas"],
                ["mensagens", "Mensagens"],
                ["termos", acceptance ? "Termos ✓" : "Termos"],
                ["resultados", "Resultados"],
              ] as [Tab, string][]
            ).map(([a, label]) => (
              <a
                key={a}
                href={tabHref(a)}
                className="flex-1 text-center whitespace-nowrap px-4 py-2.5 text-sm font-bold"
                style={
                  tab === a
                    ? { backgroundColor: t.primary, color: t.onPrimary, borderRadius: t.radius }
                    : { color: t.fgMuted }
                }
              >
                {label}
              </a>
            ))}
          </nav>
        )}

        {hasClientArea && !acceptance && tab !== "termos" && (
          <a
            href={tabHref("termos")}
            className="mt-4 block p-4 text-sm font-semibold"
            style={{
              ...card,
              borderColor: withAlpha(t.primary, "66"),
              color: t.fg,
            }}
          >
            Falta o aceite dos termos do seu plano. Leva 2 minutos →
          </a>
        )}

        {/* Termos */}
        {tab === "termos" && terms && extras.contract && (
          <section className="mt-6 p-6 sm:p-8" style={card}>
            <h2 className="text-xl" style={t.heading}>
              Termos do Plano {extras.contract.plan}
            </h2>
            <p className="text-xs mt-1" style={{ color: t.fgSubtle }}>
              Versão {terms.version}
            </p>

            <div className="mt-6 flex flex-col gap-6">
              {terms.sections.map((s) => (
                <div key={s.title}>
                  <h3 className="font-bold" style={{ color: t.fg }}>
                    {s.title}
                  </h3>
                  {s.paragraphs.map((p) => (
                    <p
                      key={p}
                      className="text-sm leading-relaxed mt-2"
                      style={{ color: t.fgMuted }}
                    >
                      {p}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <div className="h-px my-8" style={{ backgroundColor: t.border }} />

            {acceptance ? (
              <p className="text-sm leading-relaxed" style={{ color: t.fg }}>
                <strong>Aceito</strong> por {acceptance.accepted_name} (
                {formatDocument(acceptance.accepted_document)}) em{" "}
                {new Date(acceptance.accepted_at).toLocaleString("pt-BR", {
                  timeZone: "America/Sao_Paulo",
                })}
                .
              </p>
            ) : (
              <AcceptTermsForm token={token} termsHash={terms.hash} t={t} />
            )}
          </section>
        )}

        {/* Entregas */}
        {tab === "entregas" && (
          <section className="mt-6">
            {deliveries === null ? (
              <div className="p-10 text-center" style={card}>
                <p style={{ color: t.fgMuted }}>
                  {extras.jiraEpic
                    ? "Não conseguimos carregar suas entregas agora. Tente de novo em alguns minutos."
                    : "Suas entregas aparecem aqui assim que o planejamento do seu plano for publicado."}
                </p>
              </div>
            ) : deliveries.length === 0 ? (
              <div className="p-10 text-center" style={card}>
                <p style={{ color: t.fgMuted }}>
                  O planejamento das suas entregas está sendo montado. Assim
                  que a primeira for agendada, ela aparece aqui.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {deliveries.map((d) => (
                  <div key={d.key} className="p-5" style={card}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="font-bold" style={{ color: t.fg }}>
                        {d.title}
                      </div>
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 whitespace-nowrap"
                        style={{
                          borderRadius: 999,
                          backgroundColor: withAlpha(STATUS_COLOR[d.status], "22"),
                          color: STATUS_COLOR[d.status],
                          border: `1px solid ${withAlpha(STATUS_COLOR[d.status], "55")}`,
                        }}
                      >
                        {STATUS_LABEL[d.status]}
                      </span>
                    </div>
                    <div className="text-xs mt-1.5" style={{ color: t.fgSubtle }}>
                      {d.status === "entregue" && d.deliveredAt
                        ? `Entregue em ${dataBR(d.deliveredAt)}`
                        : d.dueDate
                          ? `Previsto para ${dataBR(d.dueDate)}`
                          : "Data a combinar"}
                    </div>
                    {d.links.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {d.links.map((l) => (
                          <a
                            key={l.url}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold px-3.5 py-2"
                            style={{
                              borderRadius: t.radius,
                              backgroundColor: withAlpha(t.primary, "1a"),
                              color: t.primaryText,
                              border: `1px solid ${withAlpha(t.primary, "40")}`,
                            }}
                          >
                            {l.title} ↗
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Mensagens */}
        {tab === "mensagens" && (
          <section className="mt-6 flex flex-col gap-6">
            <div className="p-6" style={card}>
              <h2 className="text-lg" style={t.heading}>
                Fale com a equipe do PFC
              </h2>
              <p className="text-sm mt-1 mb-5" style={{ color: t.fgMuted }}>
                Mande aqui o material, as ideias e os dados dos imóveis. Fica
                tudo organizado no mesmo lugar, e a equipe responde por aqui.
              </p>
              <MessageForm token={token} t={t} />
            </div>

            {messages === null ? (
              <div className="p-6 text-center text-sm" style={{ ...card, color: t.fgMuted }}>
                Não conseguimos carregar a conversa agora. Tente de novo em alguns minutos.
              </div>
            ) : messages.length > 0 ? (
              <div className="flex flex-col gap-3">
                {[...messages].reverse().map((m) => {
                  const attached = clientFiles.filter((f) => f.jira_comment_id === m.id);
                  // Na mensagem do cliente, a lista de anexos do Jira aponta para o
                  // admin; aqui ele vê os botões de download dele, logo abaixo.
                  const body = m.text.replace(/^📎 .*$/gm, "").trim();
                  return (
                    <div
                      key={m.id}
                      className="p-5"
                      style={{
                        ...card,
                        borderColor: m.fromClient ? t.border : withAlpha(t.primary, "55"),
                        backgroundColor: m.fromClient ? t.surface : withAlpha(t.primary, "0d"),
                      }}
                    >
                      <div className="flex justify-between gap-3 text-xs" style={{ color: t.fgSubtle }}>
                        <span className="font-bold" style={{ color: m.fromClient ? t.fg : t.primaryText }}>
                          {m.fromClient ? "Você" : `${m.author} · PFC`}
                        </span>
                        <span>
                          {new Date(m.createdAt).toLocaleString("pt-BR", {
                            timeZone: "America/Sao_Paulo",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {body && body !== "Enviou arquivos." && (
                        <p className="text-sm leading-relaxed mt-2 whitespace-pre-line" style={{ color: t.fg }}>
                          {body}
                        </p>
                      )}
                      {attached.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {attached.map((f) => (
                            <a
                              key={f.id}
                              href={fileHref(f.id)}
                              className="text-xs font-semibold px-3 py-1.5"
                              style={{
                                borderRadius: t.radius,
                                backgroundColor: t.surfaceStrong,
                                border: `1px solid ${t.border}`,
                                color: t.fg,
                              }}
                            >
                              📎 {f.file_name}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {teamFiles && teamFiles.length > 0 && (
              <div className="p-6" style={card}>
                <h3 className="font-bold" style={{ color: t.fg }}>
                  Arquivos enviados pelo PFC
                </h3>
                <div className="mt-4 flex flex-col gap-2">
                  {teamFiles.map((a) => (
                    <a
                      key={a.id}
                      href={anexoHref(a.id)}
                      className="flex justify-between gap-3 text-sm"
                      style={{ color: t.primaryText }}
                    >
                      <span className="truncate">⬇ {a.fileName}</span>
                      <span className="flex-shrink-0" style={{ color: t.fgSubtle }}>
                        {dataBR(a.createdAt)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "resultados" && (
        <>
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
                  {(isImovelLead(l)
                    ? imovelLeadChips(l)
                    : [
                        labelFor("need", l.need),
                        l.quantity ? `${l.quantity}${l.quantity >= 3 ? "+" : ""} unidade${l.quantity > 1 ? "s" : ""}` : null,
                        labelFor("mode", l.mode),
                        labelFor("timeframe", l.timeframe),
                        labelFor("business_type", l.business_type),
                      ]
                  )
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
        </>
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

function LostLink({ partnerName }: { partnerName: string | null }) {
  const msg = partnerName
    ? `Olá! Sou da ${partnerName} e perdi o link da minha área de cliente no ${site.brand}. Pode me mandar de novo?`
    : `Olá! Perdi o link da minha área de cliente no ${site.brand}. Pode me mandar de novo?`;
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-[#111] border border-[#222] rounded-2xl p-8">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-gold-500">
          Área do cliente · {site.brand}
        </span>
        <h1 className="text-2xl font-bold mt-3">Este link não abre mais</h1>
        <p className="text-white/55 text-sm leading-relaxed mt-3">
          O endereço da área do cliente é pessoal. Se você perdeu o link ou ele
          foi trocado, a gente manda um novo pelo WhatsApp.
        </p>
        <a
          href={whatsapp(msg)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary inline-block mt-6 px-6 py-3.5 rounded-xl font-bold"
        >
          Pedir meu link no WhatsApp
        </a>
      </div>
    </main>
  );
}
