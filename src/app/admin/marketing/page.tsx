import AdminHeader from "@/components/admin/AdminHeader";
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
import { PLATFORMS, listConnections, type Platform, type PostStatus, type SocialPost } from "@/lib/social/store";
import {
  cancelPostAction,
  disconnectMetaAction,
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

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const card = "bg-[#111] border border-[#222] rounded-2xl p-5";

function quando(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function quem(actor: string | null): string {
  if (!actor) return "automação";
  return actor.includes("@") ? actor.split("@")[0] : actor;
}

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: { job?: string; ok?: string; erro?: string };
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

  let jobs: ContentaJob[] = [];
  let jobsError: string | null = null;
  if (isContentaConfigured()) {
    try {
      jobs = (await listContentaJobs())
        .filter((j) => j.status === "done" && j.totalCuts > 0)
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""))
        .slice(0, 12);
    } catch (e) {
      jobsError = e instanceof Error ? e.message : String(e);
    }
  }

  const jobId = searchParams.job && /^job_\d{13,16}$/.test(searchParams.job) ? searchParams.job : null;
  let cuts: ContentaCut[] = [];
  let cutsError: string | null = null;
  if (jobId) {
    try {
      cuts = (await listJobCuts(jobId)).items;
    } catch (e) {
      cutsError = e instanceof Error ? e.message : String(e);
    }
  }

  const ig = connections?.find((c) => c.platform === "instagram" && c.status === "ativa");
  const fb = connections?.find((c) => c.platform === "facebook" && c.status === "ativa");
  const metaRevoked = !ig && !fb && connections?.some((c) => c.platform !== "tiktok" && c.status === "revogada");

  const connected: Record<Platform, boolean> = { youtube: !!channel, instagram: !!ig, facebook: !!fb, tiktok: false };
  const ready = (Object.keys(PLATFORMS) as Platform[]).filter((p) => PLATFORMS[p].ready);

  const fila = posts.filter((p) => p.status !== "publicado" && p.status !== "cancelado");
  const publicados = posts.filter((p) => p.status === "publicado").reverse();
  const postsOfCut = (file: string) => posts.filter((p) => p.contenta_job_id === jobId && p.cut_file === file);

  const Badge = ({ s }: { s: PostStatus }) => (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS[s].cls}`}>
      {STATUS[s].label}
    </span>
  );

  const PlatformBoxes = ({ prefix }: { prefix: string }) => (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {ready.map((p) => (
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

  const PostRow = ({ p }: { p: SocialPost }) => (
    <div className="flex items-start gap-3 py-3 border-b border-[#1c1c1c] last:border-0">
      {p.thumb_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.thumb_url} alt="" className="w-10 aspect-[9/16] object-cover rounded shrink-0 bg-black" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-white text-sm font-semibold line-clamp-1">{p.title}</span>
          <Badge s={p.status} />
        </div>
        <p className="text-white/40 text-xs mt-0.5">
          {PLATFORMS[p.platform].label} · {p.status === "publicado" ? quando(p.published_at) : quando(p.scheduled_at)} ·{" "}
          {quem(p.created_by)}
          {p.attempts > 0 && p.status !== "publicado" ? ` · tentativa ${p.attempts}` : ""}
        </p>
        {p.error && <p className="text-red-400/80 text-xs mt-1 break-words">{p.error}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
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
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Marketing</h1>
            <p className="text-white/40 text-sm mt-1">
              Cortes do Contenta programados para YouTube, Instagram e Facebook. A fila publica sozinha a cada 5 min.
            </p>
          </div>
          <ProducaoForm
            action={runQueueAction}
            label="Rodar fila agora"
            pending="Publicando…"
            okMessage="Fila processada."
            buttonClassName="text-sm border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5"
          />
        </div>

        {searchParams.ok && (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm">
            {searchParams.ok}
          </div>
        )}
        {searchParams.erro && (
          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm break-words">
            {searchParams.erro}
          </div>
        )}
        {schemaMissing && (
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm">
            Tabelas de marketing não encontradas — rode <code>supabase/013_social.sql</code> e{" "}
            <code>supabase/014_social_cron.sql</code> no Supabase.
          </div>
        )}

        {/* Conexões */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3">Contas</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
          </div>
        </section>

        {/* Fila */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3">
            Fila <span className="text-white/30 font-normal text-sm">({fila.length})</span>
          </h2>
          <div className={card}>
            {fila.length === 0 ? (
              <p className="text-white/40 text-sm">Nada agendado. Escolha um job do Contenta abaixo para programar os cortes.</p>
            ) : (
              fila.map((p) => <PostRow key={p.id} p={p} />)
            )}
          </div>
        </section>

        {/* Programar */}
        <section>
          <h2 className="text-lg font-bold text-white mb-3">Programar cortes do Contenta</h2>
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
                  href={`/admin/marketing?job=${j.jobId}`}
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
                  </p>
                  <ProducaoForm
                    action={scheduleJobAction}
                    label="Distribuir"
                    pending="Programando…"
                    okMessage="Cortes programados — veja a fila."
                    className="mt-4 flex flex-wrap items-end gap-4"
                  >
                    <input type="hidden" name="job" value={jobId} />
                    <PlatformBoxes prefix="job" />
                    <label className="text-xs text-white/50">
                      Primeiro post
                      <input type="datetime-local" name="start" defaultValue={amanha18h()} required className={`${input} block mt-1`} />
                    </label>
                    <label className="text-xs text-white/50">
                      A cada (horas)
                      <input type="number" name="interval" defaultValue={24} min={1} max={168} className={`${input} block mt-1 w-24`} />
                    </label>
                  </ProducaoForm>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
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

        {/* Publicados */}
        {publicados.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              Publicados <span className="text-white/30 font-normal text-sm">(14 dias)</span>
            </h2>
            <div className={card}>
              {publicados.map((p) => (
                <PostRow key={p.id} p={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
