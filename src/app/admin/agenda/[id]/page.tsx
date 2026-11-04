import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import ProducaoForm from "@/components/admin/ProducaoForm";
import MaterialUploader from "@/components/agenda/MaterialUploader";
import { requireAdmin } from "@/lib/auth";
import { pautaTexto } from "@/lib/agenda/briefing";
import { blocosDoEspelho, linkEspelho } from "@/lib/agenda/espelho";
import { youtubeUrl } from "@/lib/agenda/fluxo";
import { calendarAccount } from "@/lib/agenda/gcal";
import { listarPasta, pastaDrive, type ArquivoDrive } from "@/lib/agenda/video";
import {
  MATERIAL_TIPOS,
  TZ,
  apresentadoresDo,
  brtDate,
  convidadosDe,
  db,
  getEpisodio,
  linkConvidado,
  materiaisDe,
  quandoLongo,
  type Arte,
  type Evento,
  type MaterialTipo,
} from "@/lib/agenda/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { signedUrls } from "@/lib/producao/store";
import { activeConnection } from "@/lib/social/store";
import {
  addConvidadoAction,
  agendaSyncAction,
  apresentadoresEpisodioAction,
  atualizarVideoAction,
  enviarVideoAction,
  framesAction,
  liberarEnvioAction,
  ligarVideoAction,
  cargoConvidadoAction,
  espelhoAction,
  importarRoteiroAction,
  materialAction,
  materialRemoverAction,
  pedirUploadAction,
  registrarMaterialAction,
  aprovarArteAction,
  cancelarAction,
  confirmarAction,
  fotoConvidadoAction,
  gerarArteAction,
  gerarBriefingAction,
  instagramAction,
  instagramResetAction,
  liveAction,
  observacoesAction,
  pautaNewsAction,
  perfilIgAction,
  realizadoAction,
  remarcarAction,
  removerConvidadoAction,
  salvarBriefingAction,
  tirarRoteiroAction,
} from "../actions";
import { STATUS_EP } from "../shared";

export const dynamic = "force-dynamic";
// Artes (Gemini + recorte) e briefing rodam dentro das actions desta página.
export const maxDuration = 300;

const input =
  "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-gold-500/50";
const area = `${input} w-full leading-relaxed`;
const card = "bg-[#111] border border-[#222] rounded-2xl p-6";
const btn2 = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5";

