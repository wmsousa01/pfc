import CopyButton from "@/components/CopyButton";
import { site } from "@/lib/config";
import type { ClientAccount } from "@/lib/client-area";
import { jiraBrowseUrl, type ClientDelivery, type DeliveryStatus } from "@/lib/jira";
import {
  addLinkAction,
  createDeliveryAction,
  deliverAction,
  reopenAction,
  rotateTokenAction,
} from "./actions";


/**
 * Peças compartilhadas da central de entregas: helpers e o bloco completo de
 * um cliente (entregas + acesso ao portal), usado na página do cliente.
 *
 * Central das entregas dos patrocinadores. O Jira continua sendo o backend
 * (um Epic por cliente, tarefas com a label entrega-cliente); esta página só
 * junta tudo num lugar e faz as operações do dia a dia sem abrir o Jira.
 */

export const STATUS: Record<DeliveryStatus, { label: string; cls: string }> = {
  programado: { label: "Programado", cls: "bg-white/5 border-white/15 text-white/60" },
  em_producao: { label: "Em produção", cls: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" },
  entregue: { label: "Entregue", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
};

export const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-gold-500/50";

export function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function dataBR(iso: string | null): string {
  if (!iso) return "sem data";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
  });
}

export function isLate(d: ClientDelivery): boolean {
  return d.status !== "entregue" && !!d.dueDate && d.dueDate < today();
}

export function panelUrl(a: ClientAccount): string {
  return `${site.url}/parceiros/${a.slug}/painel?token=${a.token}`;
}

