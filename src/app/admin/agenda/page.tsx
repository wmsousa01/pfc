import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { calendarAccount } from "@/lib/agenda/gcal";
import {
  TZ,
  brtDate,
  db,
  quandoLongo,
  type Convidado,
  type Episodio,
} from "@/lib/agenda/store";
import { site } from "@/lib/config";
import { QUADROS, QUADRO_IDS, isQuadroId } from "@/lib/producao/quadros";
import { confirmarAction, novoEpisodioAction } from "./actions";
import { STATUS_EP } from "./shared";

export const dynamic = "force-dynamic";
// Confirmar gera o briefing no Gemini dentro da action.
export const maxDuration = 120;

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";

const corDo = (q: string) => (isQuadroId(q) ? QUADROS[q].accent[1] : "#666");
const nomeDo = (q: string) => (isQuadroId(q) ? QUADROS[q].name : q);

/** O que falta para o episódio estar pronto, na ordem do fluxo. */
function etapas(ep: Episodio, cs: Convidado[], gcal: boolean) {
  // Sem convidado (PFC News), não há briefing nem foto de convidado para esperar.
  const doConvidado = cs.length
    ? [
        { label: "Briefing do convidado", ok: cs.every((c) => c.briefing_em) },
        { label: "Foto", ok: cs.every((c) => c.foto_path || c.ig_perfil?.picture) },
      ]
    : [];
  return [
    ...doConvidado,
    { label: "Roteiro", ok: !!ep.briefing },
    { label: "Arte", ok: !!ep.arte_id },
    { label: "Instagram", ok: ep.ig_status === "publicado", warn: ep.ig_status === "erro", wait: ep.ig_status === "agendado" },
    { label: "Live", ok: !!ep.yt_broadcast_id },
    ...(gcal ? [{ label: "Agenda", ok: !!ep.gcal_event_id }] : []),
  ];
}

function mesAtual(v: string | undefined): { ano: number; mes: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(v ?? "");
  if (m) return { ano: Number(m[1]), mes: Number(m[2]) };
  const [ano, mes] = brtDate(new Date()).split("-").map(Number);
  return { ano, mes };
}

const pad = (n: number) => String(n).padStart(2, "0");

