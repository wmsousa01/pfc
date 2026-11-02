import AdminHeader from "@/components/admin/AdminHeader";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { episodiosDaSemana, getSemana, legendaSemana, resumoCard } from "@/lib/agenda/semana";
import { TZ, addDays, brtDate, db, segundaDe, type SemanaArte } from "@/lib/agenda/store";
import { signedUrls } from "@/lib/producao/store";
import { activeConnection } from "@/lib/social/store";
import { escolherSemanaAction, gerarSemanaAction, semanaInstagramAction, semanaResetAction } from "../actions";

export const dynamic = "force-dynamic";
// A arte da semana sai do Gemini dentro da action.
export const maxDuration = 300;

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const card = "bg-[#111] border border-[#222] rounded-2xl p-6";
const btn2 = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ddmm = (d: string) => d.slice(8) + "/" + d.slice(5, 7);

export default async function SemanaPage({ searchParams }: { searchParams: { de?: string } }) {
  await requireAdmin();
  const hoje = brtDate(new Date());
  const segunda = segundaDe(/^\d{4}-\d{2}-\d{2}$/.test(searchParams.de ?? "") ? searchParams.de! : hoje);
  const domingo = addDays(segunda, 6);

  const [itens, semana, { data: arteRows }, ig] = await Promise.all([
    episodiosDaSemana(segunda),
    getSemana(segunda),
    db().from("agenda_semana_artes").select("*").eq("semana", segunda).order("created_at", { ascending: false }).limit(8),
    activeConnection("instagram").catch(() => null),
  ]);
  const artes = (arteRows ?? []) as SemanaArte[];
  const urls = await signedUrls(artes.map((a) => a.path));
  const escolhida = artes.find((a) => a.id === semana?.arte_id) ?? null;
  const handles = Array.from(new Set(itens.flatMap((i) => i.convidados.map((c) => c.instagram)).filter(Boolean))).slice(0, 3);
  const semArte = itens.filter((i) => !i.ep.arte_id).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <a href="/admin/agenda" className="text-white/40 hover:text-white text-sm">← Agenda</a>
          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <h1 className="text-2xl font-bold text-white">
              Agenda da semana · {ddmm(segunda)} a {ddmm(domingo)}
            </h1>
            <div className="flex gap-2 text-sm">
              <a href={`?de=${addDays(segunda, -7)}`} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">←</a>
              <a href="?" className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">Esta semana</a>
              <a href={`?de=${addDays(segunda, 7)}`} className="text-white/50 hover:text-white border border-[#2a2a2a] rounded-lg px-3 py-1">→</a>
            </div>
          </div>
          <p className="text-white/40 text-sm mt-1 max-w-3xl">
            Uma arte 3:4 com todos os episódios confirmados da semana, um card por episódio, na ordem. A IA usa a arte
            escolhida de cada episódio como referência (pessoas, logo e cenário) e escreve as datas exatamente como
            abaixo — confira antes de publicar.
          </p>
        </div>

        <section className={card}>
          <h2 className="text-white font-bold">Episódios da semana</h2>
          {itens.length === 0 ? (
            <p className="text-white/40 text-sm mt-2">Nenhum episódio confirmado entre {ddmm(segunda)} e {ddmm(domingo)}.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {itens.map(({ ep, convidados }) => {
                const r = resumoCard(ep, convidados);
                const a = ep.briefing?.arte;
                return (
                  <a key={ep.id} href={`/admin/agenda/${ep.id}`} className="flex flex-wrap items-center gap-3 text-sm hover:bg-white/[0.02] rounded-lg p-2 -mx-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.quadro.accent[1] }} />
                    <span className="text-white font-bold w-14">{r.data}</span>
                    <span className="text-white/60 w-32">{r.dia}</span>
                    <span className="text-white/60 w-20">{r.hora}</span>
                    <span className="text-white">{r.quadro.name}</span>
                    <span className="text-white/50">{r.convidados.length ? `com ${r.convidados.join(" e ")}` : ep.tema ?? ""}</span>
                    {a?.l1 && <span className="text-white/35 text-xs">· {[a.l1, a.l2, a.l3].filter(Boolean).join(" ")}</span>}
                    {!ep.arte_id && <span className="text-yellow-300/80 text-xs">sem arte escolhida</span>}
                  </a>
                );
              })}
            </div>
          )}
          {semArte > 0 && (
            <p className="text-yellow-300/70 text-xs mt-3">
              {semArte === 1 ? "Um episódio está" : `${semArte} episódios estão`} sem arte escolhida: o card sai das fotos e do
              logo direto, com menos fidelidade à arte do episódio.
            </p>
          )}
          {itens.length > 0 && (
            <ProducaoForm
              action={gerarSemanaAction}
              label={artes.length ? "Gerar outra versão" : "Gerar arte da semana"}
              pending="Gerando (~1 min)..."
              className="mt-4 flex flex-wrap items-center gap-3"
              buttonClassName="px-3 py-1.5 rounded-lg text-xs font-bold border border-gold-500/40 text-gold-400 hover:bg-gold-500/10"
            >
              <input type="hidden" name="semana" value={segunda} />
              <label className="flex items-center gap-1.5 text-xs text-white/60">
                <input type="checkbox" name="hoje" value="1" defaultChecked={brtDate(itens[0].ep.inicio) === hoje} /> “HOJE” no primeiro card
              </label>
            </ProducaoForm>
          )}
        </section>

        {artes.length > 0 && (
          <section className={card}>
            <h2 className="text-white font-bold">Versões</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              {artes.map((a) => {
                const u = urls.get(a.path);
                const esc = a.id === semana?.arte_id;
                return (
                  <div key={a.id} className={`rounded-xl p-2 border ${esc ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#222]"}`}>
                    {u && (
                      <a href={u} target="_blank" download>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Agenda da semana" className="w-full rounded-md bg-black" />
                      </a>
                    )}
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="text-white/40">{quando(a.created_at)}</span>
                      {esc ? (
                        <span className="text-emerald-400 font-bold">✓ Escolhida</span>
                      ) : (
                        <form action={escolherSemanaAction}>
                          <input type="hidden" name="semana" value={segunda} />
                          <input type="hidden" name="arte" value={a.id} />
                          <button className={btn2}>Usar esta</button>
                        </form>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {escolhida && (
          <section className={card}>
            <h2 className="text-white font-bold">Instagram</h2>
            {!ig ? (
              <p className="text-yellow-300 text-sm mt-2">
                Instagram não conectado. Conecte em <a href="/admin/marketing" className="underline">Marketing</a>.
              </p>
            ) : (
              <>
                <p className="text-white/40 text-sm mt-1">
                  Post no feed. O collab convida até 3 convidados da semana ({handles.length ? handles.map((h) => `@${h}`).join(", ") : "nenhum com @"}).
                </p>
                {semana && semana.ig_status !== "nenhum" && (
                  <div className="mt-3 text-sm">
                    {semana.ig_status === "agendado" && semana.ig_publicar_em && <p className="text-violet-300">Programado para {quando(semana.ig_publicar_em)}.</p>}
                    {semana.ig_status === "publicando" && <p className="text-sky-400">Publicando...</p>}
                    {semana.ig_status === "erro" && <p className="text-red-400 break-words">Erro: {semana.ig_erro}</p>}
                    {semana.ig_status === "publicado" && (
                      <p className="text-emerald-400">
                        ✓ Publicado {semana.ig_post_url && <a href={semana.ig_post_url} target="_blank" className="underline">ver ↗</a>}
                      </p>
                    )}
                    {(semana.ig_status === "agendado" || semana.ig_status === "erro") && (
                      <form action={semanaResetAction} className="mt-2">
                        <input type="hidden" name="semana" value={segunda} />
                        <button className={btn2}>{semana.ig_status === "erro" ? "Liberar para tentar de novo" : "Cancelar programação"}</button>
                      </form>
                    )}
                  </div>
                )}
                {(!semana || semana.ig_status === "nenhum") && (
                  <ProducaoForm action={semanaInstagramAction} label="Publicar / programar" pending="Publicando..." okMessage="Feito." className="mt-4 space-y-3">
                    <input type="hidden" name="semana" value={segunda} />
                    <label className="flex items-center gap-1.5 text-sm text-white/70">
                      <input type="checkbox" name="collab" value="1" defaultChecked={semana?.ig_collab ?? true} /> Convidar como collab
                    </label>
                    <textarea
                      name="legenda"
                      rows={9}
                      defaultValue={semana?.ig_legenda ?? legendaSemana(itens)}
                      className={`${input} w-full leading-relaxed`}
                    />
                    <label className="block text-white/50 text-xs">
                      Quando (vazio = agora)
                      <input type="datetime-local" name="quando" className={`${input} ml-2`} />
                    </label>
                  </ProducaoForm>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
