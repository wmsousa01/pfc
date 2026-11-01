import AdminHeader from "@/components/admin/AdminHeader";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { isGeminiConfigured } from "@/lib/producao/gemini";
import {
  LOGO_PATH,
  getConfig,
  db,
  download,
  signedUrls,
  type ProducaoEvento,
  type ProducaoStatus,
  type ProducaoThumb,
  type ProducaoVideo,
} from "@/lib/producao/store";
import { connectedChannel } from "@/lib/producao/youtube-api";
import { MODES, contentaJobUrl, isContentaConfigured } from "@/lib/producao/contenta";
import { CONTENTA_ERROR, refreshCuttingLives, type LiveStatus, type ProducaoLive } from "@/lib/producao/lives";
import { lastPlaylistsResult } from "@/lib/producao/playlists";
import { QUADROS, QUADRO_IDS, isQuadroId } from "@/lib/producao/quadros";
import {
  approveAction,
  generateAction,
  liveStatusAction,
  playlistsAction,
  setQuadroAction,
  setStatusAction,
  syncAction,
  triggerLiveAction,
  uploadFrameAction,
} from "./actions";

export const dynamic = "force-dynamic";
// Gerar thumb roda dentro da server action desta página.
export const maxDuration = 300;

const STATUS: Record<ProducaoStatus, { label: string; cls: string }> = {
  novo: { label: "Na fila", cls: "bg-white/5 border-white/15 text-white/60" },
  gerando: { label: "Gerando thumb", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  revisar: { label: "Revisar", cls: "bg-gold-500/15 border-gold-500/40 text-gold-400" },
  aprovada: { label: "Agendada", cls: "bg-violet-500/10 border-violet-500/30 text-violet-300" },
  publicada: { label: "Publicada", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  ignorado: { label: "Ignorado", cls: "bg-white/5 border-white/10 text-white/30" },
  erro: { label: "Erro", cls: "bg-red-500/10 border-red-500/30 text-red-400" },
};

const LIVE_STATUS: Record<LiveStatus, { label: string; cls: string }> = {
  detectada: { label: "Sem cortes", cls: "bg-gold-500/15 border-gold-500/40 text-gold-400" },
  cortando: { label: "Cortando no Contenta", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  cortada: { label: "Cortada", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  ja_cortada: { label: "Já cortada", cls: "bg-white/5 border-white/15 text-white/50" },
  ignorada: { label: "Ignorada", cls: "bg-white/5 border-white/10 text-white/30" },
  erro: { label: "Erro", cls: "bg-red-500/10 border-red-500/30 text-red-400" },
};

const JOB_STATUS = { processing: "processando", done: "pronto", failed: "falhou" } as const;

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";

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

function quem(actor: string): string {
  return actor.includes("@") ? actor.split("@")[0] : actor;
}

export default async function ProducaoPage() {
  await requireAdmin();
  const [channel, contentaError, playlists] = await Promise.all([
    connectedChannel(),
    getConfig(CONTENTA_ERROR),
    lastPlaylistsResult().catch(() => null),
  ]);

  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const { data: rows } = await db()
    .from("producao_videos")
    .select("*")
    .or(`status.not.in.(publicada,ignorado),updated_at.gte.${since}`)
    .order("uploaded_at", { ascending: false })
    .limit(150);
  const videos = (rows ?? []) as ProducaoVideo[];
  const ids = videos.map((v) => v.id);

  // Job pronto no Contenta aparece assim que alguém abre o painel.
  if (isContentaConfigured()) await refreshCuttingLives().catch(() => null);
  const { data: liveRows } = await db()
    .from("producao_lives")
    .select("*")
    .or(`status.not.in.(ignorada,ja_cortada,cortada),updated_at.gte.${since}`)
    .order("ended_at", { ascending: false })
    .limit(30);
  const lives = ((liveRows ?? []) as ProducaoLive[]).filter((l) => l.status !== "ignorada");
  const livesSemCorte = lives.filter((l) => l.status === "detectada" || l.status === "erro").length;

  const [{ data: thumbRows }, { data: eventRows }, hasLogo] = await Promise.all([
    ids.length
      ? db().from("producao_thumbs").select("*").in("video_id", ids).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    ids.length
      ? db().from("producao_eventos").select("*").in("video_id", ids).order("created_at", { ascending: false }).limit(600)
      : Promise.resolve({ data: [] }),
    download(LOGO_PATH).then(Boolean),
  ]);
  const thumbs = (thumbRows ?? []) as ProducaoThumb[];
  const events = (eventRows ?? []) as ProducaoEvento[];
  const urls = await signedUrls(thumbs.map((t) => t.storage_path));

  const thumbsOf = (id: string) => thumbs.filter((t) => t.video_id === id);
  const eventsOf = (id: string) => events.filter((e) => e.video_id === id).slice(0, 5);
  const by = (s: ProducaoStatus[]) => videos.filter((v) => s.includes(v.status));

  const revisar = by(["revisar"]);
  const fila = by(["novo", "gerando", "erro"]);
  const agendadas = by(["aprovada"]).sort((a, b) => (a.publish_at ?? "").localeCompare(b.publish_at ?? ""));
  const publicadas = by(["publicada"]);
  const ignorados = by(["ignorado"]);

  const Badge = ({ s }: { s: ProducaoStatus }) => (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS[s].cls}`}>{STATUS[s].label}</span>
  );

  const Head = ({ v }: { v: ProducaoVideo }) => (
    <div className="flex gap-3 min-w-0">
      {v.yt_thumb_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.yt_thumb_url} alt="" className="w-28 aspect-video object-cover rounded-md shrink-0 bg-black" />
      )}
      <div className="min-w-0">
        <a
          href={`https://studio.youtube.com/video/${v.youtube_id}/edit`}
          target="_blank"
          className="text-white font-semibold text-sm hover:text-gold-400 line-clamp-2"
        >
          {v.title} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <Badge s={v.status} />
          <span className="text-white/35 text-xs">
            {minutos(v.duration_sec)} · subiu {quando(v.uploaded_at)}
          </span>
        </div>
        <form action={setQuadroAction} className="flex items-center gap-1.5 mt-1.5">
          <input type="hidden" name="id" value={v.id} />
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ background: isQuadroId(v.quadro) ? QUADROS[v.quadro].accent[1] : "#555" }}
          />
          <select name="quadro" defaultValue={isQuadroId(v.quadro) ? v.quadro : ""} className={input}>
            {!isQuadroId(v.quadro) && <option value="">Quadro: será identificado</option>}
            {QUADRO_IDS.map((q) => (
              <option key={q} value={q}>
                {QUADROS[q].name}
              </option>
            ))}
          </select>
          <button className="text-[11px] text-white/40 hover:text-white">Salvar</button>
        </form>
      </div>
    </div>
  );

  const History = ({ v }: { v: ProducaoVideo }) => {
    const ev = eventsOf(v.id);
    if (ev.length === 0) return null;
    return (
      <ul className="mt-3 space-y-0.5 text-[11px] text-white/35">
        {ev.map((e) => (
          <li key={e.id}>
            {quando(e.created_at)} · <span className="text-white/55">{quem(e.actor)}</span> {e.action}
            {e.detail && <span className="text-white/30"> — {e.detail}</span>}
          </li>
        ))}
      </ul>
    );
  };

  const RegenForm = ({ v }: { v: ProducaoVideo }) => (
    <details className="mt-3">
      <summary className="text-xs text-white/50 hover:text-white cursor-pointer">
        Gerar outra versão{v.headline_options.length > 0 && " · headlines sugeridas"}
      </summary>
      {v.headline_options.length > 0 && (
        <ul className="mt-2 text-xs text-white/50 space-y-0.5">
          {v.headline_options.map((h, i) => (
            <li key={i}>
              <span className="text-white/80">{h.l1}</span> / <span className="text-gold-400">{h.l2}</span>
            </li>
          ))}
        </ul>
      )}
      <ProducaoForm
        action={generateAction}
        label="Gerar"
        pending="Gerando... (~30 s)"
        className="mt-2 flex flex-wrap items-start gap-2"
        buttonClassName="px-3 py-1.5 rounded-lg text-xs font-bold border border-gold-500/40 text-gold-400 hover:bg-gold-500/10"
      >
        <input type="hidden" name="id" value={v.id} />
        <input name="l1" placeholder="Linha 1 (vazio = IA sugere)" className={`${input} w-48`} />
        <input name="l2" placeholder="Linha 2" className={`${input} w-48`} />
      </ProducaoForm>
    </details>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Produção de cortes</h1>
            <p className="text-white/40 text-sm mt-1 max-w-2xl">
              Live encerrada vai sozinha para o Contenta (shorts e longos). O corte sobe privado e entra aqui; a
              IA lê a legenda, sugere a headline e gera as thumbs; alguém da equipe aprova uma, e o vídeo é
              publicado ou agendado com ela.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/admin/producao/config"
              className="text-white/50 hover:text-white text-sm border border-[#2a2a2a] rounded-lg px-3 py-2"
            >
              Configurar
            </a>
            {channel && (
              <form action={syncAction}>
                <button className="btn-primary px-4 py-2 rounded-lg text-sm font-bold">Buscar no canal</button>
              </form>
            )}
          </div>
        </div>

        {contentaError && (
          <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            O Contenta recusou a última leitura — as lives aparecem, mas nada é cortado sozinho até isso
            ser resolvido: {contentaError}
          </div>
        )}

        {(!channel || !isGeminiConfigured() || !hasLogo || !isContentaConfigured()) && (
          <div className="mt-6 p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-sm space-y-1">
            {!channel && <p>Canal do YouTube não conectado — conecte em Configurar.</p>}
            {!isGeminiConfigured() && <p>GOOGLE_AI_API_KEY não configurada na Vercel: as thumbs não são geradas.</p>}
            {!hasLogo && <p>Logo oficial do PFC não enviado: as thumbs saem sem logo.</p>}
            {!isContentaConfigured() && <p>CONTENTA_HUB_SECRET não configurado: as lives não vão para o Contenta.</p>}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mt-6">
          {[
            { v: livesSemCorte, l: "Lives sem cortes", c: livesSemCorte ? "text-gold-500" : "text-white" },
            { v: revisar.length, l: "Para revisar", c: revisar.length ? "text-gold-500" : "text-white" },
            { v: fila.filter((x) => x.status !== "erro").length, l: "Na fila / gerando", c: "text-white" },
            { v: fila.filter((x) => x.status === "erro").length, l: "Com erro", c: fila.some((x) => x.status === "erro") ? "text-red-400" : "text-white" },
            { v: agendadas.length, l: "Agendadas", c: "text-white" },
            { v: publicadas.length, l: "Publicadas (14 dias)", c: "text-emerald-400" },
          ].map((k) => (
            <div key={k.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className={`text-3xl font-black ${k.c}`}>{k.v}</div>
              <div className="text-white/50 text-sm mt-1">{k.l}</div>
            </div>
          ))}
        </div>

        {/* Playlists dos cortes */}
        {channel && isContentaConfigured() && (
          <div className="mt-6 bg-[#111] border border-[#222] rounded-2xl p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-white font-semibold text-sm">Playlists dos cortes</p>
                <p className="text-white/40 text-xs mt-0.5 max-w-2xl">
                  Cada corte vai para &quot;Cortes &lt;quadro&gt;&quot; e, se for Short, também para &quot;Shorts&quot;. O quadro
                  vem da live de origem: ponha a live na playlist do quadro e a rodada das 23h faz o resto.
                </p>
                {playlists && (
                  <p className="text-white/50 text-xs mt-2">
                    Última organização {quando(playlists.at)}: {playlists.adicionados} inclusão(ões)
                    {playlists.criadas.length > 0 && ` · criou ${playlists.criadas.join(", ")}`}
                  </p>
                )}
                {playlists?.erro && <p className="text-red-400 text-xs mt-1 break-words">{playlists.erro}</p>}
              </div>
              <ProducaoForm
                action={playlistsAction}
                label="Organizar agora"
                pending="Organizando…"
                okMessage="Playlists em dia."
                buttonClassName="text-sm border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5"
              />
            </div>
            {playlists && playlists.semOrigem.length > 0 && (
              <div className="mt-3 text-xs">
                <p className="text-yellow-300">
                  Sem live de origem identificada — ponha na playlist à mão ou ponha a live na playlist do quadro:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {playlists.semOrigem.map((v) => (
                    <li key={v.id}>
                      <a href={`https://studio.youtube.com/video/${v.id}/edit`} target="_blank" className="text-white/60 hover:text-gold-400">
                        {v.title} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Lives */}
        <h2 className="text-xl font-bold text-white mt-12 mb-1">Lives do canal</h2>
        <p className="text-white/40 text-sm mb-4">
          Live nova é cortada sozinha na rodada diária, 30 min depois do fim. As anteriores ao recurso
          esperam um clique.
        </p>
        {lives.length === 0 && <p className="text-white/40 text-sm">Nenhuma live encerrada encontrada.</p>}
        <div className="space-y-3">
          {lives.map((l) => (
            <div key={l.id} className="bg-[#111] border border-[#222] rounded-2xl p-4 flex flex-wrap gap-4 items-start justify-between">
              <div className="flex gap-3 min-w-0">
                {l.thumb_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.thumb_url} alt="" className="w-28 aspect-video object-cover rounded-md shrink-0 bg-black" />
                )}
                <div className="min-w-0">
                  <a href={`https://youtu.be/${l.youtube_id}`} target="_blank" className="text-white font-semibold text-sm hover:text-gold-400 line-clamp-2">
                    {l.title} ↗
                  </a>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${LIVE_STATUS[l.status].cls}`}>
                      {LIVE_STATUS[l.status].label}
                    </span>
                    <span className="text-white/35 text-xs">
                      {minutos(l.duration_sec)} · terminou {quando(l.ended_at)}
                      {l.privacy && l.privacy !== "public" && ` · ${l.privacy}`}
                    </span>
                  </div>
                  {l.jobs.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-xs">
                      {l.jobs.map((j) => (
                        <li key={j.jobId}>
                          <a href={contentaJobUrl(j.jobId)} target="_blank" className="text-white/60 hover:text-gold-400">
                            {MODES[j.mode].label} — {JOB_STATUS[j.status]}
                            {j.status === "done" && ` · ${j.totalCuts} cortes`} ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {l.error && <p className="text-red-400 text-xs mt-2 break-words">{l.error}</p>}
                  {l.triggered_at && (
                    <p className="text-[11px] text-white/30 mt-1">
                      disparada por {quem(l.triggered_by ?? "")} · {quando(l.triggered_at)}
                    </p>
                  )}
                </div>
              </div>
              {(l.status === "detectada" || l.status === "erro" || l.status === "ja_cortada") && (
                <div className="flex flex-wrap items-start gap-2">
                  <ProducaoForm
                    action={triggerLiveAction}
                    label={l.status === "erro" ? "Tentar de novo" : l.status === "ja_cortada" ? "Cortar de novo" : "Gerar cortes"}
                    pending="Enviando..."
                    buttonClassName={
                      l.status === "ja_cortada"
                        ? "px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-[#2a2a2a]"
                        : undefined
                    }
                  >
                    <input type="hidden" name="id" value={l.id} />
                    {l.status === "ja_cortada" && <input type="hidden" name="force" value="1" />}
                  </ProducaoForm>
                  {l.status === "detectada" && (
                    <>
                      <form action={liveStatusAction}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="ja_cortada" />
                        <button className="px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-[#2a2a2a]">
                          Já cortei
                        </button>
                      </form>
                      <form action={liveStatusAction}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value="ignorada" />
                        <button className="px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-[#2a2a2a]">
                          Ignorar
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Revisar */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">Para revisar</h2>
        {revisar.length === 0 && <p className="text-white/40 text-sm">Nenhuma thumb esperando aprovação.</p>}
        <div className="space-y-6">
          {revisar.map((v) => (
            <div key={v.id} className="bg-[#111] border border-[#222] rounded-2xl p-5">
              <Head v={v} />
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {thumbsOf(v.id).map((t) => (
                  <div key={t.id} className="bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden">
                    <a href={urls.get(t.storage_path)} target="_blank">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={urls.get(t.storage_path)} alt={`${t.l1} ${t.l2}`} className="w-full aspect-video object-cover" />
                    </a>
                    <div className="p-3">
                      <div className="text-xs">
                        <span className="text-white/80">{t.l1}</span> / <span className="text-gold-400">{t.l2}</span>
                      </div>
                      <div className="text-[11px] text-white/30 mt-0.5">
                        {quando(t.created_at)}
                        {t.created_by ? ` · pedida por ${quem(t.created_by)}` : " · automação"}
                      </div>
                      <ProducaoForm
                        action={approveAction}
                        label="Aprovar"
                        pending="Enviando ao YouTube..."
                        className="mt-3 flex flex-wrap items-start gap-2"
                        buttonClassName="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        <input type="hidden" name="thumb_id" value={t.id} />
                        <input
                          type="datetime-local"
                          name="publish_at"
                          title="Horário de Brasília. Vazio = publica agora."
                          className={input}
                        />
                      </ProducaoForm>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-white/30 mt-2">
                Data vazia publica na hora; com data, o vídeo fica privado e o YouTube publica no horário (Brasília).
              </p>
              <RegenForm v={v} />
              <History v={v} />
            </div>
          ))}
        </div>

        {/* Fila */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">Fila</h2>
        {fila.length === 0 && <p className="text-white/40 text-sm">Fila vazia.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          {fila.map((v) => (
            <div key={v.id} className="bg-[#111] border border-[#222] rounded-2xl p-5">
              <Head v={v} />
              {v.error && <p className="text-red-400 text-xs mt-3 break-words">{v.error}</p>}
              {v.status !== "gerando" && (
                <div className="flex flex-wrap items-start gap-2 mt-4">
                  <ProducaoForm action={generateAction} label="Gerar thumbs" pending="Gerando... (~30 s)">
                    <input type="hidden" name="id" value={v.id} />
                  </ProducaoForm>
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="status" value="ignorado" />
                    <button className="px-3 py-2 rounded-lg text-sm text-white/50 hover:text-white border border-[#2a2a2a]">
                      Ignorar
                    </button>
                  </form>
                </div>
              )}
              <details className="mt-3">
                <summary className="text-xs text-white/50 hover:text-white cursor-pointer">Enviar frame do corte</summary>
                <ProducaoForm
                  action={uploadFrameAction}
                  label="Enviar"
                  pending="Enviando..."
                  okMessage="Frame salvo. Gere as thumbs."
                  className="mt-2 flex flex-wrap items-start gap-2"
                  buttonClassName="px-3 py-1.5 rounded-lg text-xs font-bold border border-[#2a2a2a] text-white/70"
                >
                  <input type="hidden" name="id" value={v.id} />
                  <input type="file" name="frame" accept="image/png,image/jpeg,image/webp" className="text-xs text-white/60" />
                </ProducaoForm>
              </details>
              <History v={v} />
            </div>
          ))}
        </div>

        {/* Agendadas */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">Agendadas</h2>
        {agendadas.length === 0 && <p className="text-white/40 text-sm">Nada agendado.</p>}
        <div className="space-y-2">
          {agendadas.map((v) => (
            <div key={v.id} className="bg-[#111] border border-[#222] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
              <Head v={v} />
              <div className="text-right text-xs text-white/50">
                <div className="text-violet-300 font-bold text-sm">{quando(v.publish_at)}</div>
                aprovada por {quem(v.approved_by ?? "")}
              </div>
            </div>
          ))}
        </div>

        {/* Publicadas */}
        <h2 className="text-xl font-bold text-white mt-12 mb-4">Publicadas nos últimos 14 dias</h2>
        {publicadas.length === 0 && <p className="text-white/40 text-sm">Nenhuma ainda.</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {publicadas.map((v) => {
            const t = thumbs.find((x) => x.id === v.approved_thumb_id);
            return (
              <a
                key={v.id}
                href={`https://youtu.be/${v.youtube_id}`}
                target="_blank"
                className="bg-[#111] border border-[#222] hover:border-gold-500/40 rounded-xl overflow-hidden"
              >
                {t && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls.get(t.storage_path)} alt="" className="w-full aspect-video object-cover" />
                )}
                <div className="p-3">
                  <div className="text-white text-sm line-clamp-1">{v.title}</div>
                  <div className="text-white/35 text-[11px] mt-0.5">
                    {quem(v.approved_by ?? "")} · {quando(v.approved_at)}
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        {ignorados.length > 0 && (
          <details className="mt-12">
            <summary className="text-white/40 text-sm cursor-pointer">Ignorados ({ignorados.length})</summary>
            <div className="mt-3 space-y-2">
              {ignorados.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 text-sm text-white/50">
                  <span className="truncate">{v.title}</span>
                  <form action={setStatusAction}>
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="status" value="novo" />
                    <button className="text-xs text-gold-500 hover:text-gold-400">Voltar para a fila</button>
                  </form>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