export function sendLinkHref(a: ClientAccount): string {
  const msg =
    `Olá! Aqui está o link da sua área de cliente no ${site.brand}: ${panelUrl(a)}\n\n` +
    "Por lá você acompanha as entregas, fala com a gente e manda material. O link é só seu, não compartilhe.";
  const to = a.whatsapp?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${to}?text=${encodeURIComponent(msg)}`;
}

export function ClientSection({
  account: a,
  deliveries,
  awaiting,
}: {
  account: ClientAccount;
  deliveries: ClientDelivery[] | null;
  awaiting: boolean;
}) {
  const done = deliveries?.filter((d) => d.status === "entregue").length ?? 0;
  return (
              <section className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
                {/* Cabeçalho do cliente */}
                <div className="p-5 sm:p-6 border-b border-[#222] flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">{a.name}</h2>
                    <div className="text-white/40 text-xs mt-1">
                      Plano {a.contract.plan} · desde {dataBR(a.contract.start)} · {a.contract.months} meses
                      {deliveries ? ` · ${done}/${deliveries.length} entregues` : ""}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                          a.acceptedAt
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                            : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                        }`}
                      >
                        {a.acceptedAt ? `Termos aceitos em ${dataBR(a.acceptedAt)} por ${a.acceptedBy}` : "Termos pendentes"}
                      </span>
                      {awaiting && a.jiraChat && (
                        <a
                          href={jiraBrowseUrl(a.jiraChat)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-orange-500/15 border-orange-500/40 text-orange-400"
                        >
                          Mensagem esperando resposta ↗
                        </a>
                      )}
                      {!a.active && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full border bg-white/5 border-white/15 text-white/50">
                          Página pública desativada
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {a.jiraEpic && (
                      <a href={jiraBrowseUrl(a.jiraEpic)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-white/70 hover:text-white">
                        Epic {a.jiraEpic} ↗
                      </a>
                    )}
                    {a.jiraChat && (
                      <a href={jiraBrowseUrl(a.jiraChat)} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-white/70 hover:text-white">
                        Conversa {a.jiraChat} ↗
                      </a>
                    )}
                    <a href={`/parceiros/${a.slug}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-lg border border-[#2a2a2a] text-white/70 hover:text-white">
                      Página ↗
                    </a>
                  </div>
                </div>

                <div className="grid lg:grid-cols-[1fr_300px]">
                  {/* Entregas */}
                  <div className="p-5 sm:p-6 lg:border-r border-[#222]">
                    {deliveries === null ? (
                      <p className="text-white/40 text-sm">Não foi possível ler as entregas no Jira.</p>
                    ) : deliveries.length === 0 ? (
                      <p className="text-white/40 text-sm">Nenhuma entrega cadastrada ainda.</p>
                    ) : (
                      <ul className="flex flex-col divide-y divide-[#1e1e1e]">
                        {deliveries.map((d) => (
                          <li key={d.key} className="py-3 first:pt-0">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-white text-sm font-semibold">{d.title}</div>
                                <div className={`text-xs mt-0.5 ${isLate(d) ? "text-red-400 font-semibold" : "text-white/35"}`}>
                                  <a href={jiraBrowseUrl(d.key)} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                                    {d.key}
                                  </a>{" "}
                                  ·{" "}
                                  {d.status === "entregue" && d.deliveredAt
                                    ? `entregue em ${dataBR(d.deliveredAt)}`
                                    : isLate(d)
                                      ? `atrasada desde ${dataBR(d.dueDate)}`
                                      : `prevista para ${dataBR(d.dueDate)}`}
                                </div>
                                {d.links.length > 0 && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
                                    {d.links.map((l) => (
                                      <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:text-gold-400 text-xs">
                                        {l.title} ↗
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS[d.status].cls}`}>
                                {STATUS[d.status].label}
                              </span>
                            </div>

                            {d.status !== "entregue" ? (
                              <details className="mt-2">
                                <summary className="text-xs text-gold-500 cursor-pointer select-none">Marcar como entregue</summary>
                                <form action={deliverAction} className="mt-2 flex flex-col sm:flex-row gap-2">
                                  <input type="hidden" name="key" value={d.key} />
                                  <input name="url" type="url" placeholder="Link do material (opcional)" className={`${input} flex-1`} />
                                  <input name="link_title" placeholder="Nome do link" className={`${input} sm:w-40`} />
                                  <button className="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Entregar</button>
                                </form>
                              </details>
                            ) : (
                              <details className="mt-2">
                                <summary className="text-xs text-white/40 cursor-pointer select-none">Adicionar link ou reabrir</summary>
                                <form action={addLinkAction} className="mt-2 flex flex-col sm:flex-row gap-2">
                                  <input type="hidden" name="key" value={d.key} />
                                  <input name="url" type="url" required placeholder="https://…" className={`${input} flex-1`} />
                                  <input name="link_title" placeholder="Nome do link" className={`${input} sm:w-40`} />
                                  <button className="px-4 py-2 rounded-lg text-sm font-bold border border-[#2a2a2a] text-white/80">Adicionar</button>
                                </form>
                                <form action={reopenAction} className="mt-2">
                                  <input type="hidden" name="key" value={d.key} />
                                  <button className="text-xs text-white/40 hover:text-white">Reabrir entrega</button>
                                </form>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {a.jiraEpic && (
                      <form action={createDeliveryAction} className="mt-5 pt-5 border-t border-[#1e1e1e] flex flex-col sm:flex-row gap-2">
                        <input type="hidden" name="epic" value={a.jiraEpic} />
                        <input name="title" required minLength={3} placeholder="Nova entrega (o cliente vê este título)" className={`${input} flex-1`} />
                        <input name="due" type="date" className={`${input} sm:w-40`} />
                        <button className="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Criar</button>
                      </form>
                    )}
                  </div>

                  {/* Acesso ao portal */}
                  <div className="p-5 sm:p-6 bg-[#0d0d0d]">
                    <h3 className="text-white font-semibold text-sm">Acesso ao portal</h3>
                    <p className="text-white/35 text-xs mt-1">Cliente perdeu o link? Reenvie por aqui.</p>
                    <div className="flex flex-col gap-2 mt-4">
                      <a
                        href={sendLinkHref(a)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary text-center py-2.5 rounded-lg text-sm font-bold"
                      >
                        {a.whatsapp ? "Enviar link no WhatsApp dele" : "Enviar link pelo WhatsApp"}
                      </a>
                      <CopyButton value={panelUrl(a)} label="Copiar link" />
                      <a href={panelUrl(a)} target="_blank" rel="noopener noreferrer" className="text-gold-500 hover:text-gold-400 text-xs text-center">
                        Abrir portal como o cliente ↗
                      </a>
                    </div>
                    <details className="mt-5">
                      <summary className="text-xs text-white/35 cursor-pointer select-none">Link vazou? Gerar um novo</summary>
                      <form action={rotateTokenAction} className="mt-2 flex flex-col gap-2">
                        <input type="hidden" name="partner_id" value={a.partnerId} />
                        <label className="flex items-start gap-2 text-xs text-white/50">
                          <input type="checkbox" name="confirm" className="mt-0.5" />
                          O link atual para de funcionar na hora. Depois, reenvie o novo.
                        </label>
                        <button className="px-3 py-2 rounded-lg text-xs font-bold border border-red-500/40 text-red-300">
                          Gerar novo link
                        </button>
                      </form>
                    </details>
                  </div>
                </div>
              </section>
  );
}
