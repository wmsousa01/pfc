import AdminHeader from "@/components/admin/AdminHeader";
import { Flash, MetricasView, abasCampanhas, btnPri, btnSec, card, input } from "@/components/admin/Campanhas";
import { Coluna, EspacoHeader, Quadro, cartao } from "@/components/admin/Espaco";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import {
  CONTA_PENDENTE,
  contasParaEscolher,
  googleCampanhas,
  isGoogleAdsConfigured,
  type ContaGoogle,
  type GoogleCampanha,
} from "@/lib/campanhas/google-ads";
import { metaCampanhas, type MetaCampanha } from "@/lib/campanhas/meta-ads";
import { MODELOS } from "@/lib/campanhas/modelos";
import { OBJETIVOS, listEntregas, listEstrategias, reais, type EstrategiaStatus, type Metricas } from "@/lib/campanhas/store";
import { isMetaConfigured } from "@/lib/social/meta";
import { listConnections } from "@/lib/social/store";
import { criarEstrategiaAction, desconectarAdsAction, escolherContaGoogleAction, sincronizarAction } from "./actions";

export const dynamic = "force-dynamic";

function soma(ms: (Metricas | null)[]): Metricas {
  const out: Metricas = {};
  for (const m of ms) {
    if (!m || m.erro) continue;
    out.gasto = (out.gasto ?? 0) + (m.gasto ?? 0);
    out.impressoes = (out.impressoes ?? 0) + (m.impressoes ?? 0);
    out.cliques = (out.cliques ?? 0) + (m.cliques ?? 0);
  }
  return out;
}

function diasPara(iso: string | null): number | null {
  return iso ? Math.floor((new Date(iso).getTime() - Date.now()) / 86_400_000) : null;
}