export default async function AgendaPage({ searchParams }: { searchParams: { mes?: string } }) {
  await requireAdmin();
  const { ano, mes } = mesAtual(searchParams.mes);
  const primeiro = `${ano}-${pad(mes)}-01`;
  const prox = mes === 12 ? `${ano + 1}-01` : `${ano}-${pad(mes + 1)}`;
  const ant = mes === 1 ? `${ano - 1}-12` : `${ano}-${pad(mes - 1)}`;

  const agora = new Date();
  const desde = new Date(Math.min(new Date(`${primeiro}T00:00:00-03:00`).getTime(), agora.getTime() - 14 * 86_400_000));
  const ate = new Date(`${prox}-01T00:00:00-03:00`);
  const [{ data: rows }, gcal] = await Promise.all([
    db()
      .from("agenda_episodios")
      .select("*")
      .or(`inicio.gte.${desde.toISOString()},status.eq.solicitado`)
      .order("inicio")
      .limit(300),
    calendarAccount(),
  ]);
  const eps = (rows ?? []) as Episodio[];
  const { data: crows } = eps.length
    ? await db().from("agenda_convidados").select("*").in("episodio_id", eps.map((e) => e.id)).order("created_at")
    : { data: [] };
  const convidados = (crows ?? []) as Convidado[];
  const cs = (id: string) => convidados.filter((c) => c.episodio_id === id);
  const nomes = (id: string) => cs(id).map((c) => c.nome).join(", ") || eps.find((e) => e.id === id)?.tema || "sem convidado";

  const pedidos = eps.filter((e) => e.status === "solicitado");
  const proximos = eps.filter((e) => e.status === "confirmado");
  const recentes = eps
    .filter((e) => (e.status === "realizado" || e.status === "cancelado") && new Date(e.inicio) < agora)
    .reverse()
    .slice(0, 12);

  // Grade do mês: começa no domingo da semana do dia 1.
  const dia1 = new Date(`${primeiro}T12:00:00-03:00`);
  const inicioGrade = new Date(dia1.getTime() - dia1.getUTCDay() * 86_400_000);
  const dias = Array.from({ length: 42 }, (_, i) => brtDate(new Date(inicioGrade.getTime() + i * 86_400_000)));
  const noDia = (d: string) => eps.filter((e) => e.status !== "cancelado" && brtDate(e.inicio) === d);
  const hoje = brtDate(agora);
  const nomeMes = dia1.toLocaleDateString("pt-BR", { timeZone: TZ, month: "long", year: "numeric" });

  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const linkPublico = `${site.url}/convidado`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Agenda de convidados</h1>
            <p className="text-white/40 text-sm mt-1 max-w-2xl">
              O convidado pede o horário pelo link público e preenche o briefing. Ao confirmar, sai o convite no Google
              Calendar e o roteiro da IA; depois vêm a arte, o post collab no Instagram e a live agendada no YouTube.
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs">
              <span className="text-white/40">Link para convidados:</span>
              <code className="text-gold-400">{linkPublico}</code>
              <CopyButton value={linkPublico} />
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/admin/agenda/semana" className="text-gold-400 hover:text-gold-300 text-sm border border-gold-500/40 rounded-lg px-3 py-2">
              Agenda da semana
            </a>
            <a href="/admin/agenda/config" className="text-white/50 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-2">
              Configurar
            </a>
          </div>
        </div>

        {pedidos.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Pedidos para confirmar ({pedidos.length})</h2>
            <div className="space-y-2">
              {pedidos.map((e) => (
                <div key={e.id} className="flex flex-wrap items-center justify-between gap-3 bg-[#111] border border-gold-500/30 rounded-xl p-4">
                  <a href={`/admin/agenda/${e.id}`} className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: corDo(e.quadro) }} />
                      <span className="text-white font-semibold">{nomes(e.id)}</span>
                      <span className="text-white/40 text-sm">· {nomeDo(e.quadro)}</span>
                    </div>
                    <div className="text-white/50 text-sm mt-1 capitalize">{quandoLongo(e.inicio)}</div>
                  </a>
                  <div className="flex items-center gap-2">
                    <a href={`/admin/agenda/${e.id}`} className="text-xs text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-2">
                      Ver briefing
                    </a>
                    <ProducaoForm action={confirmarAction} label="Confirmar" pending="Confirmando...">
                      <input type="hidden" name="id" value={e.id} />
                    </ProducaoForm>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-lg font-bold text-white mb-3">Próximas gravações</h2>
          {proximos.length === 0 ? (
            <p className="text-white/40 text-sm">Nada confirmado.</p>
          ) : (
            <div className="space-y-2">
              {proximos.map((e) => (
                <a
                  key={e.id}
                  href={`/admin/agenda/${e.id}`}
                  className="block bg-[#111] border border-[#222] hover:border-[#333] rounded-xl p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corDo(e.quadro) }} />
                      <span className="text-white font-semibold truncate">{nomes(e.id)}</span>
                      <span className="text-white/40 text-sm">· {nomeDo(e.quadro)}</span>
                    </div>
                    <span className="text-white/60 text-sm capitalize">{quandoLongo(e.inicio)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {etapas(e, cs(e.id), !!gcal).map((s) => (
                      <span
                        key={s.label}
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${
                          s.ok
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            : "warn" in s && s.warn
                              ? "border-red-500/30 bg-red-500/10 text-red-400"
                              : "wait" in s && s.wait
                                ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                                : "border-white/10 text-white/35"
                        }`}
                      >
                        {s.ok ? "✓ " : ""}
                        {s.label}
                      </span>
                    ))}
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white capitalize">{nomeMes}</h2>
            <div className="flex gap-2 text-sm">
              <a href={`?mes=${ant}`} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">←</a>
              <a href="?" className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">Hoje</a>
              <a href={`?mes=${prox}`} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">→</a>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-px bg-[#1c1c1c] border border-[#1c1c1c] rounded-xl overflow-hidden min-w-[640px]">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <div key={d} className="bg-[#0d0d0d] text-white/40 text-[11px] font-semibold px-2 py-1.5">{d}</div>
              ))}
              {dias.map((d) => {
                const fora = !d.startsWith(`${ano}-${pad(mes)}`);
                return (
                  <div key={d} className={`bg-[#111] min-h-[88px] p-1.5 ${fora ? "opacity-40" : ""}`}>
                    <div className={`text-[11px] mb-1 ${d === hoje ? "text-gold-400 font-bold" : "text-white/40"}`}>
                      {Number(d.slice(8))}
                    </div>
                    <div className="space-y-1">
                      {noDia(d).map((e) => (
                        <a
                          key={e.id}
                          href={`/admin/agenda/${e.id}`}
                          className={`block text-[11px] leading-tight rounded px-1.5 py-1 truncate ${
                            e.status === "solicitado" ? "border border-dashed" : ""
                          }`}
                          style={{ background: `${corDo(e.quadro)}22`, color: corDo(e.quadro), borderColor: corDo(e.quadro) }}
                          title={`${nomeDo(e.quadro)} · ${nomes(e.id)}`}
                        >
                          {hora(e.inicio)} {nomes(e.id)}
                        </a>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-white/30 text-xs mt-2">Borda tracejada = pedido ainda não confirmado.</p>
        </section>

        <section className="bg-[#111] border border-[#222] rounded-2xl p-6">
          <h2 className="text-white font-bold">Novo episódio</h2>
          <p className="text-white/40 text-sm mt-1">
            Para quadro sem horário fixo (PFC Visita), convidado que a equipe já combinou ou episódio sem convidado
            (PFC News: deixe o nome vazio e escreva o tema da semana). Entra confirmado; o convidado completa o briefing
            pelo link que aparece na página do episódio.
          </p>
          <ProducaoForm action={novoEpisodioAction} label="Criar episódio" pending="Criando..." className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <select name="quadro" required className={input} defaultValue="">
                <option value="" disabled>Quadro</option>
                {QUADRO_IDS.map((q) => (
                  <option key={q} value={q}>{QUADROS[q].name}</option>
                ))}
              </select>
              <input type="date" name="data" required className={input} />
              <input type="time" name="hora" required defaultValue="19:00" className={input} />
              <input type="number" name="duracao" defaultValue={90} min={15} step={15} className={`${input} w-24`} title="Duração (min)" />
              <input name="tema" placeholder="Tema (obrigatório sem convidado)" className={`${input} w-72`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <input name="nome" placeholder="Nome do convidado (vazio = sem convidado)" className={`${input} w-72`} />
              <input name="instagram" placeholder="@instagram" className={`${input} w-40`} />
              <input name="whatsapp" placeholder="WhatsApp" className={`${input} w-40`} />
              <input name="email" type="email" placeholder="E-mail (convite)" className={`${input} w-56`} />
              <input name="cargo" placeholder="Cargo na arte" className={`${input} w-44`} />
            </div>
          </ProducaoForm>
        </section>

        {recentes.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">Recentes</h2>
            <div className="space-y-1">
              {recentes.map((e) => (
                <a key={e.id} href={`/admin/agenda/${e.id}`} className="flex items-center gap-3 text-sm text-white/50 hover:text-white">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_EP[e.status].cls}`}>
                    {STATUS_EP[e.status].label}
                  </span>
                  <span className="capitalize">{quandoLongo(e.inicio)}</span>
                  <span>· {nomeDo(e.quadro)} · {nomes(e.id)}</span>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
