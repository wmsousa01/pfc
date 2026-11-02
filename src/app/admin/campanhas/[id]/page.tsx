import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import {
  AnaliseView,
  MetricasView,
  Miniatura,
  Nota,
  STATUS_ENTREGA,
  STATUS_ESTRATEGIA,
  SubNav,
  btnPri,
  btnSec,
  card,
  input,
} from "@/components/admin/Campanhas";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { metaAdUrl } from "@/lib/campanhas/meta-ads";
import {
  CTAS,
  OBJETIVOS,
  getCriativo,
  getEstrategia,
  listCriativos,
  listEntregas,
  previews,
  type Criativo,
  type Entrega,
  type EstrategiaStatus,
} from "@/lib/campanhas/store";
import { listConnections } from "@/lib/social/store";
import {
  analisarEntregaAction,
  aprovarEntregaAction,
  copyIaAction,
  entregarAction,
  excluirEstrategiaAction,
  removerEntregaAction,
  salvarEntregaAction,
  salvarEstrategiaAction,
  statusEstrategiaAction,
  subirMetaAction,
  voltarRascunhoAction,
} from "../actions";

export const dynamic = "force-dynamic";
// Análise de vídeo e subida na Meta (vídeo processando) rodam na action.
export const maxDuration = 300;

const label = "block text-[11px] font-bold uppercase tracking-wide text-white/40 mb-1";
const area = `${input} w-full text-sm`;

