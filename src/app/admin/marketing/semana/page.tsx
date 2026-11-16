import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import { EspacoHeader } from "@/components/admin/Espaco";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { db, getConfig } from "@/lib/producao/store";
import {
  getEstado,
  lerNumeros,
  semanaPassada,
  urlDaArte,
  variacao,
  type EstadoNumeros,
  type NumerosSemana,
} from "@/lib/social/numeros-semana";
import {
  IG_TESTES_BLOQUEIO,
  JANELA,
  METAS,
  RITMO,
  isSegunda,
  limitesDaSemana,
  linhaDo,
  segundaDe,
  type LinhaSemana,
} from "@/lib/social/ritmo";
import { PLATFORMS, type SocialPost } from "@/lib/social/store";
import { AUTO_POR_LIVE, HORARIOS, isYoutubeAutoPaused } from "@/lib/social/auto-youtube";
import {
  cancelarNumerosAction,
  devolverTestesAction,
  gerarNumerosAction,
  programarNumerosAction,
  youtubeAutoAction,
} from "./actions";

export const dynamic = "force-dynamic";
// "Publicar agora" sobe a arte para o Instagram dentro da server action.
export const maxDuration = 120;

const DIA = 86_400_000;
const TZ = "America/Sao_Paulo";
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const int = (n: number) => Math.round(n).toLocaleString("pt-BR");
const dataCurta = (t: number) => new Date(t).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** "2026-11-18T12:00" (Brasília) para o input datetime-local. */
function inputLocal(t: number): string {
  return new Date(t - 3 * 3_600_000).toISOString().slice(0, 16);
}

/** Próxima terça às 12h (ou hoje às 12h, se ainda der tempo). */
function proximaTerca12h(now: number): number {
  for (let i = 0; i < 8; i++) {
    const seg = new Date(`${segundaDe(now + i * DIA)}T12:00:00-03:00`).getTime();
    const ter = seg + DIA;
    if (ter > now + 10 * 60_000) return ter;
  }
  return now + DIA;
}

type Post = Pick<
  SocialPost,
  "id" | "platform" | "status" | "trial" | "graduated_at" | "title" | "scheduled_at" | "published_at" | "post_url" | "metrics" | "error"
>;

const COLS = "id,platform,status,trial,graduated_at,title,scheduled_at,published_at,post_url,metrics,error";

function Delta({ v }: { v: number | null }) {
  if (v == null) return null;
  const r = Math.round(v);
  const cls = r > 0 ? "text-emerald-400" : r < 0 ? "text-red-400" : "text-white/40";
  return <span className={`text-xs font-bold ${cls}`}>{r > 0 ? `+${r}` : r}%</span>;
}

