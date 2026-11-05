import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import { Coluna, EspacoHeader, GrupoColuna, Quadro, cartao, diaLabel, porDia } from "@/components/admin/Espaco";
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
    { label: "YouTube", ok: !!(ep.yt_broadcast_id || ep.yt_status === "enviado"), wait: ep.yt_status === "enviando", warn: ep.yt_status === "erro" },
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

const VIEWS = ["quadro", "calendario", "novo"] as const;
type View = (typeof VIEWS)[number];

export default async function AgendaPage({ searchParams }: { searchParams: { mes?: string; view?: string } }) {
  await requireAdmin();
  // Navegar pelos meses só faz sentido no calendário.
  const view: View = VIEWS.includes(searchParams.view as View)
    ? (searchParams.view as View)
    : searchParams.mes
      ? "calendario"
      : "quadro";
  const href = (v: View, mes?: string) =>
    v === "quadro" ? "/admin/agenda" : `/admin/agenda?view=${v}${mes ? `&mes=${mes}` : ""}`;
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
    .slice(0, 20);

  // Grade do mês: começa no domingo da semana do dia 1.
  const dia1 = new Date(`${primeiro}T12:00:00-03:00`);
  const inicioGrade = new Date(dia1.getTime() - dia1.getUTCDay() * 86_400_000);
  const dias = Array.from({ length: 42 }, (_, i) => brtDate(new Date(inicioGrade.getTime() + i * 86_400_000)));
  const noDia = (d: string) => eps.filter((e) => e.status !== "cancelado" && brtDate(e.inicio) === d);
  const hoje = brtDate(agora);
  const nomeMes = dia1.toLocaleDateString("pt-BR", { timeZone: TZ, month: "long", year: "numeric" });

  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  const linkPublico = `${site.url}/convidado`;

  const Etapas = ({ e }: { e: Episodio }) => (
    <div className="flex flex-wrap gap-1 mt-2">
      {etapas(e, cs(e.id), !!gcal).map((s) => (
        <span
          key={s.label}
          className={`text-[10px] px-1.5 py-0.5 rounded border ${
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
  );

  const Titulo = ({ e }: { e: Episodio }) => (
    <>
      <div className="flex items-center gap-1.5 text-[11px] text-white/50">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: corDo(e.quadro) }} />
        <span className="truncate">{nomeDo(e.quadro)}</span>
      </div>
      <p className="text-white text-[13px] font-medium leading-snug line-clamp-2 mt-1">{nomes(e.id)}</p>
    </>
  );

  const pendentes = (e: Episodio) => etapas(e, cs(e.id), !!gcal).filter((s) => !s.ok).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6">
        <EspacoHeader
          area="Agenda"
          titulo="Agenda de convidados"
          extra={
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">Link para convidados:</span>
              <code className="text-gold-400">{linkPublico}</code>
              <CopyButton value={linkPublico} />
            </div>
          }
          acoes={
            <>
              <a href="/admin/agenda/semana" className="text-gold-400 hover:text-gold-300 text-sm border border-gold-500/40 rounded-lg px-3 py-1.5">
                Agenda da semana
              </a>
              <a href="/admin/agenda/config" className="text-white/50 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5">
                Configurar
              </a>
            </>
          }
          abas={[
            { href: href("quadro"), label: "Quadro", ativa: view === "quadro", count: pedidos.length || undefined },
            { href: href("calendario"), label: "Calendário", ativa: view === "calendario" },
            { href: href("novo"), label: "Novo episódio", ativa: view === "novo" },
          ]}
        />

        {/* Quadro */}
        {view === "quadro" && (
          <>
            <p className="text-white/35 text-xs mt-4 max-w-3xl">
              O convidado pede o horário pelo link público e preenche o briefing. Ao confirmar, sai o convite no Google
              Calendar e o roteiro da IA; depois vêm a arte, o post collab no Instagram e a live agendada no YouTube.
            </p>
            <Quadro cols={3}>
              <Coluna titulo="Pedidos para confirmar" count={pedidos.length} vazio="Nenhum pedido novo.">
                {pedidos.map((e) => (
                  <div key={e.id} className={`${cartao} border-gold-500/25`}>
                    <a href={`/admin/agenda/${e.id}`} className="block">
                      <Titulo e={e} />
                      <p className="text-white/50 text-[11px] mt-1 capitalize">{quandoLongo(e.inicio)}</p>
                    </a>
                    <div className="flex items-center gap-3 mt-2.5">
                      <ProducaoForm
                        action={confirmarAction}
                        label="Confirmar"
                        pending="Confirmando..."
                        buttonClassName="btn-primary px-2.5 py-1 rounded-md text-xs font-bold"
                      >
                        <input type="hidden" name="id" value={e.id} />
                      </ProducaoForm>
                      <a href={`/admin/agenda/${e.id}`} className="text-xs text-white/50 hover:text-white">
                        Ver briefing
                      </a>
                    </div>
                  </div>
                ))}
              </Coluna>

              <Coluna titulo="Confirmados" count={proximos.length} vazio="Nada confirmado.">
                {porDia(proximos, (e) => e.inicio).map(([dia, es]) => (
                  <div key={dia} className="space-y-2">
                    <GrupoColuna label={diaLabel(dia)} count={es.length} />
                    {es.map((e) => {
                      const falta = pendentes(e);
                      return (
                        <a key={e.id} href={`/admin/agenda/${e.id}`} className={cartao}>
                          <Titulo e={e} />
                          <p className="text-white/40 text-[11px] mt-1">
                            {hora(e.inicio)}
                            {falta > 0 ? ` · faltam ${falta} etapa${falta > 1 ? "s" : ""}` : " · tudo pronto"}
                          </p>
                          <Etapas e={e} />
                        </a>
                      );
                    })}
                  </div>
                ))}
              </Coluna>

              <Coluna titulo="Encerrados" count={recentes.length} vazio="Nada gravado ainda.">
                {recentes.map((e) => (
                  <a key={e.id} href={`/admin/agenda/${e.id}`} className={`${cartao} ${e.status === "cancelado" ? "opacity-60" : ""}`}>
                    <Titulo e={e} />
                    <div className="flex items-center justify-between gap-2 mt-1.5">
                      <span className="text-white/40 text-[11px] capitalize">{quandoLongo(e.inicio)}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_EP[e.status].cls}`}>
                        {STATUS_EP[e.status].label}
                      </span>
                    </div>
                  </a>
                ))}
              </Coluna>
            </Quadro>
          </>
        )}

        {/* Calendário */}
        {view === "calendario" && (
          <section className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white capitalize">{nomeMes}</h2>
              <div className="flex gap-2 text-sm">
                <a href={href("calendario", ant)} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">←</a>
                <a href={href("calendario")} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">Hoje</a>
                <a href={href("calendario", prox)} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">→</a>
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
                    <div key={d} className={`bg-[#111] min-h-[104px] p-1.5 ${fora ? "opacity-40" : ""}`}>
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
        )}

        {/* Novo episódio */}
        {view === "novo" && (
          <section className="mt-4 bg-[#111] border border-[#222] rounded-2xl p-6 max-w-4xl">
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
        )}
      </div>
    </div>
  );
}
