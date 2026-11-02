import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import CopyButton from "@/components/CopyButton";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { pautaTexto } from "@/lib/agenda/briefing";
import { youtubeUrl } from "@/lib/agenda/fluxo";
import { calendarAccount } from "@/lib/agenda/gcal";
import {
  TZ,
  brtDate,
  convidadosDe,
  db,
  getEpisodio,
  linkConvidado,
  quandoLongo,
  type Arte,
  type Evento,
} from "@/lib/agenda/store";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { signedUrls } from "@/lib/producao/store";
import { activeConnection } from "@/lib/social/store";
import {
  addConvidadoAction,
  agendaSyncAction,
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
  perfilIgAction,
  realizadoAction,
  remarcarAction,
  removerConvidadoAction,
  salvarBriefingAction,
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

  const [convidados, { data: arteRows }, { data: evRows }, gcal, ig] = await Promise.all([
    convidadosDe(ep.id),
    db().from("agenda_artes").select("*").eq("episodio_id", ep.id).order("created_at", { ascending: false }).limit(12),
    db().from("agenda_eventos").select("*").eq("episodio_id", ep.id).order("created_at", { ascending: false }).limit(40),
    calendarAccount(),
    activeConnection("instagram").catch(() => null),
  ]);
  const artes = (arteRows ?? []) as Arte[];
  const eventos = (evRows ?? []) as Evento[];
  const urls = await signedUrls([
    ...artes.flatMap((a) => [a.thumb_path, a.feed_path, a.story_path]),
    ...convidados.map((c) => c.foto_path).filter((p): p is string => !!p),
  ]);
  const aprovada = artes.find((a) => a.id === ep.arte_id) ?? null;
  const b = ep.briefing;
  const live = youtubeUrl(ep);
  const ativo = ep.status === "solicitado" || ep.status === "confirmado";
  const handles = convidados.filter((c) => c.instagram).map((c) => `@${c.instagram}`);
  const st = STATUS_EP[ep.status];

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
              </ProducaoForm>
            </details>
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
            </ProducaoForm>
          )}
        </section>

        {/* ---- Artes ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Artes de divulgação</h2>
          <p className="text-white/40 text-sm mt-1">
            Feed 4:5 (post collab), 9:16 (Story, Reels e TikTok) e 16:9 (thumb da live). O convidado sai recortado da
            foto dele; sem foto, entra a do Instagram. A arte escolhida aparece para o convidado baixar no link dele.
          </p>
          <ProducaoForm
            action={gerarArteAction}
            label={artes.length ? "Gerar outra versão" : "Gerar artes"}
            pending="Gerando (~40 s)..."
            className="mt-4 flex flex-wrap items-start gap-2"
            buttonClassName="px-3 py-1.5 rounded-lg text-xs font-bold border border-gold-500/40 text-gold-400 hover:bg-gold-500/10"
          >
            <input type="hidden" name="id" value={ep.id} />
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
