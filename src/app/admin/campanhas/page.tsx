import AdminHeader from "@/components/admin/AdminHeader";
import { Flash, MetricasView, STATUS_ESTRATEGIA, SubNav, btnPri, btnSec, card, input } from "@/components/admin/Campanhas";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { requireAdmin } from "@/lib/auth";
import { googleCampanhas, isGoogleAdsConfigured, type GoogleCampanha } from "@/lib/campanhas/google-ads";
import { metaCampanhas, type MetaCampanha } from "@/lib/campanhas/meta-ads";
import { MODELOS } from "@/lib/campanhas/modelos";
import { OBJETIVOS, listEntregas, listEstrategias, reais, type Metricas } from "@/lib/campanhas/store";
import { isMetaConfigured } from "@/lib/social/meta";
import { listConnections } from "@/lib/social/store";
import { criarEstrategiaAction, desconectarAdsAction, sincronizarAction } from "./actions";

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

export default async function CampanhasPage({ searchParams }: { searchParams: { ok?: string; erro?: string } }) {
  await requireAdmin();

  const [estrategias, entregas, conexoes] = await Promise.all([
    listEstrategias(),
    listEntregas().catch(() => []),
    listConnections().catch(() => []),
  ]);
  const metaAds = conexoes.find((c) => c.platform === "meta_ads" && c.status === "ativa");
  const googleAds = conexoes.find((c) => c.platform === "google_ads" && c.status === "ativa");
  const metaExpira = metaAds ? diasPara(metaAds.token_expires_at) : null;

  let metaCamp: MetaCampanha[] = [];
  let metaErro: string | null = null;
  if (metaAds) {
    try {
      metaCamp = await metaCampanhas();
    } catch (e) {
      metaErro = e instanceof Error ? e.message : String(e);
    }
  }
  let googleCamp: GoogleCampanha[] = [];
  let googleErro: string | null = null;
  if (googleAds) {
    try {
      googleCamp = await googleCampanhas();
    } catch (e) {
      googleErro = e instanceof Error ? e.message : String(e);
    }
  }

  const schemaMissing = estrategias === null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Campanhas pagas</h1>
            <p className="text-white/40 text-sm mt-1">
              Estratégias do Fora da Caixa na Meta e no Google: cada uma recebe os criativos, a IA analisa, e o anúncio sobe
              pausado para a equipe ativar no gerenciador.
            </p>
          </div>
          <ProducaoForm
            action={sincronizarAction}
            label="Atualizar métricas"
            pending="Lendo as redes…"
            okMessage="Métricas atualizadas."
            buttonClassName="text-sm border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5"
          />
        </div>

        <div className="-mb-2">
          <SubNav atual="estrategias" />
          <Flash ok={searchParams.ok} erro={searchParams.erro} />
        </div>

        {schemaMissing && (
          <div className="p-4 rounded-xl border border-gold-500/30 bg-gold-500/10 text-gold-300 text-sm">
            Rode <code>supabase/020_campanhas.sql</code> no SQL Editor do Supabase para ativar esta área.
          </div>
        )}

        {/* ---- Contas ---- */}
        <section className="grid md:grid-cols-2 gap-4">
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
              {googleAds ? (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">Conectada · leitura</span>
              ) : (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-white/40">Desconectada</span>
              )}
            </div>
            {googleAds ? (
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
              {googleAds && (
                <form action={desconectarAdsAction}>
                  <input type="hidden" name="platform" value="google_ads" />
                  <button className={btnSec}>Desconectar</button>
                </form>
              )}
            </div>
          </div>
        </section>

        {/* ---- Estratégias ---- */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <div>
              <h2 className="text-white font-bold text-lg">Estratégias</h2>
              <p className="text-white/40 text-xs mt-0.5">Cada estratégia vira uma campanha + um conjunto na Meta quando o primeiro criativo sobe.</p>
            </div>
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
            <p className="text-white/40 text-sm">Nenhuma estratégia ainda. Comece por um modelo: ele vem dos playbooks em docs/.</p>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {(estrategias ?? []).map((e) => {
              const ents = entregas.filter((x) => x.estrategia_id === e.id);
              const noAr = ents.filter((x) => x.status === "no_gerenciador").length;
              const notas = ents.map((x) => x.analise_nota).filter((n): n is number => n !== null);
              const total = soma(ents.map((x) => x.metrics));
              const st = STATUS_ESTRATEGIA[e.status];
              return (
                <a key={e.id} href={`/admin/campanhas/${e.id}`} className={`${card} block hover:border-gold-500/40 transition-colors`}>
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-white font-semibold leading-snug">{e.nome}</h3>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-white/40 text-xs mt-1">
                    {OBJETIVOS[e.objetivo].label} · {e.plataformas.map((p) => (p === "meta" ? "Meta" : "Google")).join(" + ")} ·{" "}
                    {reais(e.orcamento_diario)}/dia · {e.geo_raio_km} km · {e.idade_min}–{e.idade_max} anos
                  </p>
                  {e.mensagem && <p className="text-white/60 text-sm mt-2 line-clamp-2">{e.mensagem}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-white/50">
                    <span><b className="text-white/80">{ents.length}</b> criativos</span>
                    <span><b className="text-white/80">{noAr}</b> no gerenciador</span>
                    {notas.length > 0 && (
                      <span>nota média <b className="text-white/80">{Math.round(notas.reduce((a, b) => a + b, 0) / notas.length)}</b></span>
                    )}
                  </div>
                  {total.gasto !== undefined && <MetricasView m={total} />}
                </a>
              );
            })}
          </div>
        </section>

        {/* ---- O que está nos gerenciadores ---- */}
        {(metaAds || googleAds) && (
          <section className={card}>
            <h2 className="text-white font-bold">Nos gerenciadores · últimos 30 dias</h2>
            <p className="text-white/40 text-xs mt-0.5">Tudo o que está nas contas, inclusive o que não nasceu aqui.</p>
            {metaErro && <p className="text-red-400 text-xs mt-3 break-words">Meta: {metaErro}</p>}
            {googleErro && <p className="text-red-400 text-xs mt-3 break-words">Google: {googleErro}</p>}
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
          </section>
        )}
      </div>
    </div>
  );
}