export default async function SemanaPage({ searchParams }: { searchParams: { s?: string } }) {
  await requireAdmin();
  const now = Date.now();
  const segunda = isSegunda(searchParams.s) ? searchParams.s : segundaDe(now);
  const { ini, fim } = limitesDaSemana(segunda);
  const iniIso = new Date(ini).toISOString();
  const fimIso = new Date(fim).toISOString();
  const passada = semanaPassada(now);
  const hojeIdx = now >= ini && now < fim ? Math.floor((now - ini) / DIA) : now >= fim ? 7 : -1;

  const [pubRes, abertosRes, futurosRes, recusadosRes, fbErroRes, bloqueioRaw, estado] = await Promise.all([
    db().from("social_posts").select(COLS).eq("status", "publicado").gte("published_at", iniIso).lt("published_at", fimIso).limit(2000),
    db()
      .from("social_posts")
      .select(COLS)
      .in("status", ["agendado", "publicando", "processando", "erro"])
      .gte("scheduled_at", iniIso)
      .lt("scheduled_at", fimIso)
      .limit(2000),
    db().from("social_posts").select("platform", { count: "exact", head: false }).eq("status", "agendado").gte("scheduled_at", new Date(now).toISOString()).limit(2000),
    db()
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("platform", "instagram")
      .eq("status", "erro")
      .ilike("error", "%maximum number of trial reels%"),
    db().from("social_posts").select("error, updated_at").eq("platform", "facebook").eq("status", "erro").order("updated_at", { ascending: false }).limit(1),
    getConfig(IG_TESTES_BLOQUEIO).catch(() => null),
    getEstado(segunda).catch(() => null),
  ]);
  const ytAutoPausado = await isYoutubeAutoPaused().catch(() => false);
  const posts = [...((pubRes.data ?? []) as Post[]), ...((abertosRes.data ?? []) as Post[])];
  const futuros = (futurosRes.data ?? []) as { platform: string }[];
  const recusados = recusadosRes.count ?? 0;
  const { count: fbErros } = await db()
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("platform", "facebook")
    .eq("status", "erro");
  const fbUltimo = (fbErroRes.data?.[0] as { error: string | null } | undefined)?.error ?? null;
  const bloqueio = bloqueioRaw && Date.parse(bloqueioRaw) > now ? bloqueioRaw : null;

  // Números: os do rascunho salvo; sem rascunho, lidos agora do Analytics.
  let numeros: NumerosSemana | null = estado?.numeros ?? null;
  let numerosErro: string | null = null;
  if (!numeros && ini < now) {
    try {
      numeros = await lerNumeros(segunda);
    } catch (e) {
      numerosErro = e instanceof Error ? e.message : String(e);
    }
  }
  const arteUrl = await urlDaArte(estado).catch(() => null);

  /* ---- grade: linha × dia ---- */
  const diaDe = (p: Post) => Math.floor((Date.parse(p.status === "publicado" ? p.published_at ?? p.scheduled_at : p.scheduled_at) - ini) / DIA);
  type Cel = { pub: number; agend: number; erro: number };
  const grade = new Map<LinhaSemana, Cel[]>(METAS.map((m) => [m.key, Array.from({ length: 7 }, () => ({ pub: 0, agend: 0, erro: 0 }))]));
  for (const p of posts) {
    const d = diaDe(p);
    if (d < 0 || d > 6) continue;
    const c = grade.get(linhaDo(p))![d];
    if (p.status === "publicado") c.pub++;
    else if (p.status === "erro") c.erro++;
    else c.agend++;
  }
  const linhas = METAS.filter((m) => m.key !== "tiktok" || grade.get("tiktok")!.some((c) => c.pub + c.agend + c.erro > 0));

  function corCel(c: Cel, meta: number, dia: number): string {
    const passado = dia < hojeIdx;
    if (meta === 0) return "border-[#242424]";
    if (c.pub > meta * 2) return "border-orange-500/50 bg-orange-500/10";
    if (c.pub >= meta) return "border-emerald-500/40 bg-emerald-500/10";
    if (passado) return c.pub === 0 ? "border-red-500/40 bg-red-500/10" : "border-yellow-500/40 bg-yellow-500/10";
    if (c.pub + c.agend >= meta) return "border-violet-500/30 bg-violet-500/5";
    return "border-[#242424]";
  }

  /* ---- Instagram: testes da semana ---- */
  const igPub = posts.filter((p) => p.platform === "instagram" && p.status === "publicado");
  const comViews = igPub.filter((p) => p.metrics?.views != null).sort((a, b) => (b.metrics!.views ?? 0) - (a.metrics!.views ?? 0));
  const vs = comViews.map((p) => p.metrics!.views ?? 0).sort((a, b) => a - b);
  const mediana = vs.length ? vs[Math.floor(vs.length / 2)] : null;

  /* ---- alertas ---- */
  const proximos3 = futuros.length;
  const alertas: { cor: string; texto: React.ReactNode; acao?: React.ReactNode }[] = [];
  if (bloqueio) {
    alertas.push({
      cor: "yellow",
      texto: (
        <>
          A Meta recusou um Reel de teste pelo limite. Os testes estão parados até <b>{quando(bloqueio)}</b>; o resto da fila segue.
        </>
      ),
    });
  }
  if (recusados > 0) {
    alertas.push({
      cor: "red",
      texto: (
        <>
          <b>{recusados}</b> Reels de teste foram recusados pelo limite da Meta e estão parados como erro. Devolver espalha no ritmo
          novo: até {RITMO.instagram.porDia} Reels por dia no Instagram, dos quais até 4 de teste, das {JANELA.inicio}h às {JANELA.fim}h
          (~{Math.ceil(recusados / 4)} dias de fila).
        </>
      ),
      acao: (
        <ProducaoForm
          action={devolverTestesAction}
          label="Devolver à fila"
          pending="Devolvendo…"
          okMessage="Voltaram para a fila."
          buttonClassName="text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/80 rounded-lg px-3 py-1.5"
        />
      ),
    });
  }
  if ((fbErros ?? 0) > 0) {
    alertas.push({
      cor: "red",
      texto: (
        <>
          <b>{fbErros}</b> vídeos do Facebook com erro. Último: <span className="text-white/60">{fbUltimo || "sem mensagem"}</span>. A mensagem
          completa da Meta só aparece nos próximos erros (antes chegava vazia).
        </>
      ),
    });
  }
  const btnAuto = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/80 rounded-lg px-3 py-1.5";
  alertas.push({
    cor: ytAutoPausado ? "yellow" : "violet",
    texto: ytAutoPausado ? (
      <>
        O agendamento automático do YouTube está <b>pausado</b>. Os cortes das lives novas só vão para o canal se forem programados à mão.
      </>
    ) : (
      <>
        <b>YouTube automático:</b> quando os shorts de uma live ficam prontos, a IA escolhe os {AUTO_POR_LIVE} melhores e eles entram
        às {HORARIOS.map((h) => `${h}h`).join(", ")} dos próximos dias livres.
      </>
    ),
    acao: (
      <ProducaoForm
        action={youtubeAutoAction}
        label={ytAutoPausado ? "Retomar" : "Pausar"}
        pending="Salvando…"
        okMessage="Salvo."
        buttonClassName={btnAuto}
      >
        {!ytAutoPausado && <input type="hidden" name="pausar" value="1" />}
      </ProducaoForm>
    ),
  });
  if (proximos3 === 0) {
    alertas.push({
      cor: "yellow",
      texto: (
        <>
          Nada agendado daqui para a frente. Programe cortes em{" "}
          <a href="/admin/marketing?view=programar" className="underline">
            Programar
          </a>
          : a fila espalha no ritmo da semana.
        </>
      ),
    });
  }
  const estadoPassada = segunda === passada ? estado : await getEstado(passada).catch(() => null);
  if (segunda !== passada && (!estadoPassada || estadoPassada.status === "rascunho" || estadoPassada.status === "erro")) {
    alertas.push({
      cor: "yellow",
      texto: (
        <>
          O post <b>Números da semana</b> da semana passada ainda não saiu.{" "}
          <a href={`/admin/marketing/semana?s=${passada}`} className="underline">
            Abrir
          </a>
        </>
      ),
    });
  }

  const tabs = [
    { href: "/admin/marketing/semana", label: "Semana", ativa: true },
    { href: "/admin/marketing", label: "Quadro", ativa: false },
    { href: "/admin/marketing?view=lista", label: "Lista", ativa: false },
    { href: "/admin/marketing?view=testes", label: "Reels de teste", ativa: false },
    { href: "/admin/marketing?view=programar", label: "Programar", ativa: false },
    { href: "/admin/marketing?view=contas", label: "Contas", ativa: false },
  ];
  const semanaHref = (delta: number) => `/admin/marketing/semana?s=${segundaDe(ini + 12 * 3_600_000 + delta * 7 * DIA)}`;
  const box = "bg-[#111] border border-[#1f1f1f] rounded-xl p-4";
  const h2 = "text-white font-bold";

  // Posts da semana por dia, mais recentes primeiro.
  const lista = [...posts].sort(
    (a, b) => Date.parse(b.published_at ?? b.scheduled_at) - Date.parse(a.published_at ?? a.scheduled_at)
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader area="Marketing" titulo="Marketing" abas={tabs} />

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <a href={semanaHref(-1)} className="text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white/70 hover:text-white">
            ← Anterior
          </a>
          <h2 className="text-white font-bold">
            Semana de {dataCurta(ini)} a {dataCurta(fim - DIA)}
          </h2>
          <a href={semanaHref(1)} className="text-sm border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-white/70 hover:text-white">
            Próxima →
          </a>
          {segunda !== segundaDe(now) && (
            <a href="/admin/marketing/semana" className="text-xs text-gold-400 underline">
              Ir para esta semana
            </a>
          )}
        </div>

        {alertas.length > 0 && (
          <div className="space-y-2 mt-4">
            {alertas.map((a, i) => (
              <div
                key={i}
                className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border text-sm ${
                  a.cor === "red"
                    ? "border-red-500/30 bg-red-500/10 text-red-200"
                    : a.cor === "violet"
                      ? "border-violet-500/30 bg-violet-500/5 text-white/80"
                      : "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
                }`}
              >
                <p className="min-w-0 flex-1">{a.texto}</p>
                {a.acao}
              </div>
            ))}
          </div>
        )}

        {/* ---------------- Grade da semana ---------------- */}
        <section className={`${box} mt-4`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className={h2}>Frequência: publicado × meta</h3>
            <p className="text-white/40 text-xs">
              A fila publica das {JANELA.inicio}h às {JANELA.fim}h (Brasília) e segura cada rede no ritmo: YouTube {RITMO.youtube.porDia}/dia,
              Instagram {RITMO.instagram.porDia}/dia (até 4 de teste), Facebook {RITMO.facebook.porDia}/dia.
            </p>
          </div>
          <div className="overflow-x-auto mt-3 -mx-4 px-4">
            <table className="w-full min-w-[760px] text-sm border-separate border-spacing-1">
              <thead>
                <tr className="text-white/40 text-xs">
                  <th className="text-left font-normal">Rede · meta/dia</th>
                  {DIAS.map((d, i) => (
                    <th key={d} className={`font-normal ${i === hojeIdx ? "text-gold-400" : ""}`}>
                      {d} {dataCurta(ini + i * DIA)}
                    </th>
                  ))}
                  <th className="font-normal">Semana</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((m) => {
                  const cels = grade.get(m.key)!;
                  const tot = cels.reduce((s, c) => ({ pub: s.pub + c.pub, agend: s.agend + c.agend, erro: s.erro + c.erro }), { pub: 0, agend: 0, erro: 0 });
                  const metaSem = m.porDia * 7;
                  return (
                    <tr key={m.key}>
                      <td className="text-white/80 whitespace-nowrap pr-2">
                        {m.label} <span className="text-white/35">· {m.porDia}</span>
                      </td>
                      {cels.map((c, i) => (
                        <td key={i} className={`border rounded-lg px-2 py-1.5 text-center align-top ${corCel(c, m.porDia, i)}`}>
                          <div className="text-white font-bold">
                            {c.pub}
                            <span className="text-white/35 font-normal">/{m.porDia}</span>
                          </div>
                          {(c.agend > 0 || c.erro > 0) && (
                            <div className="text-[10px] leading-tight mt-0.5">
                              {c.agend > 0 && <span className="text-violet-300">{c.agend} agend.</span>}
                              {c.agend > 0 && c.erro > 0 && " · "}
                              {c.erro > 0 && <span className="text-red-400">{c.erro} erro</span>}
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="border border-[#242424] rounded-lg px-2 py-1.5 text-center">
                        <div className="text-white font-bold">
                          {tot.pub}
                          <span className="text-white/35 font-normal">/{metaSem}</span>
                        </div>
                        {tot.erro > 0 && <div className="text-[10px] text-red-400">{tot.erro} erro</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-white/35 text-[11px] mt-2">
            Verde: bateu a meta · amarelo: abaixo · vermelho: dia passou sem post · laranja: mais que o dobro da meta (rajada) · roxo: o
            agendado completa a meta.
          </p>
        </section>

        <div className="grid lg:grid-cols-2 gap-4 mt-4">
          {/* ---------------- Performance do YouTube ---------------- */}
          <section className={box}>
            <h3 className={h2}>YouTube na semana</h3>
            {numeros ? (
              <>
                {numeros.parcial && (
                  <p className="text-yellow-300/80 text-xs mt-1">
                    Parcial: o YouTube Analytics leva ~2 dias para fechar cada dia.
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {[
                    { l: "Views", v: int(numeros.atual.views), d: variacao(numeros.atual.views, numeros.anterior.views) },
                    { l: "Horas assistidas", v: int(numeros.atual.horas), d: variacao(numeros.atual.horas, numeros.anterior.horas) },
                    {
                      l: "Inscritos (líquido)",
                      v: `${numeros.atual.ganhos - numeros.atual.perdidos >= 0 ? "+" : ""}${int(numeros.atual.ganhos - numeros.atual.perdidos)}`,
                      d: variacao(numeros.atual.ganhos - numeros.atual.perdidos, numeros.anterior.ganhos - numeros.anterior.perdidos),
                    },
                    { l: "Curtidas", v: int(numeros.atual.likes), d: variacao(numeros.atual.likes, numeros.anterior.likes) },
                    { l: "Compartilhamentos", v: int(numeros.atual.shares), d: variacao(numeros.atual.shares, numeros.anterior.shares) },
                    { l: "Views de Shorts", v: numeros.shortsPct != null ? `${Math.round(numeros.shortsPct)}%` : "—", d: null },
                  ].map((k) => (
                    <div key={k.l} className="bg-[#161616] border border-[#242424] rounded-lg p-3">
                      <p className="text-white/45 text-[11px]">{k.l}</p>
                      <p className="text-white text-lg font-bold">
                        {k.v} <Delta v={k.d} />
                      </p>
                    </div>
                  ))}
                </div>
                <p className="text-white/35 text-[11px] mt-1">Comparado com a semana anterior.</p>
                {numeros.top.length > 0 && (
                  <ol className="mt-3 space-y-1">
                    {numeros.top.map((v, i) => (
                      <li key={v.id} className="flex items-baseline gap-2 text-sm">
                        <span className="text-white/35 w-4">{i + 1}.</span>
                        <a href={`https://youtu.be/${v.id}`} target="_blank" rel="noreferrer" className="text-white/85 hover:text-white truncate flex-1">
                          {v.titulo}
                        </a>
                        <span className="text-white/60 tabular-nums">{int(v.views)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            ) : (
              <p className="text-white/45 text-sm mt-2">{numerosErro ?? "A semana ainda não começou."}</p>
            )}
          </section>

          {/* ---------------- Instagram ---------------- */}
          <section className={box}>
            <h3 className={h2}>Instagram na semana</h3>
            <p className="text-white/45 text-xs mt-1">
              {igPub.length} Reels publicados · {comViews.length} com métrica
              {mediana != null && <> · mediana de {int(mediana)} views</>}
            </p>
            {comViews.length > 0 ? (
              <ol className="mt-3 space-y-1">
                {comViews.slice(0, 6).map((p, i) => (
                  <li key={p.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-white/35 w-4">{i + 1}.</span>
                    <a href={p.post_url ?? "#"} target="_blank" rel="noreferrer" className="text-white/85 hover:text-white truncate flex-1">
                      {p.title}
                    </a>
                    {p.trial && !p.graduated_at && mediana != null && (p.metrics?.views ?? 0) >= mediana * 3 && (
                      <span className="text-[10px] font-bold px-1.5 rounded border border-gold-500/40 text-gold-400">promover</span>
                    )}
                    <span className="text-white/60 tabular-nums">{int(p.metrics?.views ?? 0)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-white/45 text-sm mt-2">Sem métricas nesta semana.</p>
            )}
            <p className="text-white/35 text-[11px] mt-2">
              &quot;Promover&quot; = teste com 3× a mediana da semana. A promoção é feita no app; depois marque em{" "}
              <a href="/admin/marketing?view=testes" className="underline">
                Reels de teste
              </a>
              .
            </p>
          </section>
        </div>

        {/* ---------------- Números da semana (post) ---------------- */}
        <NumerosBox segunda={segunda} estado={estado} arteUrl={arteUrl} podeGerar={ini < now} now={now} />

        {/* ---------------- Lista da semana ---------------- */}
        <section className={`${box} mt-4`}>
          <h3 className={h2}>Posts da semana ({lista.length})</h3>
          {lista.length === 0 ? (
            <p className="text-white/45 text-sm mt-2">Nada publicado ou agendado nesta semana.</p>
          ) : (
            <div className="overflow-x-auto mt-2 -mx-4 px-4">
              <table className="w-full min-w-[640px] text-sm">
                <tbody>
                  {lista.map((p) => {
                    const t = p.published_at ?? p.scheduled_at;
                    return (
                      <tr key={p.id} className="border-t border-[#1f1f1f]">
                        <td className="py-1.5 pr-3 text-white/45 whitespace-nowrap">
                          {DIAS[Math.min(6, Math.max(0, diaDe(p)))]} {hora(t)}
                        </td>
                        <td className="py-1.5 pr-3 text-white/70 whitespace-nowrap">
                          {PLATFORMS[p.platform].label}
                          {p.trial && !p.graduated_at ? " · teste" : ""}
                        </td>
                        <td className="py-1.5 pr-3 text-white/85 max-w-[420px] truncate" title={p.error ?? undefined}>
                          {p.post_url ? (
                            <a href={p.post_url} target="_blank" rel="noreferrer" className="hover:text-white">
                              {p.title}
                            </a>
                          ) : (
                            p.title
                          )}
                        </td>
                        <td className="py-1.5 pr-3 whitespace-nowrap">
                          <span
                            className={
                              p.status === "publicado" ? "text-emerald-400" : p.status === "erro" ? "text-red-400" : "text-violet-300"
                            }
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-white/60 tabular-nums">
                          {p.metrics?.views != null ? `${int(p.metrics.views)} views` : ""}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function NumerosBox({
  segunda,
  estado,
  arteUrl,
  podeGerar,
  now,
}: {
  segunda: string;
  estado: EstadoNumeros | null;
  arteUrl: string | null;
  podeGerar: boolean;
  now: number;
}) {
  const box = "bg-[#111] border border-gold-500/20 rounded-xl p-4 mt-4";
  const btn = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/80 rounded-lg px-3 py-1.5";
  const travado = estado && ["agendado", "publicando", "publicado"].includes(estado.status);
  const STATUS: Record<EstadoNumeros["status"], string> = {
    rascunho: "Rascunho: revise e programe",
    agendado: "Agendado",
    publicando: "Publicando",
    publicado: "Publicado",
    erro: "Erro",
  };

  return (
    <section className={box}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-white font-bold">Post &quot;Números da semana&quot;</h3>
        {estado && <span className="text-xs text-gold-400">{STATUS[estado.status]}</span>}
      </div>
      <p className="text-white/45 text-xs mt-1">
        Um post por semana mostrando a performance do canal. Toda terça às 10h o rascunho da semana anterior é gerado sozinho
        aqui; nada vai ao ar sem alguém programar. Sugestão: terça às 12h no feed do Instagram.
      </p>

      {estado?.erro && <p className="text-red-400 text-xs mt-2 break-words">{estado.erro}</p>}
      {estado?.status === "agendado" && estado.publicar_em && (
        <p className="text-violet-300 text-sm mt-2">Sai {quando(estado.publicar_em)} no Instagram.</p>
      )}
      {estado?.post_url && (
        <a href={estado.post_url} target="_blank" rel="noreferrer" className="text-emerald-400 text-sm underline mt-2 inline-block">
          Ver no Instagram ↗
        </a>
      )}

      {!estado?.arte_path ? (
        podeGerar ? (
          <ProducaoForm action={gerarNumerosAction} label="Gerar arte e legenda" pending="Lendo o Analytics e gerando…" className="mt-3">
            <input type="hidden" name="segunda" value={segunda} />
          </ProducaoForm>
        ) : (
          <p className="text-white/45 text-sm mt-3">A semana ainda não começou.</p>
        )
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-4 mt-3">
          <div>
            {arteUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={arteUrl} alt="Arte dos números da semana" className="w-full rounded-lg border border-[#242424]" />
            ) : (
              <p className="text-white/45 text-sm">Arte indisponível.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {arteUrl && (
                <a href={arteUrl} download={`numeros-${segunda}.jpg`} target="_blank" rel="noreferrer" className={btn}>
                  Baixar arte
                </a>
              )}
              {!travado && (
                <ProducaoForm action={gerarNumerosAction} label="Atualizar números" pending="Gerando…" buttonClassName={btn}>
                  <input type="hidden" name="segunda" value={segunda} />
                  <input type="hidden" name="manter" value="1" />
                </ProducaoForm>
              )}
            </div>
          </div>
          <div className="min-w-0">
            {travado ? (
              <>
                <pre className="whitespace-pre-wrap text-sm text-white/80 bg-[#161616] border border-[#242424] rounded-lg p-3">{estado!.legenda}</pre>
                <div className="flex flex-wrap gap-2 mt-2">
                  <CopyButton value={estado!.legenda} label="Copiar legenda" />
                  {estado!.status === "agendado" && (
                    <ProducaoForm action={cancelarNumerosAction} label="Cancelar agendamento" pending="Cancelando…" buttonClassName={btn}>
                      <input type="hidden" name="segunda" value={segunda} />
                    </ProducaoForm>
                  )}
                </div>
              </>
            ) : (
              <ProducaoForm action={programarNumerosAction} label="Confirmar" pending="Enviando…" okMessage="Feito.">
                <input type="hidden" name="segunda" value={segunda} />
                <textarea
                  name="legenda"
                  defaultValue={estado!.legenda}
                  rows={14}
                  maxLength={2200}
                  className="w-full bg-[#161616] border border-[#2a2a2a] rounded-lg p-3 text-sm text-white/90"
                />
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 my-3 text-sm text-white/80">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="modo" value="programar" defaultChecked className="accent-gold-500" />
                    Programar para
                    <input
                      type="datetime-local"
                      name="quando"
                      defaultValue={inputLocal(proximaTerca12h(now))}
                      className="bg-[#161616] border border-[#2a2a2a] rounded px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="modo" value="agora" className="accent-gold-500" />
                    Publicar agora
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="modo" value="salvar" className="accent-gold-500" />
                    Só salvar a legenda
                  </label>
                </div>
              </ProducaoForm>
            )}
            <p className="text-white/35 text-[11px] mt-2">
              Sai no feed do Instagram. Para o YouTube, use a mesma arte num post da comunidade (a API do YouTube não publica lá).
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
