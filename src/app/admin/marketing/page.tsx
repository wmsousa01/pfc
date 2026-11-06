import AdminHeader from "@/components/admin/AdminHeader";
import { Coluna, EspacoHeader, GrupoColuna, Quadro, diaKey, diaLabel, porDia, selo } from "@/components/admin/Espaco";
import CardAcoes from "@/components/admin/CardAcoes";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import {
  contentaJobUrl,
  isContentaConfigured,
  listContentaJobs,
  listJobCuts,
  type ContentaCut,
  type ContentaJob,
} from "@/lib/producao/contenta";
import { db } from "@/lib/producao/store";
import { connectedChannel } from "@/lib/producao/youtube-api";
import { defaultCaption } from "@/lib/social/caption";
import { isCryptoConfigured } from "@/lib/social/crypto";
import { isMetaConfigured } from "@/lib/social/meta";
import { IG_COLLAB_FAVORITOS, IG_DAILY_MAX } from "@/lib/social/publisher";
import { PLATFORMS, listConnections, type Platform, type PostStatus, type SocialPost } from "@/lib/social/store";
import {
  cancelPostAction,
  disconnectMetaAction,
  graduatePostAction,
  retryPostAction,
  runQueueAction,
  scheduleCutAction,
  scheduleJobAction,
} from "./actions";

export const dynamic = "force-dynamic";
// "Publicar agora" e "Rodar fila" publicam dentro da server action.
export const maxDuration = 300;

