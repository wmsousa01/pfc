import AdminHeader from "@/components/admin/AdminHeader";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { YT_STREAM_KEY } from "@/lib/agenda/fluxo";
import { calendarAccount, calendarId, equipeEmails } from "@/lib/agenda/gcal";
import { WEEKDAYS, db, listSlots, type Bloqueio } from "@/lib/agenda/store";
import { QUADROS, QUADRO_IDS, isQuadroId } from "@/lib/producao/quadros";
import { getConfig } from "@/lib/producao/store";
import { connectedChannel, isYouTubeOAuthConfigured, listLiveStreams } from "@/lib/producao/youtube-api";
import {
  bloqueioAction,
  bloqueioRemoverAction,
  gcalConfigAction,
  gcalDisconnectAction,
  slotAction,
  slotRemoverAction,
  slotToggleAction,
  streamAction,
} from "../actions";

export const dynamic = "force-dynamic";

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const card = "bg-[#111] border border-[#222] rounded-2xl p-6";
const btn2 = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5";

export default async function AgendaConfigPage({ searchParams }: { searchParams: { ok?: string; erro?: string } }) {
  await requireAdmin();
  const hoje = new Date().toISOString().slice(0, 10);
  const [slots, { data: bloqRows }, gcal, cal, equipe, channel, streamId] = await Promise.all([
    listSlots(),
    db().from("agenda_bloqueios").select("*").gte("data", hoje).order("data"),
    calendarAccount(),
    calendarId(),
    equipeEmails(),
    connectedChannel(),
    getConfig(YT_STREAM_KEY),
  ]);
  const bloqueios = (bloqRows ?? []) as Bloqueio[];
  const streams = channel ? await listLiveStreams().catch((e: Error) => e) : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <a href="/admin/agenda" className="text-white/40 hover:text-white text-sm">← Agenda</a>
          <h1 className="text-2xl font-bold text-white mt-2">Configurar agenda</h1>
        </div>

        {searchParams.ok && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
            Google Calendar conectado: {searchParams.ok}
          </div>
        )}
        {searchParams.erro && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">{searchParams.erro}</div>
        )}

        <section className={card}>
          <h2 className="text-white font-bold">1. Horários de gravação</h2>
          <p className="text-white/40 text-sm mt-1">
            O que aparece no link público. Cada horário fixo abre uma vaga por semana, de “antecedência” até “janela”
            dias à frente. Quadro sem horário ativo some do link (PFC Visita entra pelo “Novo episódio”).
          </p>
          <div className="mt-4 space-y-1.5">
            {slots.map((s) => (
              <div key={s.id} className={`flex flex-wrap items-center gap-3 text-sm ${s.ativo ? "text-white/80" : "text-white/30"}`}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: isQuadroId(s.quadro) ? QUADROS[s.quadro].accent[1] : "#666" }} />
                <span className="w-36">{isQuadroId(s.quadro) ? QUADROS[s.quadro].name : s.quadro}</span>
                <span className="w-32 capitalize">{WEEKDAYS[s.weekday]}, {s.hora}</span>
                <span className="text-white/40 text-xs">{s.duracao_min} min · {s.antecedencia_dias}–{s.janela_dias} dias</span>
                <form action={slotToggleAction}>
                  <input type="hidden" name="slot" value={s.id} />
                  <input type="hidden" name="ativo" value={s.ativo ? "0" : "1"} />
                  <button className="text-xs text-white/40 hover:text-white">{s.ativo ? "Pausar" : "Ativar"}</button>
                </form>
                <form action={slotRemoverAction}>
                  <input type="hidden" name="slot" value={s.id} />
                  <button className="text-xs text-white/30 hover:text-red-400">Remover</button>
                </form>
              </div>
            ))}
          </div>
          <ProducaoForm action={slotAction} label="Adicionar horário" pending="Salvando..." className="mt-4 flex flex-wrap items-start gap-2" buttonClassName={btn2}>
            <select name="quadro" required defaultValue="" className={input}>
              <option value="" disabled>Quadro</option>
              {QUADRO_IDS.map((q) => <option key={q} value={q}>{QUADROS[q].name}</option>)}
            </select>
            <select name="weekday" className={input} defaultValue="2">
              {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
            <input type="time" name="hora" required defaultValue="19:00" className={input} />
            <input type="number" name="duracao" defaultValue={90} min={15} step={15} className={`${input} w-20`} title="Duração (min)" />
            <input type="number" name="antecedencia" defaultValue={2} min={0} className={`${input} w-16`} title="Antecedência mínima (dias)" />
            <input type="number" name="janela" defaultValue={42} min={7} className={`${input} w-16`} title="Janela (dias)" />
          </ProducaoForm>
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">2. Datas bloqueadas</h2>
          <p className="text-white/40 text-sm mt-1">Feriado, viagem, estúdio ocupado: a data some do link público.</p>
          <div className="mt-3 space-y-1">
            {bloqueios.map((bl) => (
              <div key={bl.id} className="flex items-center gap-3 text-sm text-white/70">
                <span>{bl.data.split("-").reverse().join("/")}</span>
                <span className="text-white/40">{bl.quadro && isQuadroId(bl.quadro) ? QUADROS[bl.quadro].name : "todos os quadros"}</span>
                {bl.motivo && <span className="text-white/40">· {bl.motivo}</span>}
                <form action={bloqueioRemoverAction}>
                  <input type="hidden" name="bloqueio" value={bl.id} />
                  <button className="text-xs text-white/30 hover:text-red-400">Remover</button>
                </form>
              </div>
            ))}
          </div>
          <ProducaoForm action={bloqueioAction} label="Bloquear" pending="Salvando..." className="mt-3 flex flex-wrap items-start gap-2" buttonClassName={btn2}>
            <input type="date" name="data" required className={input} />
            <select name="quadro" className={input} defaultValue="">
              <option value="">Todos os quadros</option>
              {QUADRO_IDS.map((q) => <option key={q} value={q}>{QUADROS[q].name}</option>)}
            </select>
            <input name="motivo" placeholder="Motivo" className={`${input} w-48`} />
          </ProducaoForm>
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">3. Google Calendar</h2>
          <p className="text-white/40 text-sm mt-1">
            Cada episódio confirmado vira evento com o convidado e a equipe como participantes; o Google manda o
            convite e o lembrete de véspera por e-mail. Conecte com a conta da produção (não precisa ser a do canal).
          </p>
          {!isYouTubeOAuthConfigured() ? (
            <p className="text-yellow-300 text-sm mt-3">Faltam GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.</p>
          ) : gcal ? (
            <div className="flex items-center justify-between gap-3 mt-3">
              <span className="text-emerald-400 text-sm font-semibold">✓ {gcal}</span>
              <form action={gcalDisconnectAction}>
                <button className="text-xs text-white/50 hover:text-red-400">Desconectar</button>
              </form>
            </div>
          ) : (
            <a href="/api/agenda/gcal" className="btn-primary inline-block mt-3 px-4 py-2 rounded-lg text-sm font-bold">
              Conectar Google Calendar
            </a>
          )}
          <ProducaoForm action={gcalConfigAction} label="Salvar" pending="Salvando..." okMessage="Salvo." className="mt-4 space-y-2" buttonClassName={btn2}>
            <label className="block text-white/50 text-xs">
              Agenda (vazio = principal da conta)
              <input name="calendar" defaultValue={cal === "primary" ? "" : cal} placeholder="id@group.calendar.google.com" className={`${input} w-full mt-1`} />
            </label>
            <label className="block text-white/50 text-xs">
              E-mails da equipe convidados para todo episódio
              <input name="equipe" defaultValue={equipe.join(", ")} placeholder="apresentador@..., producao@..." className={`${input} w-full mt-1`} />
            </label>
          </ProducaoForm>
        </section>

        <section className={card}>
          <h2 className="text-white font-bold">4. Stream do estúdio no YouTube</h2>
          <p className="text-white/40 text-sm mt-1">
            A live criada pelo hub é ligada a este stream: é a chave que o OBS/vMix do estúdio usa, então ninguém
            precisa trocar nada na hora de entrar no ar. Usa o canal conectado em Produção.
          </p>
          {!channel ? (
            <p className="text-yellow-300 text-sm mt-3">
              Canal não conectado. <a href="/admin/producao/config" className="underline">Conectar em Produção</a>
            </p>
          ) : streams instanceof Error ? (
            <p className="text-red-400 text-sm mt-3 break-words">{streams.message}</p>
          ) : (
            <ProducaoForm action={streamAction} label="Salvar" pending="Salvando..." okMessage="Salvo." className="mt-3 flex flex-wrap items-start gap-2" buttonClassName={btn2}>
              <select name="stream" defaultValue={streamId ?? ""} className={`${input} min-w-64`}>
                <option value="">Nenhum (ligar no Studio na hora)</option>
                {(streams ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}{s.reusable ? "" : " (uso único)"}
                  </option>
                ))}
              </select>
            </ProducaoForm>
          )}
        </section>
      </div>
    </div>
  );
}