function quando(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** datetime-local no horário de Brasília. */
function localInput(iso: string): string {
  const d = new Date(iso);
  return `${brtDate(d)}T${d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`;
}

export default async function EpisodioPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const ep = await getEpisodio(params.id);
  if (!ep) notFound();
  const t = isQuadroId(ep.quadro) ? QUADROS[ep.quadro] : null;

  const [convidados, { data: arteRows }, { data: evRows }, gcal, ig, hosts, materiais] = await Promise.all([
    convidadosDe(ep.id),
    db().from("agenda_artes").select("*").eq("episodio_id", ep.id).order("created_at", { ascending: false }).limit(12),
    db().from("agenda_eventos").select("*").eq("episodio_id", ep.id).order("created_at", { ascending: false }).limit(40),
    calendarAccount(),
    activeConnection("instagram").catch(() => null),
    apresentadoresDo(ep.quadro, false),
    materiaisDe(ep.id),
  ]);
  // Sem escolha no episódio, entram todos os ativos do quadro.
  const noEpisodio = (id: string) => (ep.apresentadores ? ep.apresentadores.includes(id) : hosts.find((h) => h.id === id)?.ativo);
  const artes = (arteRows ?? []) as Arte[];
  const eventos = (evRows ?? []) as Evento[];
  const urls = await signedUrls([
    ...artes.flatMap((a) => [a.thumb_path, a.feed_path, a.story_path]),
    ...convidados.map((c) => c.foto_path).filter((p): p is string => !!p),
    ...hosts.map((h) => h.foto_path).filter((p): p is string => !!p),
    ...materiais.map((m) => m.path),
  ]);
  const alvos = [
    ...convidados.map((c) => ({ value: `c:${c.id}`, label: c.nome })),
    ...hosts.map((h) => ({ value: `a:${h.id}`, label: `${h.nome} (apresentador)` })),
    { value: "", label: "Do episódio (sem pessoa)" },
  ];
  const nomeAlvo = (convidadoId: string | null, apresentadorId: string | null) =>
    convidados.find((c) => c.id === convidadoId)?.nome ?? hosts.find((h) => h.id === apresentadorId)?.nome ?? null;
  const aprovada = artes.find((a) => a.id === ep.arte_id) ?? null;
  // Episódio gravado: o PFC Visita, ou qualquer um que já tenha vídeo ligado.
  const gravado = ep.quadro === "pfc-visita" || !!ep.video_drive_id;
  let arquivos: ArquivoDrive[] = [];
  let erroPasta: string | null = null;
  if (gravado && !ep.video_drive_id) {
    try {
      const todos = await listarPasta(await pastaDrive());
      const { data: usados } = await db().from("agenda_episodios").select("video_drive_id").not("video_drive_id", "is", null).neq("status", "cancelado");
      const ja = new Set((usados ?? []).map((u) => u.video_drive_id as string));
      arquivos = todos.filter((a) => !ja.has(a.id));
    } catch (e) {
      erroPasta = e instanceof Error ? e.message : String(e);
    }
  }
  const up = ep.yt_upload;
  const pct = up ? Math.floor((up.offset / up.total) * 100) : 0;
  const gb = (n: number | null) => (n ? `${(n / 1e9).toFixed(1)} GB` : "");
  const min = (s: number | null) => (s ? `${Math.floor(s / 60)} min` : "");
  const b = ep.briefing;
  const live = youtubeUrl(ep);
  const ativo = ep.status === "solicitado" || ep.status === "confirmado";
  const handles = convidados.filter((c) => c.instagram).map((c) => `@${c.instagram}`);
  const st = STATUS_EP[ep.status];
  const blocos = blocosDoEspelho(b, ep.roteiro).map((x, i) => ({ value: String(i), label: `Espelho ${i + 1}: ${x.titulo}`.slice(0, 60) }));
  const espelho = ep.espelho_token ? linkEspelho(ep.espelho_token) : null;
  const noEspelho = materiais.filter((m) => m.bloco != null).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <a href="/admin/agenda" className="text-white/40 hover:text-white text-sm">← Agenda</a>
          <div className="flex flex-wrap items-center gap-3 mt-3">
            {t && (
              <span
                className="text-xs font-black px-2.5 py-1 rounded-md"
                style={{ color: t.selo.text, background: t.selo.bg2 ? `linear-gradient(90deg, ${t.selo.bg} 50%, ${t.selo.bg2} 50%)` : t.selo.bg }}
              >
                {t.name.toUpperCase()}
              </span>
            )}
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
          </div>
          <h1 className="text-2xl font-bold text-white mt-2 capitalize">{quandoLongo(ep.inicio)}</h1>
          <p className="text-white/50 text-sm">
            {convidados.map((c) => c.nome).join(", ") || "Sem convidado"} · {ep.duracao_min} min
            {ep.tema && <> · {ep.tema}</>}
          </p>

          <div className="flex flex-wrap items-start gap-2 mt-4">
            {ep.status === "solicitado" && (
              <ProducaoForm action={confirmarAction} label="Confirmar" pending="Confirmando (gera o roteiro)...">
                <input type="hidden" name="id" value={ep.id} />
              </ProducaoForm>
            )}
            {ep.status === "confirmado" && new Date(ep.inicio) < new Date() && (
              <form action={realizadoAction}>
                <input type="hidden" name="id" value={ep.id} />
                <button className={btn2}>Marcar como gravado</button>
              </form>
            )}
            {ativo && (
              <details className="relative">
                <summary className={`${btn2} cursor-pointer list-none`}>Remarcar</summary>
                <ProducaoForm action={remarcarAction} label="Salvar" pending="Salvando..." className="mt-2 flex flex-wrap gap-2 items-start" buttonClassName={btn2}>
                  <input type="hidden" name="id" value={ep.id} />
                  <input type="date" name="data" required defaultValue={brtDate(ep.inicio)} className={input} />
                  <input type="time" name="hora" required defaultValue={localInput(ep.inicio).slice(11)} className={input} />
                  <input type="number" name="duracao" defaultValue={ep.duracao_min} min={15} step={15} className={`${input} w-20`} />
                </ProducaoForm>
              </details>
            )}
            {ativo && (
              <details>
                <summary className={`${btn2} cursor-pointer list-none hover:!border-red-500/50 hover:!text-red-400`}>Cancelar</summary>
                <ProducaoForm
                  action={cancelarAction}
                  label="Cancelar episódio"
                  pending="Cancelando..."
                  className="mt-2 flex flex-wrap gap-2 items-start"
                  buttonClassName="text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5"
                >
                  <input type="hidden" name="id" value={ep.id} />
                  <input name="motivo" placeholder="Motivo (opcional)" className={`${input} w-64`} />
                </ProducaoForm>
                <p className="text-white/30 text-xs mt-1">Apaga o evento da agenda (o convidado é avisado) e a live agendada.</p>
              </details>
            )}
          </div>
        </div>

        {/* ---- Convidados ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Convidados</h2>
          {convidados.length === 0 && (
            <p className="text-white/40 text-sm mt-1">Sem convidado: a arte sai só com o apresentador e o tema da semana.</p>
          )}
          <div className="mt-4 space-y-5">
            {convidados.map((c) => {
              const foto = (c.foto_path && urls.get(c.foto_path)) || c.ig_perfil?.picture || null;
              const p = c.ig_perfil;
              const link = linkConvidado(c.token);
              const wa = c.whatsapp
                ? `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(
                    `Oi, ${c.nome.split(" ")[0]}! Aqui é da produção do ${t?.name ?? "Fora da Caixa"}. Sua participação é ${quandoLongo(ep.inicio)}. Por este link você completa o briefing e manda sua foto: ${link}`
                  )}`
                : null;
              return (
                <div key={c.id} className="flex flex-wrap gap-4 border-t border-[#1c1c1c] pt-4 first:border-0 first:pt-0">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="" className="w-24 h-24 object-cover rounded-xl bg-black shrink-0" />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-[#0a0a0a] border border-dashed border-[#333] text-white/30 text-xs flex items-center justify-center text-center shrink-0">
                      sem foto
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-white font-semibold">{c.nome}</span>
                      {c.instagram && (
                        <a href={`https://instagram.com/${c.instagram}`} target="_blank" className="text-gold-400 hover:underline">
                          @{c.instagram}
                        </a>
                      )}
                      {p?.followers != null && <span className="text-white/40 text-xs">{p.followers.toLocaleString("pt-BR")} seguidores</span>}
                      {wa && <a href={wa} target="_blank" className="text-emerald-400 text-xs hover:underline">WhatsApp ↗</a>}
                      {c.email && <span className="text-white/40 text-xs">{c.email}</span>}
                    </div>
                    {p?.erro && <p className="text-yellow-300/80 text-xs">Instagram: {p.erro}</p>}
                    {p?.biography && <p className="text-white/45 text-xs whitespace-pre-line">IG: {p.biography}</p>}
                    {c.bio && <p className="text-white/70"><span className="text-white/35">Quem é:</span> {c.bio}</p>}
                    {c.temas && <p className="text-white/70"><span className="text-white/35">Temas:</span> {c.temas}</p>}
                    {c.divulgar && <p className="text-white/70"><span className="text-white/35">Divulgar:</span> {c.divulgar}</p>}
                    {c.links && <p className="text-white/70 break-all"><span className="text-white/35">Links:</span> {c.links}</p>}
                    <ProducaoForm action={cargoConvidadoAction} label="Salvar" pending="..." okMessage="Salvo." className="flex flex-wrap items-center gap-2" buttonClassName={btn2}>
                      <input type="hidden" name="convidado" value={c.id} />
                      <input name="cargo" defaultValue={c.cargo ?? ""} placeholder="Na arte, embaixo do nome (ex.: EMPRESÁRIO)" className={`${input} w-72`} />
                    </ProducaoForm>
                    <p className="text-xs text-white/35">
                      {c.briefing_em ? `Briefing salvo em ${quando(c.briefing_em)}` : "Ainda não preencheu o briefing"}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <CopyButton value={link} label="Copiar link do convidado" />
                      {c.instagram && (
                        <form action={perfilIgAction}>
                          <input type="hidden" name="convidado" value={c.id} />
                          <button className={btn2}>Ler perfil do Instagram</button>
                        </form>
                      )}
                      <ProducaoForm action={fotoConvidadoAction} label="Enviar foto" pending="Enviando..." className="flex items-center gap-2" buttonClassName={btn2}>
                        <input type="hidden" name="convidado" value={c.id} />
                        <input type="file" name="foto" accept="image/*" className="text-xs text-white/50 w-48" />
                      </ProducaoForm>
                      {convidados.length > 1 && (
                        <form action={removerConvidadoAction}>
                          <input type="hidden" name="convidado" value={c.id} />
                          <button className="text-xs text-white/30 hover:text-red-400">Remover</button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {ativo && (
            <details className="mt-5">
              <summary className="text-xs text-white/50 hover:text-white cursor-pointer">+ Adicionar convidado</summary>
              <ProducaoForm action={addConvidadoAction} label="Adicionar" pending="Adicionando..." className="mt-2 flex flex-wrap gap-2 items-start" buttonClassName={btn2}>
                <input type="hidden" name="id" value={ep.id} />
                <input name="nome" required placeholder="Nome" className={`${input} w-48`} />
                <input name="instagram" placeholder="@instagram" className={`${input} w-36`} />
                <input name="whatsapp" placeholder="WhatsApp" className={`${input} w-36`} />
                <input name="email" type="email" placeholder="E-mail" className={`${input} w-48`} />
                <input name="cargo" placeholder="Cargo na arte" className={`${input} w-44`} />
              </ProducaoForm>
            </details>
          )}
        </section>

        {/* ---- Apresentadores ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Apresentadores na arte</h2>
          {hosts.length === 0 ? (
            <p className="text-white/40 text-sm mt-1">
              Nenhum apresentador cadastrado para este quadro. <a href="/admin/agenda/config" className="text-gold-400 underline">Cadastrar</a>
            </p>
          ) : (
            <>
              <p className="text-white/40 text-sm mt-1">
                Quem entra na arte deste episódio. Para usar outra foto só nesta semana, mande em Materiais como “Foto do
                apresentador”.
              </p>
              <ProducaoForm action={apresentadoresEpisodioAction} label="Salvar" pending="Salvando..." okMessage="Salvo." className="mt-3 flex flex-wrap items-center gap-4" buttonClassName={btn2}>
                <input type="hidden" name="id" value={ep.id} />
                {hosts.map((h) => {
                  const extra = materiais.find((m) => m.tipo === "apresentador" && m.apresentador_id === h.id && m.usar_na_arte);
                  const u = urls.get(extra?.path ?? h.foto_path ?? "");
                  return (
                    <label key={h.id} className="flex items-center gap-2 text-sm text-white/80">
                      <input type="checkbox" name="apresentador" value={h.id} defaultChecked={!!noEpisodio(h.id)} />
                      {u ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u} alt="" className="w-10 h-10 rounded-lg object-cover bg-black" />
                      ) : (
                        <span className="w-10 h-10 rounded-lg border border-dashed border-[#333] text-[9px] text-white/30 flex items-center justify-center">sem foto</span>
                      )}
                      <span>
                        {h.nome} <span className="text-white/35 text-xs">{h.papel}{extra ? " · foto da semana" : ""}</span>
                      </span>
                    </label>
                  );
                })}
              </ProducaoForm>
            </>
          )}
        </section>

        {/* ---- Materiais ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Materiais</h2>
          <p className="text-white/40 text-sm mt-1">
            O que o convidado mandou pelo link e o que a equipe subir aqui. Na arte por IA entram as fotos marcadas, até 4
            logos/referências (ex.: o cão, a viatura, o produto) e a foto da semana do apresentador.
          </p>
          <div className="mt-4">
            <MaterialUploader
              pedir={pedirUploadAction.bind(null, ep.id)}
              registrar={registrarMaterialAction.bind(null, ep.id)}
              tipos={(Object.keys(MATERIAL_TIPOS) as MaterialTipo[]).map((v) => ({ value: v, label: MATERIAL_TIPOS[v] }))}
              alvos={alvos}
              blocos={blocos}
              tipoInicial={ep.quadro === "pfc-news" ? "outro" : undefined}
              inputCls={input}
              buttonCls={btn2}
            />
          </div>
          {materiais.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
              {materiais.map((m) => {
                const u = urls.get(m.path);
                const quem = nomeAlvo(m.convidado_id, m.apresentador_id);
                return (
                  <div key={m.id} className={`text-xs rounded-lg p-2 border ${m.usar_na_arte ? "border-emerald-500/30" : "border-[#222]"}`}>
                    <a href={u} target="_blank" download className="block">
                      {m.mime.startsWith("image/") && u ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u} alt={m.nome} className="w-full aspect-square object-cover rounded-md bg-black" />
                      ) : (
                        <div className="w-full aspect-square rounded-md bg-[#0a0a0a] border border-[#2a2a2a] flex items-center justify-center text-white/40 p-2 text-center break-all">
                          {m.mime.split("/")[0]} · {m.nome}
                        </div>
                      )}
                    </a>
                    <p className="text-white/40 truncate mt-1" title={m.nome}>
                      {quem ? `${quem} · ` : ""}{m.enviado_por === "convidado" ? "convidado" : m.enviado_por.split("@")[0]}
                    </p>
                    <ProducaoForm action={materialAction} label="Salvar" pending="..." className="mt-1 space-y-1" buttonClassName="text-[11px] text-white/50 hover:text-white">
                      <input type="hidden" name="material" value={m.id} />
                      <input type="hidden" name="convidado" value={m.convidado_id ?? ""} />
                      <select name="tipo" defaultValue={m.tipo} className={`${input} w-full`}>
                        {(Object.keys(MATERIAL_TIPOS) as MaterialTipo[]).map((v) => (
                          <option key={v} value={v}>{MATERIAL_TIPOS[v]}</option>
                        ))}
                      </select>
                      <select name="apresentador" defaultValue={m.apresentador_id ?? ""} className={`${input} w-full`}>
                        <option value="">— apresentador (se for foto dele)</option>
                        {hosts.map((h) => <option key={h.id} value={h.id}>{h.nome}</option>)}
                      </select>
                      {blocos.length > 0 && (
                        <select name="bloco" defaultValue={m.bloco ?? ""} className={`${input} w-full`}>
                          <option value="">— fora do espelho</option>
                          {blocos.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                        </select>
                      )}
                      <label className="flex items-center gap-1 text-white/60">
                        <input type="checkbox" name="usar" value="1" defaultChecked={m.usar_na_arte} /> usar na arte
                      </label>
                    </ProducaoForm>
                    {m.mime === "application/pdf" && (
                      <ProducaoForm action={importarRoteiroAction} label="Usar como roteiro do espelho" pending="Lendo o roteiro (~1 min)..." className="mt-1" buttonClassName="text-[11px] text-gold-400 hover:text-gold-300 text-left">
                        <input type="hidden" name="id" value={ep.id} />
                        <input type="hidden" name="material" value={m.id} />
                      </ProducaoForm>
                    )}
                    <form action={materialRemoverAction}>
                      <input type="hidden" name="material" value={m.id} />
                      <button className="text-[11px] text-white/30 hover:text-red-400">apagar</button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ---- Roteiro ---- */}
        <section className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-white font-bold">Roteiro do apresentador</h2>
            <ProducaoForm
              action={gerarBriefingAction}
              label={b ? "Gerar de novo com IA" : "Gerar com IA"}
              pending="Gerando (~15 s)..."
              buttonClassName={b ? btn2 : "btn-primary px-4 py-2 rounded-lg text-sm font-bold"}
            >
              <input type="hidden" name="id" value={ep.id} />
            </ProducaoForm>
          </div>
          <p className="text-white/40 text-sm mt-1">
            A IA monta resumo, pauta, título e descrição da live e a legenda do Instagram a partir do briefing do
            convidado. Revise: ela não conhece o convidado além disso.
          </p>
          {ep.quadro === "pfc-news" && (
            <div className="mt-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-4">
              <p className="text-white/70 text-sm">
                <strong className="text-white">Notícias da semana:</strong> lê os posts dos perfis de notícia e das prefeituras
                da região (lista em <a href="/admin/agenda/config" className="text-gold-400 underline">Configurar</a>) pela
                conta do Instagram conectada, escolhe as principais e monta o tema e o roteiro com a fonte de cada uma.
              </p>
              <ProducaoForm action={pautaNewsAction} label="Buscar notícias e gerar roteiro" pending="Lendo os perfis e montando a pauta (~30 s)..." className="mt-3 flex flex-wrap items-center gap-2" buttonClassName="btn-primary px-4 py-2 rounded-lg text-sm font-bold">
                <input type="hidden" name="id" value={ep.id} />
                <label className="text-xs text-white/60">
                  dos últimos
                  <select name="dias" defaultValue="7" className={`${input} mx-1`}>
                    {[3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  dias
                </label>
              </ProducaoForm>
              {b?.noticias && b.noticias.length > 0 && (
                <ol className="mt-4 space-y-3 list-decimal list-inside">
                  {b.noticias.map((n, i) => (
                    <li key={i} className="text-sm text-white/80">
                      <strong className="text-white">{n.titulo}</strong>
                      <p className="text-white/55 ml-5">{n.resumo}</p>
                      <p className="ml-5 text-xs flex flex-wrap gap-x-3">
                        {n.fontes.map((f) => (
                          <a key={f.url} href={f.url} target="_blank" className="text-gold-400 hover:underline">@{f.handle} ↗</a>
                        ))}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-white/30 text-xs mt-3">
                Só entram perfis Business/Creator; perfil que não deu para ler aparece no histórico. Confira cada notícia no post
                original antes de falar no ar.
              </p>
            </div>
          )}
          {b && (
            <ProducaoForm action={salvarBriefingAction} label="Salvar roteiro" pending="Salvando..." okMessage="Salvo." className="mt-4 space-y-3">
              <input type="hidden" name="id" value={ep.id} />
              <label className="block text-white/50 text-xs">Resumo do convidado
                <textarea name="resumo" rows={4} defaultValue={b.resumo} className={area} />
              </label>
              <label className="block text-white/50 text-xs">Pauta (## bloco, - pergunta)
                <textarea name="pauta" rows={14} defaultValue={pautaTexto(b.pauta)} className={`${area} font-mono`} />
              </label>
              <label className="block text-white/50 text-xs">Cuidados
                <textarea name="cuidados" rows={2} defaultValue={b.cuidados} className={area} />
              </label>
              <label className="block text-white/50 text-xs">Título da live
                <input name="titulo_live" maxLength={100} defaultValue={b.titulo_live} className={`${input} w-full`} />
              </label>
              <label className="block text-white/50 text-xs">Descrição da live
                <textarea name="descricao_yt" rows={5} defaultValue={b.descricao_yt} className={area} />
              </label>
              <label className="block text-white/50 text-xs">Legenda do Instagram
                <textarea name="legenda_ig" rows={5} defaultValue={ep.ig_legenda ?? b.legenda_ig} className={area} />
              </label>
              <div className="text-white/50 text-xs">Headline da arte
                <div className="flex flex-wrap gap-2 mt-1">
                  <input name="l1" defaultValue={b.arte.l1} placeholder="Linha 1" className={`${input} w-56`} />
                  <input name="l2" defaultValue={b.arte.l2} placeholder="Linha 2 (destaque)" className={`${input} w-44`} />
                  <input name="l3" defaultValue={b.arte.l3 ?? ""} placeholder="Linha 3 (opcional)" className={`${input} w-44`} />
                </div>
              </div>
              <label className="block text-white/50 text-xs">Tópicos da arte (separados por •)
                <input name="topicos" defaultValue={b.arte.topicos ?? ""} placeholder="DISCIPLINA • TREINAMENTO • SEGURANÇA PÚBLICA" className={`${input} w-full`} />
              </label>
              <label className="block text-white/50 text-xs">Frase de apoio (opcional)
                <input name="sub" defaultValue={b.arte.sub ?? ""} placeholder="OS BASTIDORES DO CRESCIMENTO NO MERCADO JURÍDICO" className={`${input} w-full`} />
              </label>
              <label className="block text-white/50 text-xs">Cenário da arte por IA
                <textarea name="cena" rows={2} defaultValue={b.arte.cena ?? ""} placeholder="Elementos do fundo que combinam com o tema, sem pessoas nem texto" className={area} />
              </label>
            </ProducaoForm>
          )}
        </section>

        {/* ---- Espelho da transmissão ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Espelho da transmissão</h2>
          <p className="text-white/40 text-sm mt-1">
            O roteiro bloco a bloco com as imagens de cada bloco, num link sem login para a equipe técnica acompanhar o
            âncora e os comentaristas. Quem estiver com o link marca o bloco no ar (botões ou PageDown/PageUp) e as outras
            telas seguem em segundos. Para pôr uma imagem num bloco, escolha o bloco em Materiais.
          </p>
          <div className="mt-4 rounded-xl border border-[#2a2a2a] bg-black/30 p-4">
            {ep.roteiro ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm text-white/80 flex-1">
                  <strong className="text-white">Segue o roteiro do apresentador</strong>
                  {ep.roteiro.arquivo && <> ({ep.roteiro.arquivo})</>}: {ep.roteiro.materias.length} blocos, lido em{" "}
                  {quando(ep.roteiro.importado_em)}. Gerar a pauta da IA de novo não apaga o roteiro dele.
                </p>
                <form action={tirarRoteiroAction}>
                  <input type="hidden" name="id" value={ep.id} />
                  <button className={btn2}>Voltar para a pauta da IA</button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-white/60">
                <strong className="text-white">Roteiro do apresentador:</strong> suba o PDF dele em Materiais e clique em
                &quot;Usar como roteiro do espelho&quot;, ou cole o texto abaixo. O espelho passa a ter um bloco por matéria dele, com
                manchete (GC), leitura, comentário, a piada e a pergunta para reflexão, sem a IA mudar o texto.
              </p>
            )}
            <details className="mt-2">
              <summary className="text-xs text-white/40 hover:text-white/70 cursor-pointer">{ep.roteiro ? "Trocar pelo texto colado" : "Colar o texto do roteiro"}</summary>
              <ProducaoForm action={importarRoteiroAction} label="Usar no espelho" pending="Lendo o roteiro (~1 min)..." className="mt-2 space-y-2" buttonClassName={btn2}>
                <input type="hidden" name="id" value={ep.id} />
                <textarea name="texto" rows={8} placeholder="Cole aqui o roteiro inteiro (do Word ou Docs)" className={area} />
              </ProducaoForm>
            </details>
          </div>
          {!b && !ep.roteiro ? (
            <p className="text-white/50 text-sm mt-3">Gere o roteiro ou use o do apresentador primeiro: o espelho sai dos blocos.</p>
          ) : espelho ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs text-gold-300 bg-black/40 border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 break-all">{espelho}</code>
                <CopyButton value={espelho} className={btn2} />
                <a href={espelho} target="_blank" className={btn2}>Abrir ↗</a>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/50">
                <span>Tela para o OBS (fonte de navegador, 1920×1080), só com a imagem do bloco no ar:</span>
                <CopyButton value={`${espelho}/tela`} label="Copiar" className={btn2} />
                <CopyButton value={`${espelho}/tela?fundo=transparente`} label="Copiar com fundo transparente" className={btn2} />
              </div>
              <p className="text-white/50 text-xs">
                {blocos.length} blocos · {noEspelho} {noEspelho === 1 ? "imagem" : "imagens"} no espelho
                {ep.espelho_atual != null && <> · no ar: bloco {ep.espelho_atual + 1}</>}
              </p>
              <details>
                <summary className="text-xs text-white/30 hover:text-white/60 cursor-pointer">Trocar o link</summary>
                <ProducaoForm action={espelhoAction} label="Gerar link novo" pending="Gerando..." className="mt-2" buttonClassName="text-xs border border-red-500/40 text-red-400 hover:bg-red-500/10 rounded-lg px-3 py-1.5">
                  <input type="hidden" name="id" value={ep.id} />
                  <input type="hidden" name="trocar" value="1" />
                  <p className="text-white/30 text-xs mb-2">O link atual para de abrir para quem já tem.</p>
                </ProducaoForm>
              </details>
            </div>
          ) : (
            <ProducaoForm action={espelhoAction} label="Criar link do espelho" pending="Criando..." className="mt-4" buttonClassName="btn-primary px-4 py-2 rounded-lg text-sm font-bold">
              <input type="hidden" name="id" value={ep.id} />
            </ProducaoForm>
          )}
        </section>

        {/* ---- Vídeo gravado (Drive → YouTube) ---- */}
        {gravado && (
          <section className={card}>
            <h2 className="text-white font-bold">Vídeo gravado</h2>
            <p className="text-white/40 text-sm mt-1">
              O episódio pronto fica no Drive. O hub tira frames dele para a arte, sobe o vídeo para o YouTube em
              pedaços, direto do Drive e agendado para estrear em {quandoLongo(ep.inicio)}, e manda cortar no Contenta
              depois da estreia.
            </p>
            {!ep.video_drive_id ? (
              <ProducaoForm action={ligarVideoAction} label="Ligar vídeo" pending="Lendo o vídeo..." className="mt-4 flex flex-wrap items-start gap-2" buttonClassName={btn2}>
                <input type="hidden" name="id" value={ep.id} />
                {arquivos.length > 0 && (
                  <select name="arquivo" defaultValue="" className={`${input} min-w-64`}>
                    <option value="">Da pasta do Drive...</option>
                    {arquivos.map((a) => (
                      <option key={a.id} value={`${a.id}|${a.nome}`}>{a.nome}</option>
                    ))}
                  </select>
                )}
                <input name="link" placeholder="ou cole o link do arquivo no Drive" className={`${input} w-72`} />
                {erroPasta && <p className="text-yellow-300/80 text-xs w-full">{erroPasta}</p>}
              </ProducaoForm>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                <p className="text-white/80">
                  <a href={`https://drive.google.com/file/d/${ep.video_drive_id}/view`} target="_blank" className="text-gold-400 hover:underline">
                    {ep.video_nome ?? ep.video_drive_id}
                  </a>{" "}
                  <span className="text-white/40">{[gb(ep.video_tamanho), min(ep.video_duracao_s)].filter(Boolean).join(" · ")}</span>
                </p>
                <ProducaoForm action={framesAction} label="Tirar frames para a arte" pending="Lendo o vídeo (~1 min)..." buttonClassName={btn2}>
                  <input type="hidden" name="id" value={ep.id} />
                </ProducaoForm>
                <p className="text-white/30 text-xs -mt-2">
                  Os frames aparecem em Materiais; o melhor já vai marcado para a arte. Quem não tiver foto própria a IA tira dos
                  frames.
                </p>

                <div className="border-t border-[#1c1c1c] pt-4">
                  <h3 className="text-white/80 font-semibold">YouTube</h3>
                  {ep.yt_status === "nenhum" &&
                    (ep.status === "confirmado" ? (
                      <ProducaoForm action={enviarVideoAction} label={`Enviar e agendar para ${quandoLongo(ep.inicio)}`} pending="Enviando a primeira parte..." className="mt-2">
                        <input type="hidden" name="id" value={ep.id} />
                      </ProducaoForm>
                    ) : (
                      <p className="text-white/40 mt-1">Confirme o episódio primeiro.</p>
                    ))}
                  {ep.yt_status === "nenhum" && !aprovada && ep.status === "confirmado" && (
                    <p className="text-yellow-300/80 text-xs mt-2">Sem arte escolhida o vídeo sobe sem thumb (dá para pôr depois em “Atualizar”).</p>
                  )}
                  {ep.yt_status === "enviando" && (
                    <div className="mt-2 space-y-1">
                      <div className="h-2 rounded-full bg-[#1c1c1c] overflow-hidden">
                        <div className="h-full bg-gold-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-white/50 text-xs">
                        {pct}% · {gb(up?.offset ?? 0)} de {gb(up?.total ?? 0)} · continua sozinho a cada 5 minutos, pode fechar a página.
                      </p>
                      {ep.yt_erro && <p className="text-yellow-300/80 text-xs break-words">Última falha (tenta de novo): {ep.yt_erro}</p>}
                    </div>
                  )}
                  {ep.yt_status === "erro" && (
                    <div className="mt-2 space-y-2">
                      <p className="text-red-400 text-xs break-words">Envio parado: {ep.yt_erro}</p>
                      <form action={liberarEnvioAction}>
                        <input type="hidden" name="id" value={ep.id} />
                        <button className={btn2}>Tentar de novo</button>
                      </form>
                    </div>
                  )}
                  {ep.yt_status === "enviado" && ep.yt_video_id && (
                    <div className="mt-2 space-y-2">
                      <p>
                        <a href={`https://www.youtube.com/watch?v=${ep.yt_video_id}`} target="_blank" className="text-gold-400 hover:underline">
                          youtube.com/watch?v={ep.yt_video_id}
                        </a>
                        <span className="text-white/30"> · </span>
                        <a href={`https://studio.youtube.com/video/${ep.yt_video_id}/edit`} target="_blank" className="text-white/50 hover:text-white">
                          Abrir no Studio ↗
                        </a>
                      </p>
                      <p className="text-white/40 text-xs">
                        Privado até {quandoLongo(ep.inicio)}, quando o YouTube publica sozinho. Remarcar o episódio muda a data.
                        {ep.cortes_live_id ? (
                          <> Cortes pedidos ao Contenta: acompanhe em <a href="/admin/producao" className="underline">Produção</a>.</>
                        ) : (
                          " Os cortes saem uns 20 minutos depois da estreia."
                        )}
                      </p>
                      <ProducaoForm action={atualizarVideoAction} label="Atualizar título, descrição, data e thumb" pending="Atualizando..." okMessage="Atualizado." buttonClassName={btn2}>
                        <input type="hidden" name="id" value={ep.id} />
                      </ProducaoForm>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ---- Artes ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Artes de divulgação</h2>
          <p className="text-white/40 text-sm mt-1">
            Feed 4:5 (post collab), 9:16 (Story, Reels e TikTok) e 16:9 (thumb da live), com o apresentador e o convidado.
            <strong className="text-white/60"> IA</strong>: o Gemini desenha a cena inteira a partir das fotos (cenário do
            tema, luz nos rostos), como as artes da equipe — confira os rostos e o texto antes de usar.
            <strong className="text-white/60"> Recorte</strong>: a foto real recortada com o texto por cima, rosto 100%
            fiel. A arte escolhida aparece para o convidado baixar no link dele.
          </p>
          <ProducaoForm
            action={gerarArteAction}
            label={artes.length ? "Gerar outra versão" : "Gerar artes"}
            pending="Gerando (até 2 min)..."
            className="mt-4 flex flex-wrap items-start gap-2"
            buttonClassName="px-3 py-1.5 rounded-lg text-xs font-bold border border-gold-500/40 text-gold-400 hover:bg-gold-500/10"
          >
            <input type="hidden" name="id" value={ep.id} />
            <select name="modo" defaultValue="ia" className={input}>
              <option value="ia">IA (cena completa)</option>
              <option value="recorte">Recorte (rosto fiel)</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-white/60 py-1.5">
              <input type="checkbox" name="hoje" value="1" /> Chamada do dia (“HOJE”)
            </label>
            <input name="l1" placeholder={b?.arte.l1 || "Linha 1"} className={`${input} w-56`} />
            <input name="l2" placeholder={b?.arte.l2 || "Linha 2 (destaque)"} className={`${input} w-44`} />
            <input name="l3" placeholder={b?.arte.l3 || "Linha 3 (opcional)"} className={`${input} w-44`} />
          </ProducaoForm>
          <p className="text-white/30 text-xs mt-1">Campos vazios usam a headline do roteiro.</p>

          <div className="mt-5 space-y-5">
            {artes.map((a) => {
              const esc = a.id === ep.arte_id;
              return (
                <div key={a.id} className={`rounded-xl p-3 border ${esc ? "border-emerald-500/40 bg-emerald-500/5" : "border-[#222]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs text-white/60">
                      <span className="text-white/40 uppercase text-[10px] font-bold mr-1">{a.modo === "ia" ? "IA" : "Recorte"}</span>
                      {[a.l1, a.l2, a.l3].filter(Boolean).join(" / ")} · {quando(a.created_at)}
                    </span>
                    {esc ? (
                      <span className="text-emerald-400 text-xs font-bold">✓ Escolhida</span>
                    ) : (
                      <form action={aprovarArteAction}>
                        <input type="hidden" name="id" value={ep.id} />
                        <input type="hidden" name="arte" value={a.id} />
                        <button className={btn2}>Usar esta</button>
                      </form>
                    )}
                  </div>
                  <div className="grid grid-cols-[2fr_1.2fr_1fr] gap-3 items-start">
                    {[
                      { p: a.thumb_path, l: "16:9 live" },
                      { p: a.feed_path, l: "4:5 feed" },
                      { p: a.story_path, l: "9:16 story/TikTok" },
                    ].map((x) => {
                      const u = urls.get(x.p);
                      return u ? (
                        <a key={x.p} href={u} target="_blank" download className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={u} alt={x.l} className="w-full rounded-md bg-black" />
                          <span className="text-[11px] text-white/45">↓ {x.l}</span>
                        </a>
                      ) : null;
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ---- Instagram ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Instagram</h2>
          {!ig ? (
            <p className="text-yellow-300 text-sm mt-2">
              Instagram não conectado. Conecte em <a href="/admin/marketing" className="underline">Marketing</a>.
            </p>
          ) : (
            <>
              <p className="text-white/40 text-sm mt-1">
                Feed sai como collab com {handles.length ? handles.join(", ") : "o convidado (sem @ cadastrado)"}: o
                convite chega no Instagram dele e, aceito, o post aparece nos dois perfis. Story não aceita collab. TikTok:
                baixe a arte 9:16 acima e poste pelo app.
              </p>
              {ep.ig_status !== "nenhum" && (
                <div className="mt-3 text-sm">
                  {ep.ig_status === "agendado" && ep.ig_publicar_em && (
                    <p className="text-violet-300">Programado para {quando(ep.ig_publicar_em)} ({ep.ig_formatos.join(" + ")}).</p>
                  )}
                  {ep.ig_status === "publicando" && <p className="text-sky-400">Publicando...</p>}
                  {ep.ig_status === "erro" && <p className="text-red-400 break-words">Erro: {ep.ig_erro}</p>}
                  {ep.ig_posts.map((p) => (
                    <p key={p.id} className="text-emerald-400">
                      ✓ {p.formato === "feed" ? "Feed" : "Story"} publicado{" "}
                      {p.url && <a href={p.url} target="_blank" className="underline">ver ↗</a>}
                    </p>
                  ))}
                  {(ep.ig_status === "agendado" || ep.ig_status === "erro") && (
                    <form action={instagramResetAction} className="mt-2">
                      <input type="hidden" name="id" value={ep.id} />
                      <button className={btn2}>{ep.ig_status === "erro" ? "Liberar para tentar de novo" : "Cancelar programação"}</button>
                    </form>
                  )}
                </div>
              )}
              {(ep.ig_status === "nenhum" || ep.ig_status === "publicado") && aprovada && ep.status !== "cancelado" && (
                <ProducaoForm
                  action={instagramAction}
                  label="Publicar / programar"
                  pending="Publicando..."
                  okMessage="Feito."
                  className="mt-4 space-y-3"
                >
                  <input type="hidden" name="id" value={ep.id} />
                  <div className="flex flex-wrap gap-4 text-sm text-white/70">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" name="formato" value="feed" defaultChecked={!ep.ig_posts.some((p) => p.formato === "feed")} /> Feed (4:5)
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" name="formato" value="story" defaultChecked={!ep.ig_posts.some((p) => p.formato === "story")} /> Story (9:16)
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" name="collab" value="1" defaultChecked={ep.ig_collab} /> Convidar como collab
                    </label>
                  </div>
                  <textarea name="legenda" rows={6} defaultValue={ep.ig_legenda ?? b?.legenda_ig ?? ""} className={area} placeholder="Legenda do post" />
                  <label className="block text-white/50 text-xs">
                    Quando (vazio = agora)
                    <input type="datetime-local" name="quando" className={`${input} ml-2`} />
                  </label>
                </ProducaoForm>
              )}
              {!aprovada && <p className="text-white/40 text-sm mt-3">Gere e escolha a arte primeiro.</p>}
            </>
          )}
        </section>

        {/* ---- YouTube ---- */}
        {!gravado && (
        <section className={card}>
          <h2 className="text-white font-bold">Live no YouTube</h2>
          {live ? (
            <div className="mt-2 space-y-2 text-sm">
              <p>
                <a href={live} target="_blank" className="text-gold-400 hover:underline break-all">{live}</a>
                <span className="text-white/30"> · </span>
                <a href={`https://studio.youtube.com/video/${ep.yt_broadcast_id}/livestreaming`} target="_blank" className="text-white/50 hover:text-white">
                  Abrir no Studio ↗
                </a>
              </p>
              <ProducaoForm action={liveAction} label="Atualizar título, descrição e horário" pending="Atualizando..." okMessage="Live atualizada." buttonClassName={btn2}>
                <input type="hidden" name="id" value={ep.id} />
              </ProducaoForm>
            </div>
          ) : (
            <>
              <p className="text-white/40 text-sm mt-1">
                Cria a transmissão agendada, pública, com o título e a descrição do roteiro, a thumb 16:9 da arte
                escolhida, na playlist do quadro e ligada ao stream do estúdio (Configurar). O link entra no convite da
                agenda.
              </p>
              {ep.status === "confirmado" ? (
                <ProducaoForm action={liveAction} label="Criar live agendada" pending="Criando..." className="mt-3">
                  <input type="hidden" name="id" value={ep.id} />
                </ProducaoForm>
              ) : (
                <p className="text-white/40 text-sm mt-3">Confirme o episódio primeiro.</p>
              )}
              {!aprovada && ep.status === "confirmado" && <p className="text-yellow-300/80 text-xs mt-2">Sem arte escolhida a live sai sem thumb (dá para pôr depois).</p>}
            </>
          )}
        </section>
        )}

        {/* ---- Agenda e notas ---- */}
        <section className={`${card} grid md:grid-cols-2 gap-6`}>
          <div>
            <h2 className="text-white font-bold">Google Calendar</h2>
            {!gcal ? (
              <p className="text-white/40 text-sm mt-1">
                Não conectado. <a href="/admin/agenda/config" className="text-gold-400 underline">Conectar</a>
              </p>
            ) : (
              <>
                <p className="text-white/40 text-sm mt-1">
                  {ep.gcal_event_id ? "Evento criado; o convidado e a equipe receberam o convite." : "Ainda sem evento (sai ao confirmar)."}
                </p>
                {ep.status === "confirmado" && (
                  <ProducaoForm action={agendaSyncAction} label="Reenviar convite" pending="Sincronizando..." okMessage="Sincronizado." className="mt-3" buttonClassName={btn2}>
                    <input type="hidden" name="id" value={ep.id} />
                  </ProducaoForm>
                )}
              </>
            )}
          </div>
          <div>
            <h2 className="text-white font-bold">Notas da equipe</h2>
            <ProducaoForm action={observacoesAction} label="Salvar" pending="Salvando..." okMessage="Salvo." className="mt-2 space-y-2" buttonClassName={btn2}>
              <input type="hidden" name="id" value={ep.id} />
              <input name="tema" defaultValue={ep.tema ?? ""} placeholder="Tema do episódio" className={`${input} w-full`} />
              <textarea name="observacoes" rows={3} defaultValue={ep.observacoes ?? ""} placeholder="Notas internas" className={area} />
            </ProducaoForm>
          </div>
        </section>

        {eventos.length > 0 && (
          <section>
            <h2 className="text-white/60 font-bold text-sm mb-2">Histórico</h2>
            <ul className="space-y-0.5 text-[11px] text-white/35">
              {eventos.map((e) => (
                <li key={e.id}>
                  {quando(e.created_at)} · <span className="text-white/55">{e.actor.includes("@") ? e.actor.split("@")[0] : e.actor}</span> {e.action}
                  {e.detail && <span className="text-white/30"> — {e.detail}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