const STATUS: Record<PostStatus, { label: string; cls: string }> = {
  agendado: { label: "Agendado", cls: "bg-violet-500/10 border-violet-500/30 text-violet-300" },
  publicando: { label: "Publicando", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  processando: { label: "Processando na rede", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  publicado: { label: "Publicado", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  erro: { label: "Erro", cls: "bg-red-500/10 border-red-500/30 text-red-400" },
  cancelado: { label: "Cancelado", cls: "bg-white/5 border-white/10 text-white/30" },
};

const REDE_CLS: Record<Platform, string> = {
  youtube: "border-red-500/30 bg-red-500/10 text-red-300",
  instagram: "border-pink-500/30 bg-pink-500/10 text-pink-300",
  facebook: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  tiktok: "border-white/20 bg-white/5 text-white/70",
};

const VIEWS = ["quadro", "lista", "testes", "programar", "contas"] as const;
type View = (typeof VIEWS)[number];

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const card = "bg-[#111] border border-[#222] rounded-2xl p-5";
const chip = selo;

const TZ = "America/Sao_Paulo";

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function hora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

function minutos(sec: number | null): string {
  if (!sec) return "";
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

/** Amanhã às 18h em Brasília, no formato do datetime-local. */
function amanha18h(): string {
  const d = new Date(Date.now() - 3 * 3_600_000 + 86_400_000);
  return `${d.toISOString().slice(0, 10)}T18:00`;
}

function num(n: number | undefined): string {
  if (n === undefined) return "—";
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(".", ",")} mil` : String(n);
}

function horasDesde(iso: string | null): number {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000) : 0;
}

function quem(actor: string | null): string {
  if (!actor) return "automação";
  return actor.includes("@") ? actor.split("@")[0] : actor;
}

/** A data que importa: quando saiu, se já saiu; senão, quando vai sair. */
function dataDo(p: SocialPost): string | null {
  return p.status === "publicado" ? p.published_at : p.scheduled_at;
}

const agruparPorDia = (posts: SocialPost[]) => porDia(posts, dataDo);

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: { job?: string; ok?: string; erro?: string; view?: string; rede?: string; q?: string };
}) {
  await requireAdmin();

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const [channel, connections, postsRes] = await Promise.all([
    connectedChannel().catch(() => null),
    listConnections().catch(() => null),
    db()
      .from("social_posts")
      .select("*")
      .or(`status.not.in.(publicado,cancelado),updated_at.gte.${since}`)
      .order("scheduled_at", { ascending: true })
      .limit(200),
  ]);
  const schemaMissing = connections === null || !!postsRes.error;
  const posts = (postsRes.data ?? []) as SocialPost[];

  const jobId = searchParams.job && /^job_\d{13,16}$/.test(searchParams.job) ? searchParams.job : null;
  const view: View = VIEWS.includes(searchParams.view as View)
    ? (searchParams.view as View)
    : jobId
      ? "programar"
      : "quadro";
  const rede = searchParams.rede && searchParams.rede in PLATFORMS ? (searchParams.rede as Platform) : null;
  const q = (searchParams.q ?? "").trim().slice(0, 100);

  // O Contenta só é consultado na aba em que aparece.
  let jobs: ContentaJob[] = [];
  let jobsError: string | null = null;
  if (view === "programar" && isContentaConfigured()) {
    try {
      jobs = (await listContentaJobs())
        .filter((j) => j.status === "done" && j.totalCuts > 0)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 12);
    } catch (e) {
      jobsError = e instanceof Error ? e.message : String(e);
    }
  }

  let cuts: ContentaCut[] = [];
  let cutsError: string | null = null;
  if (view === "programar" && jobId) {
    try {
      cuts = (await listJobCuts(jobId)).items;
    } catch (e) {
      cutsError = e instanceof Error ? e.message : String(e);
    }
  }

  const ig = connections?.find((c) => c.platform === "instagram" && c.status === "ativa");
  const fb = connections?.find((c) => c.platform === "facebook" && c.status === "ativa");
  const metaRevoked = !ig && !fb && connections?.some((c) => (c.platform === "instagram" || c.platform === "facebook") && c.status === "revogada");

  const connected: Record<Platform, boolean> = { youtube: !!channel, instagram: !!ig, facebook: !!fb, tiktok: false };
  const ready = (Object.keys(PLATFORMS) as Platform[]).filter((p) => PLATFORMS[p].ready);

  const filtrados = posts.filter(
    (p) => (!rede || p.platform === rede) && (!q || p.title.toLowerCase().includes(q.toLowerCase()))
  );
  const fila = posts.filter((p) => p.status !== "publicado" && p.status !== "cancelado");
  const postsOfCut = (file: string) => posts.filter((p) => p.contenta_job_id === jobId && p.cut_file === file);
  // Mais views primeiro; empate decide quem foi mais compartilhado e salvo.
  const testes = posts
    .filter((p) => p.platform === "instagram" && p.trial && p.status === "publicado" && !p.graduated_at)
    .sort(
      (a, b) =>
        (b.metrics?.views ?? -1) - (a.metrics?.views ?? -1) ||
        (b.metrics?.shares ?? 0) + (b.metrics?.saved ?? 0) - ((a.metrics?.shares ?? 0) + (a.metrics?.saved ?? 0))
    );
  const metricsErro = testes.find((p) => p.metrics?.erro)?.metrics?.erro;
  const erros = fila.filter((p) => p.status === "erro").length;

  const COLUNAS: { key: string; titulo: string; vazio: string; posts: SocialPost[]; porDia?: boolean }[] = [
    {
      key: "agendado",
      titulo: "Agendados",
      vazio: "Nada agendado. Programe cortes na aba Programar.",
      posts: filtrados.filter((p) => p.status === "agendado"),
      porDia: true,
    },
    {
      key: "andamento",
      titulo: "Em andamento",
      vazio: "Nenhum post subindo agora.",
      posts: filtrados.filter((p) => p.status === "publicando" || p.status === "processando"),
    },
    {
      key: "erro",
      titulo: "Com erro",
      vazio: "Nenhum erro.",
      posts: filtrados.filter((p) => p.status === "erro"),
    },
    {
      key: "publicado",
      titulo: "Publicados · 14 dias",
      vazio: "Nada publicado nos últimos 14 dias.",
      posts: filtrados
        .filter((p) => p.status === "publicado")
        .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")),
      porDia: true,
    },
  ];

  // Lista: de hoje em diante em ordem de saída; depois o passado, do mais recente para trás.
  const hojeKey = diaKey(new Date().toISOString());
  const lista = [...filtrados].sort((a, b) => {
    const da = dataDo(a) ?? "";
    const dbb = dataDo(b) ?? "";
    const fa = diaKey(da) >= hojeKey;
    const fbb = diaKey(dbb) >= hojeKey;
    if (fa !== fbb) return fa ? -1 : 1;
    return fa ? da.localeCompare(dbb) : dbb.localeCompare(da);
  });

  const href = (over: { view?: View; rede?: Platform | null; q?: string; job?: string | null }) => {
    const u = new URLSearchParams();
    const v = over.view ?? view;
    if (v !== "quadro") u.set("view", v);
    const r = over.rede === undefined ? rede : over.rede;
    if (r) u.set("rede", r);
    const qq = over.q ?? q;
    if (qq) u.set("q", qq);
    const j = over.job === undefined ? (v === "programar" ? jobId : null) : over.job;
    if (j) u.set("job", j);
    const s = u.toString();
    return `/admin/marketing${s ? `?${s}` : ""}`;
  };

  // Um seletor só: "Reel de teste" sem o Instagram marcado não existe.
  const InstagramMode = () => (
    <label className={`flex items-center gap-1.5 text-xs ${connected.instagram ? "text-white/80" : "text-white/30"}`}>
      Instagram
      <select name="ig" defaultValue={connected.instagram ? "teste" : "off"} disabled={!connected.instagram} className={input}>
        <option value="teste">Reel de teste (só não seguidores)</option>
        <option value="normal">Reel normal</option>
        <option value="off">Não publicar</option>
      </select>
    </label>
  );

  // Collab no Instagram: o perfil recebe o convite e, aceitando no app, o Reel aparece nos dois.
  const CollabFields = () => (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${connected.instagram ? "text-white/80" : "text-white/30"}`}>
      <span>Collab</span>
      {IG_COLLAB_FAVORITOS.map((u) => (
        <label key={u} className="flex items-center gap-1.5">
          <input type="checkbox" name="collab" value={u} disabled={!connected.instagram} className="accent-gold-500" />@{u}
        </label>
      ))}
      <input
        name="collab_extra"
        placeholder="outros perfis (até 3 no total)"
        disabled={!connected.instagram}
        className={`${input} w-56`}
      />
    </div>
  );

  const Badge = ({ s }: { s: PostStatus }) => <span className={`${chip} ${STATUS[s].cls}`}>{STATUS[s].label}</span>;

  const Rede = ({ p }: { p: Platform }) => <span className={`${chip} ${REDE_CLS[p]}`}>{PLATFORMS[p].label}</span>;

  const Extras = ({ p }: { p: SocialPost }) => (
    <>
      {p.trial && (
        <span className={`${chip} border-gold-500/30 bg-gold-500/10 text-gold-400`}>
          {p.graduated_at ? "Teste promovido" : "Teste"}
        </span>
      )}
      {p.collaborators?.length > 0 && (
        <span
          className={`${chip} ${
            p.collab_dropped
              ? "border-red-500/30 bg-red-500/10 text-red-300 line-through"
              : "border-sky-500/30 bg-sky-500/10 text-sky-300"
          }`}
          title={p.collab_dropped ? "O Instagram não aceitou collab neste reel de teste: saiu sem o convite." : undefined}
        >
          Collab {p.collaborators.map((u) => `@${u}`).join(" ")}
        </span>
      )}
    </>
  );

  const Acoes = ({ p }: { p: SocialPost }) => (
    <>
      {p.post_url && (
        <a href={p.post_url} target="_blank" className="text-gold-500 hover:text-gold-400 text-xs">
          Ver ↗
        </a>
      )}
      {p.status === "erro" && (
        <form action={retryPostAction}>
          <input type="hidden" name="id" value={p.id} />
          <button className="text-xs text-white/60 hover:text-white">Tentar de novo</button>
        </form>
      )}
      {(p.status === "agendado" || p.status === "erro") && (
        <form action={cancelPostAction}>
          <input type="hidden" name="id" value={p.id} />
          <button className="text-xs text-white/40 hover:text-red-400">Cancelar</button>
        </form>
      )}
    </>
  );

  const PostCard = ({ p }: { p: SocialPost }) => (
    <div className="bg-[#161616] border border-[#242424] hover:border-[#333] rounded-lg p-3 transition-colors">
      <div className="flex gap-2.5">
        <p className="text-white text-[13px] font-medium leading-snug line-clamp-2 flex-1 min-w-0">{p.title}</p>
        {p.thumb_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.thumb_url} alt="" className="w-8 aspect-[9/16] object-cover rounded shrink-0 bg-black" />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        <Rede p={p.platform} />
        <Extras p={p} />
      </div>
      {p.error && <p className="text-red-400/80 text-[11px] mt-2 break-words line-clamp-3" title={p.error}>{p.error}</p>}
      <div className="flex items-center justify-between gap-2 mt-2.5">
        <span className="text-white/40 text-[11px]">
          {hora(dataDo(p))} · {quem(p.created_by)}
          {p.attempts > 0 && p.status !== "publicado" ? ` · ${p.attempts}ª tentativa` : ""}
        </span>
        {(p.post_url || p.status === "erro" || p.status === "agendado") && (
          <CardAcoes
            titulo={p.title}
            detalhe={`${PLATFORMS[p.platform].label} · ${STATUS[p.status].label} · ${quando(dataDo(p))} · ${quem(p.created_by)}`}
          >
            <Acoes p={p} />
          </CardAcoes>
        )}
      </div>
    </div>
  );

  const PlatformBoxes = ({ prefix }: { prefix: string }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {ready.filter((p) => p !== "instagram").map((p) => (
        <label key={p} className={`flex items-center gap-1.5 text-xs ${connected[p] ? "text-white/80" : "text-white/30"}`}>
          <input
            type="checkbox"
            name="platforms"
            value={p}
            defaultChecked={connected[p]}
            disabled={!connected[p]}
            id={`${prefix}-${p}`}
            className="accent-gold-500"
          />
          {PLATFORMS[p].label}
        </label>
      ))}
    </div>
  );

  const TABS: { v: View; label: string; count?: number; alerta?: boolean }[] = [
    { v: "quadro", label: "Quadro", count: erros || undefined, alerta: erros > 0 },
    { v: "lista", label: "Lista" },
    { v: "testes", label: "Reels de teste", count: testes.length || undefined },
    { v: "programar", label: "Programar" },
    { v: "contas", label: "Contas", alerta: !connected.youtube || !connected.instagram || !connected.facebook },
  ];

  const ContaChip = ({ p }: { p: Platform }) => (
    <a
      href={href({ view: "contas" })}
      className={`text-[11px] px-2 py-1 rounded-md border ${
        connected[p] ? "border-emerald-500/25 text-emerald-300/90" : "border-[#2a2a2a] text-white/35"
      }`}
    >
      {connected[p] ? "●" : "○"} {PLATFORMS[p].label}
    </a>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Marketing"
          titulo="Marketing"
          extra={
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PLATFORMS) as Platform[]).map((p) => (
                <ContaChip key={p} p={p} />
              ))}
            </div>
          }
          acoes={
            <>
              <span className="text-white/35 text-xs hidden md:inline">A fila publica sozinha a cada 5 min</span>
              <ProducaoForm
                action={runQueueAction}
                label="Rodar fila agora"
                pending="Publicando…"
                okMessage="Fila processada."
                buttonClassName="text-sm border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5"
              />
            </>
          }
          abas={TABS.map((t) => ({ href: href({ view: t.v }), label: t.label, ativa: view === t.v, count: t.count, alerta: t.alerta }))}
        />

        <div className="space-y-3 mt-4">
          {searchParams.ok && (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
              {searchParams.ok}
            </div>
          )}
          {searchParams.erro && (
            <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm break-words">
              {searchParams.erro}
            </div>
          )}
          {schemaMissing && (
            <div className="p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm">
              Tabelas de marketing não encontradas — rode <code>supabase/013_social.sql</code> e{" "}
              <code>supabase/014_social_cron.sql</code> no Supabase.
            </div>
          )}
        </div>

        {/* Barra de filtros (Quadro e Lista) */}
        {(view === "quadro" || view === "lista") && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <form action="/admin/marketing" className="flex items-center w-full sm:w-auto">
              {view !== "quadro" && <input type="hidden" name="view" value={view} />}
              {rede && <input type="hidden" name="rede" value={rede} />}
              <input
                name="q"
                defaultValue={q}
                placeholder="Pesquisar cortes"
                className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/50 w-full sm:w-56 h-10 sm:h-auto"
              />
            </form>
            <a
              href={href({ rede: null })}
              className={`text-xs px-3 py-1.5 rounded-lg border ${
                !rede ? "border-gold-500/60 bg-gold-500/10 text-gold-400" : "border-[#2a2a2a] text-white/60 hover:text-white"
              }`}
            >
              Todas as redes
            </a>
            {ready.map((p) => (
              <a
                key={p}
                href={href({ rede: rede === p ? null : p })}
                className={`text-xs px-3 py-1.5 rounded-lg border ${
                  rede === p
                    ? "border-gold-500/60 bg-gold-500/10 text-gold-400"
                    : "border-[#2a2a2a] text-white/60 hover:text-white"
                }`}
              >
                {PLATFORMS[p].label}
              </a>
            ))}
            {(rede || q) && (
              <a href={href({ rede: null, q: "" })} className="text-xs text-white/40 hover:text-white ml-1">
                Limpar filtros
              </a>
            )}
            <span className="text-white/30 text-xs ml-auto">{filtrados.length} posts</span>
          </div>
        )}

        {/* Quadro */}
        {view === "quadro" && (
          <Quadro colunas={COLUNAS.map((c) => ({ titulo: c.titulo, count: c.posts.length, alerta: c.key === "erro" }))}>
            {COLUNAS.map((col) => (
              <Coluna key={col.key} titulo={col.titulo} count={col.posts.length} alerta={col.key === "erro"} vazio={col.vazio}>
                {col.porDia
                  ? agruparPorDia(col.posts).map(([dia, ps]) => (
                      <div key={dia} className="space-y-2">
                        <GrupoColuna label={diaLabel(dia)} count={ps.length} />
                        {ps.map((p) => (
                          <PostCard key={p.id} p={p} />
                        ))}
                      </div>
                    ))
                  : col.posts.map((p) => <PostCard key={p.id} p={p} />)}
              </Coluna>
            ))}
          </Quadro>
        )}

        {/* Lista */}
        {view === "lista" && (
          <div className="mt-4 bg-[#0f0f0f] border border-[#1c1c1c] rounded-xl overflow-x-auto">
            {lista.length === 0 ? (
              <p className="text-white/40 text-sm p-5">Nenhum post com esses filtros.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-white/40 text-left border-b border-[#1c1c1c]">
                    <th className="font-normal py-2.5 px-3">Corte</th>
                    <th className="font-normal py-2.5 px-3">Rede</th>
                    <th className="font-normal py-2.5 px-3">Status</th>
                    <th className="font-normal py-2.5 px-3">Quando</th>
                    <th className="font-normal py-2.5 px-3">Por</th>
                    <th className="py-2.5 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {agruparPorDia(lista).map(([dia, ps]) => [
                    <tr key={`d-${dia}`} className="bg-[#131313]">
                      <td colSpan={6} className="px-3 py-1.5 text-[11px] font-bold text-white/50 capitalize">
                        {diaLabel(dia)} <span className="text-white/25 font-normal">· {ps.length}</span>
                      </td>
                    </tr>,
                    ...ps.map((p) => (
                      <tr key={p.id} className="border-t border-[#1a1a1a] hover:bg-white/[0.02] align-top">
                        <td className="py-2 px-3 min-w-[280px]">
                          <div className="flex items-start gap-2.5">
                            {p.thumb_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.thumb_url} alt="" className="w-7 aspect-[9/16] object-cover rounded shrink-0 bg-black" />
                            )}
                            <div className="min-w-0">
                              <p className="text-white font-medium line-clamp-1">{p.title}</p>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                <Extras p={p} />
                              </div>
                              {p.error && <p className="text-red-400/80 mt-1 break-words line-clamp-2">{p.error}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <Rede p={p.platform} />
                        </td>
                        <td className="py-2 px-3">
                          <Badge s={p.status} />
                        </td>
                        <td className="py-2 px-3 text-white/60 whitespace-nowrap">{hora(dataDo(p))}</td>
                        <td className="py-2 px-3 text-white/50 whitespace-nowrap">{quem(p.created_by)}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center justify-end gap-3 whitespace-nowrap">
                            <Acoes p={p} />
                          </div>
                        </td>
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Reels de teste */}
        {view === "testes" && (
          <section className="mt-4">
            <p className="text-white/40 text-xs mb-3 max-w-3xl">
              Só não seguidores viram estes Reels. Compare depois de 24–72 h e promova os melhores no app do Instagram
              (Reel → ⋯ → Compartilhar com seguidores); depois marque aqui. Métricas atualizam a cada hora por 7 dias.
            </p>
            {metricsErro && (
              <p className="text-yellow-300 text-xs mb-3 break-words">
                A Meta não liberou as métricas ({metricsErro}). Adicione <code>instagram_manage_insights</code> na
                configuração do Login for Business e clique em Reconectar.
              </p>
            )}
            {testes.length === 0 ? (
              <p className={`${card} text-white/40 text-sm`}>Nenhum Reel de teste aguardando decisão.</p>
            ) : (
              <div className={`${card} overflow-x-auto`}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 text-left">
                      <th className="font-normal pb-2 pr-3">#</th>
                      <th className="font-normal pb-2 pr-3">Corte</th>
                      <th className="font-normal pb-2 pr-3 text-right">Views</th>
                      <th className="font-normal pb-2 pr-3 text-right">Alcance</th>
                      <th className="font-normal pb-2 pr-3 text-right">Assistido</th>
                      <th className="font-normal pb-2 pr-3 text-right">Compart.</th>
                      <th className="font-normal pb-2 pr-3 text-right">Salvos</th>
                      <th className="font-normal pb-2 pr-3 text-right">Curtidas</th>
                      <th className="font-normal pb-2 pr-3 text-right">Coment.</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {testes.map((p, i) => {
                      const m = p.metrics ?? {};
                      const h = horasDesde(p.published_at);
                      return (
                        <tr key={p.id} className="border-t border-[#1c1c1c] text-white/80">
                          <td className="py-2.5 pr-3 text-white/40">{i + 1}</td>
                          <td className="py-2.5 pr-3 min-w-[220px]">
                            <div className="flex items-center gap-2.5">
                              {p.thumb_url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.thumb_url} alt="" className="w-8 aspect-[9/16] object-cover rounded shrink-0 bg-black" />
                              )}
                              <div className="min-w-0">
                                <p className="text-white font-semibold line-clamp-1">{p.title}</p>
                                <p className="text-white/40">
                                  há {h < 48 ? `${h} h` : `${Math.floor(h / 24)} dias`}
                                  {h < 24 && " · cedo para comparar"}
                                  {!p.metrics_at && " · sem métricas ainda"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-white">{num(m.views)}</td>
                          <td className="py-2.5 pr-3 text-right">{num(m.reach)}</td>
                          <td className="py-2.5 pr-3 text-right">
                            {m.ig_reels_avg_watch_time !== undefined ? `${(m.ig_reels_avg_watch_time / 1000).toFixed(1)} s` : "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-right">{num(m.shares)}</td>
                          <td className="py-2.5 pr-3 text-right">{num(m.saved)}</td>
                          <td className="py-2.5 pr-3 text-right">{num(m.likes)}</td>
                          <td className="py-2.5 pr-3 text-right">{num(m.comments)}</td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            {p.post_url && (
                              <a href={p.post_url} target="_blank" className="text-gold-500 hover:text-gold-400 mr-3">
                                Abrir ↗
                              </a>
                            )}
                            <form action={graduatePostAction} className="inline">
                              <input type="hidden" name="id" value={p.id} />
                              <button className="text-white/60 hover:text-emerald-400">Já promovi</button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* Programar */}
        {view === "programar" && (
          <section className="mt-4">
            <p className="text-white/40 text-xs mb-3">Escolha um job do Contenta para programar os cortes.</p>
            {!isContentaConfigured() ? (
              <p className="text-yellow-300 text-sm">Falta CONTENTA_HUB_SECRET na Vercel.</p>
            ) : jobsError ? (
              <p className="text-red-400 text-sm">{jobsError}</p>
            ) : (
              <div className="flex flex-wrap gap-2 mb-5">
                {jobs.length === 0 && <p className="text-white/40 text-sm">Nenhum job pronto no Contenta.</p>}
                {jobs.map((j) => (
                  <a
                    key={j.jobId}
                    href={href({ view: "programar", job: j.jobId })}
                    className={`text-xs px-3 py-1.5 rounded-lg border ${
                      j.jobId === jobId
                        ? "border-gold-500/60 bg-gold-500/10 text-gold-400"
                        : "border-[#2a2a2a] text-white/60 hover:text-white hover:border-[#3a3a3a]"
                    }`}
                  >
                    {quando(j.createdAt)} · {j.totalCuts} cortes
                  </a>
                ))}
              </div>
            )}

            {jobId && (
              <div className="space-y-4">
                {cutsError && <p className="text-red-400 text-sm">{cutsError}</p>}

                {cuts.length > 0 && (
                  <div className={card}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-white font-bold">Distribuir todos os {cuts.length} cortes</h3>
                      <a href={contentaJobUrl(jobId)} target="_blank" className="text-xs text-white/40 hover:text-white">
                        Abrir no Contenta ↗
                      </a>
                    </div>
                    <p className="text-white/40 text-xs mt-1">
                      Um corte por horário, nas redes marcadas, com a legenda padrão. Corte que já está numa rede é pulado.
                      Com o Instagram, no máximo {IG_DAILY_MAX} Reels por dia (intervalo mínimo de {24 / IG_DAILY_MAX} h).
                    </p>
                    <ProducaoForm
                      action={scheduleJobAction}
                      label="Distribuir"
                      pending="Programando…"
                      okMessage="Cortes programados — veja o Quadro."
                      className="mt-4 flex flex-wrap items-end gap-4"
                    >
                      <input type="hidden" name="job" value={jobId} />
                      <div className="space-y-1.5">
                        <PlatformBoxes prefix="job" />
                        <InstagramMode />
                        <CollabFields />
                      </div>
                      <label className="text-xs text-white/50">
                        Primeiro post
                        <input type="datetime-local" name="start" defaultValue={amanha18h()} required className={`${input} block mt-1`} />
                      </label>
                      <label className="text-xs text-white/50">
                        A cada (horas)
                        <input type="number" name="interval" defaultValue={2} min={1} max={168} className={`${input} block mt-1 w-24`} />
                      </label>
                    </ProducaoForm>
                  </div>
                )}

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {cuts.map((c) => {
                    const done = postsOfCut(c.file);
                    return (
                      <div key={c.file} className={`${card} flex gap-4`}>
                        {c.thumbUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.thumbUrl} alt="" className="w-24 aspect-[9/16] object-cover rounded-md shrink-0 bg-black self-start" />
                        )}
                        <div className="min-w-0 flex-1">
                          <a href={c.url} target="_blank" className="text-white font-semibold text-sm hover:text-gold-400 line-clamp-2">
                            {c.title ?? c.file}
                          </a>
                          <p className="text-white/40 text-xs mt-0.5">{minutos(c.durationSec)}</p>
                          {done.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {done.map((p) => (
                                <span key={p.id} className="text-[11px] text-white/50">
                                  {PLATFORMS[p.platform].label}: <Badge s={p.status} />
                                </span>
                              ))}
                            </div>
                          )}
                          <ProducaoForm
                            action={scheduleCutAction}
                            label="Programar"
                            pending="Enviando…"
                            okMessage="Programado."
                            className="mt-3 space-y-2"
                            buttonClassName="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold"
                          >
                            <input type="hidden" name="job" value={jobId} />
                            <input type="hidden" name="file" value={c.file} />
                            <input name="title" defaultValue={c.title ?? ""} maxLength={100} placeholder="Título" className={`${input} w-full`} />
                            <textarea
                              name="caption"
                              defaultValue={defaultCaption(c)}
                              rows={4}
                              className={`${input} w-full resize-y`}
                            />
                            <PlatformBoxes prefix={c.file} />
                            <InstagramMode />
                            <CollabFields />
                            <label className="text-xs text-white/50 block">
                              Quando (em branco = agora)
                              <input type="datetime-local" name="publish_at" className={`${input} block mt-1`} />
                            </label>
                          </ProducaoForm>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Contas */}
        {view === "contas" && (
          <section className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={card}>
              <p className="text-white/50 text-xs uppercase tracking-wide">YouTube</p>
              {channel ? (
                <p className="text-emerald-400 text-sm font-semibold mt-2">✓ {channel.title}</p>
              ) : (
                <a href="/admin/producao/config" className="text-gold-500 text-sm mt-2 inline-block">
                  Conectar em Produção →
                </a>
              )}
              <p className="text-white/30 text-xs mt-2">Mesmo canal da Produção. ~6 uploads/dia de cota.</p>
            </div>

            <div className={`${card} sm:col-span-2`}>
              <p className="text-white/50 text-xs uppercase tracking-wide">Instagram + Facebook (Meta)</p>
              {!isMetaConfigured() || !isCryptoConfigured() ? (
                <p className="text-yellow-300 text-sm mt-2">
                  Faltam {[!isMetaConfigured() && "META_APP_ID / META_APP_SECRET", !isCryptoConfigured() && "SOCIAL_TOKEN_KEY"]
                    .filter(Boolean)
                    .join(" e ")}{" "}
                  na Vercel.
                </p>
              ) : ig || fb ? (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
                  <div className="text-sm space-y-0.5">
                    <p className={fb ? "text-emerald-400 font-semibold" : "text-white/40"}>
                      {fb ? `✓ Página ${fb.account_name}` : "Sem Página"}
                    </p>
                    <p className={ig ? "text-emerald-400 font-semibold" : "text-yellow-300"}>
                      {ig ? `✓ Instagram ${ig.account_name ?? ""}` : "Instagram não ligado à Página (precisa ser Business/Creator)"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href="/api/social/meta/oauth" className="text-xs text-white/60 hover:text-white">
                      Reconectar
                    </a>
                    <form action={disconnectMetaAction}>
                      <button className="text-xs text-white/40 hover:text-red-400">Desconectar</button>
                    </form>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {metaRevoked && (
                    <p className="text-red-400 text-xs mb-2">O acesso da Meta expirou ou foi removido. Conecte de novo.</p>
                  )}
                  <a href="/api/social/meta/oauth" className="btn-primary inline-block px-4 py-2 rounded-lg text-sm font-bold">
                    Conectar Facebook e Instagram
                  </a>
                </div>
              )}
            </div>

            <div className={card}>
              <p className="text-white/50 text-xs uppercase tracking-wide">TikTok</p>
              <p className="text-white/40 text-sm mt-2">Fase 2 — aguardando aprovação do app no TikTok.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