export default async function EstrategiaPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const e = await getEstrategia(params.id);
  if (!e) notFound();

  const [entregas, criativos, conexoes] = await Promise.all([
    listEntregas(e.id),
    listCriativos(),
    listConnections().catch(() => []),
  ]);
  const porId = new Map<string, Criativo>(criativos.map((c) => [c.id, c]));
  // Arquivado sai da biblioteca, mas continua aparecendo onde já foi entregue.
  for (const en of entregas) {
    if (porId.has(en.criativo_id)) continue;
    const c = await getCriativo(en.criativo_id);
    if (c) porId.set(c.id, c);
  }
  const thumbs = await previews(Array.from(porId.values()));
  const act = conexoes.find((c) => c.platform === "meta_ads" && c.status === "ativa")?.external_account_id ?? null;

  // Pronto para subir primeiro, depois as melhores notas.
  const ordem: Record<string, number> = { erro: 0, enviando: 1, aprovado: 2, rascunho: 3, no_gerenciador: 4 };
  const lista = [...entregas].sort(
    (a, b) => ordem[a.status] - ordem[b.status] || (b.analise_nota ?? -1) - (a.analise_nota ?? -1)
  );
  // Já entregues ficam fora da escolha; a mesma peça pode ir para a outra rede pelo seletor.
  const entregues = new Set(entregas.map((x) => `${x.criativo_id}|${x.plataforma}`));
  const disponiveis = criativos.filter((c) => e.plataformas.some((p) => !entregues.has(`${c.id}|${p}`)));

  const EntregaCard = ({ en }: { en: Entrega }) => {
    const c = porId.get(en.criativo_id);
    const nota = en.analise_nota ?? c?.analise_nota ?? null;
    const travado = !!en.meta_creative_id;
    return (
      <div className="flex gap-4 py-4 border-b border-[#1c1c1c] last:border-0">
        {c && <Miniatura c={c} url={thumbs.get(c.id)} className="w-20" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white text-sm font-semibold line-clamp-1">{c?.nome ?? "criativo removido"}</span>
            <span className="text-[11px] text-white/40 border border-white/10 rounded-full px-2 py-0.5">{en.plataforma === "meta" ? "Meta" : "Google"}</span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_ENTREGA[en.status].cls}`}>
              {STATUS_ENTREGA[en.status].label}
            </span>
            <Nota n={nota} titulo={en.analise_nota !== null ? "Nota para esta estratégia" : "Nota genérica da biblioteca"} />
          </div>
          {en.erro && <p className="text-red-400 text-xs mt-1 break-words">{en.erro}</p>}
          <MetricasView m={en.metrics} quando={en.metrics_at} />

          <ProducaoForm action={salvarEntregaAction} label="Salvar" pending="Salvando…" okMessage="Salvo." className="mt-3 space-y-2" buttonClassName={btnSec}>
            <input type="hidden" name="id" value={en.id} />
            <div className="grid sm:grid-cols-[1fr_2fr] gap-2">
              <select name="angulo" defaultValue={en.angulo ?? ""} className={input}>
                <option value="">Sem ângulo</option>
                {e.angulos.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <input name="headline" defaultValue={en.headline} maxLength={40} placeholder="Headline (até 40)" disabled={travado} className={input} />
            </div>
            <textarea name="texto" defaultValue={en.texto} rows={3} placeholder="Texto principal do anúncio" disabled={travado} className={area} />
            {en.plataforma === "google" && (
              <input name="google_ad_id" defaultValue={en.google_ad_id ?? ""} placeholder="Id do anúncio no Google Ads (liga as métricas)" className={`${input} w-full`} />
            )}
          </ProducaoForm>

          <div className="flex flex-wrap items-start gap-2 mt-2">
            <ProducaoForm action={analisarEntregaAction} label="Analisar para esta estratégia" pending="Analisando… (vídeo leva ~1 min)" buttonClassName={btnSec}>
              <input type="hidden" name="id" value={en.id} />
            </ProducaoForm>
            {!travado && (
              <ProducaoForm action={copyIaAction} label="Copy com IA" pending="Escrevendo…" buttonClassName={btnSec}>
                <input type="hidden" name="id" value={en.id} />
              </ProducaoForm>
            )}
            {en.status === "rascunho" && (
              <form action={aprovarEntregaAction}>
                <input type="hidden" name="id" value={en.id} />
                <button className={btnPri}>Aprovar</button>
              </form>
            )}
            {en.plataforma === "meta" && (en.status === "aprovado" || en.status === "erro" || en.status === "enviando") && (
              <ProducaoForm
                action={subirMetaAction}
                label={en.status === "enviando" || en.meta_video_id ? "Continuar subida" : "Subir na Meta (pausado)"}
                pending="Subindo… (vídeo pode levar 2 min)"
                okMessage="No Gerenciador, pausado. Confira e ative por lá."
                buttonClassName={btnPri}
              >
                <input type="hidden" name="id" value={en.id} />
              </ProducaoForm>
            )}
            {en.meta_ad_id && (
              <a href={metaAdUrl(act, en.meta_ad_id)} target="_blank" className={btnSec}>Abrir no Gerenciador ↗</a>
            )}
            {(en.status === "aprovado" || en.status === "erro") && !en.meta_ad_id && (
              <form action={voltarRascunhoAction}>
                <input type="hidden" name="id" value={en.id} />
                <button className={btnSec}>Voltar a rascunho</button>
              </form>
            )}
            <form action={removerEntregaAction}>
              <input type="hidden" name="id" value={en.id} />
              <button className="text-xs text-white/30 hover:text-red-400 px-2 py-1.5">Tirar da estratégia</button>
            </form>
          </div>
          {en.aprovado_por && <p className="text-[11px] text-white/30 mt-1">Aprovado por {en.aprovado_por.split("@")[0]}</p>}
          {(en.analise ?? c?.analise) && <AnaliseView a={(en.analise ?? c?.analise)!} />}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div>
          <SubNav atual="estrategias" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <a href="/admin/campanhas" className="text-white/40 hover:text-white text-xs">← Estratégias</a>
              <h1 className="text-2xl font-bold text-white mt-1">{e.nome}</h1>
              <p className="text-white/40 text-sm mt-1">
                {OBJETIVOS[e.objetivo].label} — {OBJETIVOS[e.objetivo].detalhe}
              </p>
              {(e.meta_campaign_id || e.meta_adset_id) && (
                <p className="text-white/30 text-xs mt-1">
                  Na Meta: campanha {e.meta_campaign_id} · conjunto {e.meta_adset_id ?? "—"} (pausados)
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${STATUS_ESTRATEGIA[e.status].cls}`}>{STATUS_ESTRATEGIA[e.status].label}</span>
              <form action={statusEstrategiaAction} className="flex gap-1">
                <input type="hidden" name="id" value={e.id} />
                <select name="status" defaultValue={e.status} className={input}>
                  {(Object.keys(STATUS_ESTRATEGIA) as EstrategiaStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_ESTRATEGIA[s].label}</option>
                  ))}
                </select>
                <button className={btnSec}>Mudar</button>
              </form>
            </div>
          </div>
        </div>

        {/* ---- Briefing ---- */}
        <details className={card} open={entregas.length === 0}>
          <summary className="cursor-pointer text-white font-bold select-none">Briefing da estratégia</summary>
          <ProducaoForm action={salvarEstrategiaAction} label="Salvar briefing" pending="Salvando…" okMessage="Briefing salvo." className="mt-4 space-y-4">
            <input type="hidden" name="id" value={e.id} />
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className={label}>Nome</label>
                <input name="nome" defaultValue={e.nome} className={area} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Objetivo</label>
                  <select name="objetivo" defaultValue={e.objetivo} className={area}>
                    {Object.entries(OBJETIVOS).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Redes</label>
                  <div className="flex gap-3 pt-1.5">
                    {(["meta", "google"] as const).map((p) => (
                      <label key={p} className="flex items-center gap-1.5 text-xs text-white/80">
                        <input type="checkbox" name="plataformas" value={p} defaultChecked={e.plataformas.includes(p)} className="accent-gold-500" />
                        {p === "meta" ? "Meta" : "Google"}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className={label}>Público</label>
                <textarea name="publico" defaultValue={e.publico} rows={2} className={area} />
              </div>
              <div>
                <label className={label}>Oferta</label>
                <textarea name="oferta" defaultValue={e.oferta} rows={2} className={area} />
              </div>
              <div>
                <label className={label}>Mensagem-chave</label>
                <textarea name="mensagem" defaultValue={e.mensagem} rows={2} className={area} />
              </div>
              <div>
                <label className={label}>Ângulos (um por linha)</label>
                <textarea name="angulos" defaultValue={e.angulos.join("\n")} rows={3} className={area} />
              </div>
              <div>
                <label className={label}>Link de destino (com UTM)</label>
                <input name="link" defaultValue={e.link ?? ""} placeholder="https://…" className={area} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Botão</label>
                  <select name="cta" defaultValue={e.cta} className={area}>
                    {Object.entries(CTAS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={label}>Orçamento/dia (R$)</label>
                  <input name="orcamento" defaultValue={(e.orcamento_diario / 100).toFixed(2).replace(".", ",")} className={area} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={label}>Raio (km)</label>
                  <input name="geo_raio_km" type="number" min={1} max={80} defaultValue={e.geo_raio_km} className={area} />
                </div>
                <div>
                  <label className={label}>Idade mín.</label>
                  <input name="idade_min" type="number" min={18} max={65} defaultValue={e.idade_min} className={area} />
                </div>
                <div>
                  <label className={label}>Idade máx.</label>
                  <input name="idade_max" type="number" min={18} max={65} defaultValue={e.idade_max} className={area} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={label}>Início</label>
                  <input name="inicio" type="date" defaultValue={e.inicio ?? ""} className={area} />
                </div>
                <div>
                  <label className={label}>Fim</label>
                  <input name="fim" type="date" defaultValue={e.fim ?? ""} className={area} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className={label}>KPI e meta</label>
                <input name="kpi" defaultValue={e.kpi} placeholder="Ex.: custo por lead abaixo de R$ 15" className={area} />
              </div>
            </div>
            <p className="text-white/30 text-xs">O raio parte do centro de Mogi Guaçu. Público definido pela equipe, sem o Advantage+ expandir para fora da região.</p>
          </ProducaoForm>
          <form action={excluirEstrategiaAction} className="mt-4 pt-4 border-t border-[#1c1c1c]">
            <input type="hidden" name="id" value={e.id} />
            <button className="text-xs text-white/30 hover:text-red-400">Excluir estratégia (os anúncios já criados ficam no gerenciador)</button>
          </form>
        </details>

        {/* ---- Entregar criativos ---- */}
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-white font-bold">Entregar criativos</h2>
              <p className="text-white/40 text-xs mt-0.5">
                Escolha na biblioteca as peças desta estratégia. Faltou peça?{" "}
                <a href="/admin/campanhas/criativos" className="text-gold-400 hover:text-gold-300">Importe do Drive, suba ou gere uma estática</a>.
              </p>
            </div>
          </div>
          {disponiveis.length === 0 ? (
            <p className="text-white/40 text-sm mt-4">A biblioteca está vazia.</p>
          ) : (
            <ProducaoForm action={entregarAction} label="Entregar à estratégia" pending="Entregando…" okMessage="Entregue." className="mt-4">
              <input type="hidden" name="estrategia_id" value={e.id} />
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {disponiveis.map((c) => (
                  <label key={c.id} className="relative cursor-pointer group">
                    <input type="checkbox" name="criativos" value={c.id} className="peer absolute top-2 left-2 z-10 accent-gold-500" />
                    <div className="rounded-xl border border-[#222] peer-checked:border-gold-500 p-2 transition-colors">
                      <Miniatura c={c} url={thumbs.get(c.id)} className="w-full" />
                      <p className="text-[11px] text-white/70 mt-1.5 line-clamp-2 leading-snug">{c.nome}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Nota n={c.analise_nota} />
                        {c.formato && <span className="text-[10px] text-white/40">{c.formato}</span>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
                <select name="plataforma" defaultValue={e.plataformas[0]} className={input}>
                  {e.plataformas.map((p) => (
                    <option key={p} value={p}>{p === "meta" ? "Meta (sobe daqui)" : "Google (montar no gerenciador)"}</option>
                  ))}
                </select>
                <select name="angulo" className={input} defaultValue="">
                  <option value="">Sem ângulo</option>
                  {e.angulos.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </ProducaoForm>
          )}
        </section>

        {/* ---- Entregas ---- */}
        <section className={card}>
          <h2 className="text-white font-bold">Criativos desta estratégia ({entregas.length})</h2>
          <p className="text-white/40 text-xs mt-0.5">
            Fluxo: analisar para a estratégia → ajustar a copy → aprovar → subir na Meta pausado → ativar no Gerenciador.
          </p>
          {lista.length === 0 ? (
            <p className="text-white/40 text-sm mt-4">Nenhum criativo entregue ainda.</p>
          ) : (
            <div className="mt-2">
              {lista.map((en) => (
                <EntregaCard key={en.id} en={en} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