export default async function CampanhasPage({ searchParams }: { searchParams: { ok?: string; erro?: string; view?: string } }) {
  await requireAdmin();
  const view = searchParams.view === "gerenciadores" || searchParams.view === "contas" ? searchParams.view : "estrategias";

  const [estrategias, entregas, conexoes] = await Promise.all([
    listEstrategias(),
    listEntregas().catch(() => []),
    listConnections().catch(() => []),
  ]);
  const metaAds = conexoes.find((c) => c.platform === "meta_ads" && c.status === "ativa");
  const googleConectado = conexoes.find((c) => c.platform === "google_ads" && c.status === "ativa");
  // Acesso autorizado, mas a conta do PFC ainda não foi escolhida entre as do login.
  const googlePendente = googleConectado?.external_account_id === CONTA_PENDENTE;
  const googleAds = googlePendente ? undefined : googleConectado;
  const contasGoogle: ContaGoogle[] = googlePendente ? await contasParaEscolher() : [];
  const metaExpira = metaAds ? diasPara(metaAds.token_expires_at) : null;

  let metaCamp: MetaCampanha[] = [];
  let metaErro: string | null = null;
  // As campanhas das contas só são lidas na aba em que aparecem.
  if (metaAds && view === "gerenciadores") {
    try {
      metaCamp = await metaCampanhas();
    } catch (e) {
      metaErro = e instanceof Error ? e.message : String(e);
    }
  }
  let googleCamp: GoogleCampanha[] = [];
  let googleErro: string | null = null;
  if (googleAds && view === "gerenciadores") {
    try {
      googleCamp = await googleCampanhas();
    } catch (e) {
      googleErro = e instanceof Error ? e.message : String(e);
    }
  }

  const schemaMissing = estrategias === null;
  const contasAlerta = !metaAds || !googleAds || googlePendente || (metaExpira !== null && metaExpira <= 7);

  const COLUNAS: { s: EstrategiaStatus; titulo: string; vazio: string }[] = [
    { s: "rascunho", titulo: "Rascunhos", vazio: "Nenhum rascunho." },
    { s: "ativa", titulo: "Ativas", vazio: "Nenhuma estratégia ativa." },
    { s: "pausada", titulo: "Pausadas", vazio: "Nenhuma pausada." },
    { s: "encerrada", titulo: "Encerradas", vazio: "Nenhuma encerrada." },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Campanhas"
          titulo="Campanhas pagas"
          extra={
            <div className="flex flex-wrap gap-1.5">
              {[
                { l: "Meta Ads", on: !!metaAds },
                { l: "Google Ads", on: !!googleAds },
              ].map((c) => (
                <a
                  key={c.l}
                  href="/admin/campanhas?view=contas"
                  className={`text-[11px] px-2 py-1 rounded-md border ${
                    c.on ? "border-emerald-500/25 text-emerald-300/90" : "border-[#2a2a2a] text-white/35"
                  }`}
                >
                  {c.on ? "●" : "○"} {c.l}
                </a>
              ))}
            </div>
          }
          acoes={
            <ProducaoForm
              action={sincronizarAction}
              label="Atualizar métricas"
              pending="Lendo as redes…"
              okMessage="Métricas atualizadas."
              buttonClassName="text-sm border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5"
            />
          }
          abas={abasCampanhas(view, contasAlerta)}
        />

        <div className="mt-4">
          <Flash ok={searchParams.ok} erro={searchParams.erro} />
          {schemaMissing && (
            <div className="p-3 rounded-lg border border-gold-500/30 bg-gold-500/10 text-gold-300 text-sm">
              Rode <code>supabase/020_campanhas.sql</code> no SQL Editor do Supabase para ativar esta área.
            </div>
          )}
        </div>

        {/* ---- Estratégias ---- */}
        {view === "estrategias" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-white/35 text-xs max-w-3xl">
                Cada estratégia recebe os criativos, a IA analisa, e o anúncio sobe pausado para a equipe ativar no
                gerenciador. Vira uma campanha + um conjunto na Meta quando o primeiro criativo sobe.
              </p>
              <form action={criarEstrategiaAction} className="flex flex-wrap items-center gap-2">
                <select name="modelo" className={input} defaultValue="sem-enrolacao">
                  {Object.entries(MODELOS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                  <option value="">Em branco</option>
                </select>
                <button className={btnPri} disabled={schemaMissing}>Nova estratégia</button>
              </form>
            </div>

            {(estrategias ?? []).length === 0 && !schemaMissing && (
              <p className="text-white/40 text-sm mt-3">Nenhuma estratégia ainda. Comece por um modelo: ele vem dos playbooks em docs/.</p>
            )}

            <Quadro
              colunas={COLUNAS.map((c) => ({
                titulo: c.titulo,
                count: (estrategias ?? []).filter((e) => e.status === c.s).length,
              }))}
            >
              {COLUNAS.map((col) => {
                const lista = (estrategias ?? []).filter((e) => e.status === col.s);
                return (
                  <Coluna key={col.s} titulo={col.titulo} count={lista.length} vazio={col.vazio}>
                    {lista.map((e) => {
                      const ents = entregas.filter((x) => x.estrategia_id === e.id);
                      const noAr = ents.filter((x) => x.status === "no_gerenciador").length;
                      const notas = ents.map((x) => x.analise_nota).filter((n): n is number => n !== null);
                      const total = soma(ents.map((x) => x.metrics));
                      return (
                        <a key={e.id} href={`/admin/campanhas/${e.id}`} className={cartao}>
                          <p className="text-white text-[13px] font-medium leading-snug line-clamp-2">{e.nome}</p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {e.plataformas.map((p) => (
                              <span
                                key={p}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  p === "meta" ? "border-blue-500/30 bg-blue-500/10 text-blue-300" : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                                }`}
                              >
                                {p === "meta" ? "Meta" : "Google"}
                              </span>
                            ))}
                            <span className="text-[10px] px-1.5 py-0.5 rounded border border-white/10 text-white/50">
                              {OBJETIVOS[e.objetivo].label}
                            </span>
                          </div>
                          <p className="text-white/40 text-[11px] mt-1.5">
                            {reais(e.orcamento_diario)}/dia · {e.geo_raio_km} km · {e.idade_min}–{e.idade_max} anos
                          </p>
                          {e.mensagem && <p className="text-white/55 text-xs mt-1.5 line-clamp-2">{e.mensagem}</p>}
                          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-white/50">
                            <span><b className="text-white/80">{ents.length}</b> criativos</span>
                            <span><b className="text-white/80">{noAr}</b> no gerenciador</span>
                            {notas.length > 0 && (
                              <span>nota <b className="text-white/80">{Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)}</b></span>
                            )}
                          </div>
                          {total.gasto !== undefined && <MetricasView m={total} />}
                        </a>
                      );
                    })}
                  </Coluna>
                );
              })}
            </Quadro>
          </section>
        )}

        {/* ---- O que está nos gerenciadores ---- */}
        {view === "gerenciadores" && (
          <section className={`${card} mt-4`}>
            <h2 className="text-white font-bold">Nos gerenciadores · últimos 30 dias</h2>
            <p className="text-white/40 text-xs mt-0.5">Tudo o que está nas contas, inclusive o que não nasceu aqui.</p>
            {!metaAds && !googleAds && (
              <p className="text-white/40 text-sm mt-3">
                Nenhuma conta de anúncios conectada. <a href="/admin/campanhas?view=contas" className="text-gold-400">Conectar →</a>
              </p>
            )}
            {metaErro && <p className="text-red-400 text-xs mt-3 break-words">Meta: {metaErro}</p>}
            {googleErro && <p className="text-red-400 text-xs mt-3 break-words">Google: {googleErro}</p>}
            {(metaAds || googleAds) && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/40 text-left">
                      <th className="py-2 pr-3 font-medium">Rede</th>
                      <th className="py-2 pr-3 font-medium">Campanha</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Números</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metaCamp.map((c) => (
                      <tr key={`m-${c.id}`} className="border-t border-[#1c1c1c] text-white/80 align-top">
                        <td className="py-2.5 pr-3 text-white/50">Meta</td>
                        <td className="py-2.5 pr-3 min-w-[200px]">{c.nome}<div className="text-white/30">{c.objetivo}</div></td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{c.status}</td>
                        <td className="py-2.5 pr-3"><MetricasView m={c.m} /></td>
                      </tr>
                    ))}
                    {googleCamp.map((c) => (
                      <tr key={`g-${c.id}`} className="border-t border-[#1c1c1c] text-white/80 align-top">
                        <td className="py-2.5 pr-3 text-white/50">Google</td>
                        <td className="py-2.5 pr-3 min-w-[200px]">{c.nome}<div className="text-white/30">{c.tipo} · id {c.id}</div></td>
                        <td className="py-2.5 pr-3 whitespace-nowrap">{c.status}</td>
                        <td className="py-2.5 pr-3"><MetricasView m={c.m} /></td>
                      </tr>
                    ))}
                    {metaCamp.length + googleCamp.length === 0 && !metaErro && !googleErro && (
                      <tr><td colSpan={4} className="py-3 text-white/40">Nenhuma campanha nas contas.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ---- Contas ---- */}
        {view === "contas" && (
          <section className="grid md:grid-cols-2 gap-4 mt-4 max-w-5xl">
            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-white font-bold">Meta Ads</h2>
                {metaAds ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">Conectada</span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-white/40">Desconectada</span>
                )}
              </div>
              {metaAds ? (
                <>
                  <p className="text-white/70 text-sm mt-2">{metaAds.account_name ?? metaAds.external_account_id}</p>
                  {metaExpira !== null && (
                    <p className={`text-xs mt-1 ${metaExpira <= 7 ? "text-red-400" : "text-white/40"}`}>
                      O token vence em {Math.max(0, metaExpira)} dias: reconecte antes disso.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-white/40 text-xs mt-2 leading-relaxed">
                  Usa o mesmo login da Meta da publicação orgânica. A configuração do login (Facebook Login for Business) precisa
                  incluir <code>ads_management</code> e <code>ads_read</code>; depois é só reconectar.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {isMetaConfigured() ? (
                  <a href="/api/social/meta/oauth" className={btnPri}>{metaAds ? "Reconectar" : "Conectar Meta"}</a>
                ) : (
                  <span className="text-xs text-white/30">META_APP_ID ausente.</span>
                )}
                {metaAds && (
                  <form action={desconectarAdsAction}>
                    <input type="hidden" name="platform" value="meta_ads" />
                    <button className={btnSec}>Desconectar anúncios</button>
                  </form>
                )}
              </div>
            </div>

            <div className={card}>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-white font-bold">Google Ads</h2>
                {googlePendente ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gold-500/10 border-gold-500/30 text-gold-400">Escolher conta</span>
                ) : googleAds ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">Conectada · leitura</span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-white/40">Desconectada</span>
                )}
              </div>
              {googlePendente ? (
                <form action={escolherContaGoogleAction} className="mt-3 space-y-2">
                  <p className="text-white/60 text-xs">O login enxerga várias contas. Qual é a do Fora da Caixa?</p>
                  <select name="conta" required className={`${input} w-full`} defaultValue="">
                    <option value="" disabled>Escolha a conta</option>
                    {contasGoogle.map((c) => (
                      <option key={c.id} value={c.id} disabled={c.mcc}>
                        {c.nome} · {c.id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                        {c.mcc ? " · MCC (sem métricas próprias)" : c.moeda ? ` · ${c.moeda}` : ""}
                      </option>
                    ))}
                  </select>
                  <button className={btnPri}>Usar esta conta</button>
                </form>
              ) : googleAds ? (
                <p className="text-white/70 text-sm mt-2">{googleAds.account_name ?? googleAds.external_account_id}</p>
              ) : (
                <p className="text-white/40 text-xs mt-2 leading-relaxed">
                  Só leitura nesta fase: o anúncio é montado no Google Ads e o id dele é colado na entrega para trazer as métricas.
                  Precisa da Google Ads API ativada (nível Explorer ou acima) no projeto do Google Cloud e do redirect{" "}
                  <code>/api/campanhas/google/oauth/callback</code> no client OAuth.
                </p>
              )}
              <div className="flex gap-2 mt-3">
                {isGoogleAdsConfigured() ? (
                  <a href="/api/campanhas/google/oauth" className={btnPri}>{googleAds ? "Reconectar" : "Conectar Google Ads"}</a>
                ) : (
                  <span className="text-xs text-white/30">GOOGLE_CLIENT_ID ausente.</span>
                )}
                {googleConectado && (
                  <form action={desconectarAdsAction}>
                    <input type="hidden" name="platform" value="google_ads" />
                    <button className={btnSec}>Desconectar</button>
                  </form>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
