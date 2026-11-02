import "server-only";
import { graph } from "@/lib/social/meta";
import { activeConnection, saveConnection } from "@/lib/social/store";
import {
  bytesDe,
  updateEntrega,
  updateEstrategia,
  urlPublica,
  type Criativo,
  type Entrega,
  type Estrategia,
  type Metricas,
  type Objetivo,
} from "./store";

/**
 * Marketing API da Meta com o token LONGO de usuário (60 dias) do mesmo
 * login da publicação orgânica — anúncio não aceita token de Página. As
 * permissões ads_management e ads_read precisam estar na configuração do
 * Facebook Login for Business (META_LOGIN_CONFIG_ID).
 *
 * Tudo nasce PAUSADO: a equipe confere e ativa no Gerenciador de Anúncios.
 */
const ADS_TTL_MS = 60 * 86_400_000;

type AdAccount = { id: string; name: string; account_status: number; currency: string };

function pickAccount(accounts: AdAccount[]): AdAccount {
  const forced = process.env.META_AD_ACCOUNT_ID;
  if (forced) {
    const id = forced.startsWith("act_") ? forced : `act_${forced}`;
    const a = accounts.find((x) => x.id === id);
    if (!a) throw new Error(`META_AD_ACCOUNT_ID ${forced} não está entre as contas de anúncio autorizadas.`);
    return a;
  }
  const ativas = accounts.filter((a) => a.account_status === 1);
  if (ativas.length === 1) return ativas[0];
  const pfc = ativas.filter((a) => /fora\s*da\s*caixa|pfc/i.test(a.name));
  if (pfc.length === 1) return pfc[0];
  if (ativas.length === 0) throw new Error("Nenhuma conta de anúncio ativa autorizada no login da Meta.");
  throw new Error(`Várias contas de anúncio (${ativas.map((a) => `${a.name} = ${a.id}`).join("; ")}). Defina META_AD_ACCOUNT_ID na Vercel.`);
}

/**
 * Chamado no callback do login da Meta. Sem a permissão de anúncios o
 * /me/adaccounts volta erro: aí a orgânica segue conectada e só avisa.
 */
export async function connectMetaAds(userToken: string): Promise<string | null> {
  try {
    const r = await graph<{ data: AdAccount[] }>("/me/adaccounts", {
      fields: "id,name,account_status,currency",
      limit: "50",
      access_token: userToken,
    });
    const a = pickAccount(r.data ?? []);
    await saveConnection({
      platform: "meta_ads",
      accountId: a.id,
      accountName: `${a.name} (${a.currency})`,
      token: userToken,
      expiresAt: new Date(Date.now() + ADS_TTL_MS),
      scopes: "ads_management,ads_read",
    });
    return a.name;
  } catch (e) {
    return `sem anúncios: ${e instanceof Error ? e.message : String(e)}`;
  }
}

async function conta(): Promise<{ act: string; token: string }> {
  const c = await activeConnection("meta_ads");
  if (!c) throw new Error("Conta de anúncios da Meta não conectada. Reconecte a Meta em /admin/marketing com ads_management no login.");
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) throw new Error("O token de anúncios da Meta venceu (60 dias). Reconecte a Meta.");
  return { act: c.accountId, token: c.token };
}

// ---- Leitura: campanhas da conta e métricas por anúncio ----

export type MetaCampanha = {
  id: string;
  nome: string;
  status: string;
  objetivo: string;
  orcamento: number | null;
  m: Metricas;
};

type RawInsight = Record<string, any>;

function acao(list: { action_type: string; value: string }[] | undefined, tipo: string): number | undefined {
  const v = list?.find((a) => a.action_type === tipo)?.value;
  return v === undefined ? undefined : Number(v);
}

function metricas(i: RawInsight | undefined): Metricas {
  if (!i) return {};
  const n = (v: unknown) => (v === undefined || v === null ? undefined : Number(v));
  return {
    gasto: n(i.spend),
    impressoes: n(i.impressions),
    alcance: n(i.reach),
    cliques: n(i.inline_link_clicks) ?? n(i.clicks),
    ctr: n(i.inline_link_click_ctr) ?? n(i.ctr),
    cpc: n(i.cost_per_inline_link_click) ?? n(i.cpc),
    cpm: n(i.cpm),
    thruplays: acao(i.video_thruplay_watched_actions, "video_view"),
    conversoes: acao(i.actions, "lead") ?? acao(i.actions, "offsite_conversion.fb_pixel_lead"),
  };
}

const INSIGHT_FIELDS =
  "spend,impressions,reach,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpc,cost_per_inline_link_click,cpm,actions,video_thruplay_watched_actions";

export async function isMetaAdsConnected(): Promise<boolean> {
  return !!(await activeConnection("meta_ads").catch(() => null));
}

/** Campanhas da conta com os números dos últimos 30 dias. */
export async function metaCampanhas(): Promise<MetaCampanha[]> {
  const { act, token } = await conta();
  const r = await graph<{ data: RawInsight[] }>(`/${act}/campaigns`, {
    fields: `id,name,effective_status,objective,daily_budget,insights.date_preset(last_30d){${INSIGHT_FIELDS}}`,
    limit: "50",
    access_token: token,
  });
  return (r.data ?? []).map((c) => ({
    id: c.id,
    nome: c.name,
    status: c.effective_status,
    objetivo: c.objective,
    orcamento: c.daily_budget ? Number(c.daily_budget) : null,
    m: metricas(c.insights?.data?.[0]),
  }));
}

/** Métricas desde sempre de cada anúncio, para gravar nas entregas. */
export async function metaMetricasAnuncios(adIds: string[]): Promise<Map<string, Metricas>> {
  const out = new Map<string, Metricas>();
  if (adIds.length === 0) return out;
  const { act, token } = await conta();
  const r = await graph<{ data: RawInsight[] }>(`/${act}/insights`, {
    level: "ad",
    fields: `ad_id,${INSIGHT_FIELDS}`,
    date_preset: "maximum",
    filtering: JSON.stringify([{ field: "ad.id", operator: "IN", value: adIds }]),
    limit: "500",
    access_token: token,
  });
  for (const i of r.data ?? []) out.set(String(i.ad_id), metricas(i));
  return out;
}

// ---- Subida: campanha + conjunto (uma vez por estratégia), mídia, criativo, anúncio ----

const OBJ: Record<Objetivo, { objective: string; goal: string; destino?: string }> = {
  alcance: { objective: "OUTCOME_AWARENESS", goal: "REACH" },
  trafego: { objective: "OUTCOME_TRAFFIC", goal: "LINK_CLICKS", destino: "WEBSITE" },
  video: { objective: "OUTCOME_ENGAGEMENT", goal: "THRUPLAY", destino: "ON_VIDEO" },
};

async function garantirCampanha(e: Estrategia, act: string, token: string): Promise<{ campaignId: string; adsetId: string }> {
  let campaignId = e.meta_campaign_id;
  if (!campaignId) {
    const c = await graph<{ id: string }>(
      `/${act}/campaigns`,
      {
        name: `PFC · ${e.nome}`.slice(0, 200),
        objective: OBJ[e.objetivo].objective,
        status: "PAUSED",
        special_ad_categories: "[]",
        // Orçamento fica no conjunto, não na campanha.
        is_adset_budget_sharing_enabled: "false",
        access_token: token,
      },
      "POST"
    );
    campaignId = c.id;
    await updateEstrategia(e.id, { meta_campaign_id: campaignId });
  }
  if (e.meta_adset_id) return { campaignId, adsetId: e.meta_adset_id };

  const o = OBJ[e.objetivo];
  const targeting = {
    geo_locations: {
      custom_locations: [{ latitude: e.geo_lat, longitude: e.geo_lng, radius: e.geo_raio_km, distance_unit: "kilometer" }],
      location_types: ["home", "recent"],
    },
    age_min: e.idade_min,
    age_max: e.idade_max,
    // Público definido pela equipe: sem o Advantage+ expandir para fora da região.
    targeting_automation: { advantage_audience: 0 },
  };
  const inicio = e.inicio && new Date(`${e.inicio}T08:00:00-03:00`).getTime() > Date.now() ? `${e.inicio}T08:00:00-0300` : null;
  const s = await graph<{ id: string }>(
    `/${act}/adsets`,
    {
      name: `${e.nome} · ${e.geo_raio_km} km · ${e.idade_min}-${e.idade_max}`.slice(0, 200),
      campaign_id: campaignId,
      daily_budget: String(e.orcamento_diario),
      billing_event: "IMPRESSIONS",
      optimization_goal: o.goal,
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      ...(o.destino ? { destination_type: o.destino } : {}),
      targeting: JSON.stringify(targeting),
      ...(inicio ? { start_time: inicio } : {}),
      ...(e.fim ? { end_time: `${e.fim}T23:59:00-0300` } : {}),
      status: "PAUSED",
      access_token: token,
    },
    "POST"
  );
  await updateEstrategia(e.id, { meta_adset_id: s.id });
  return { campaignId, adsetId: s.id };
}

/** Vídeo: a Meta baixa da URL; imagem: vai em bytes e volta o hash. */
async function garantirMidia(en: Entrega, c: Criativo, act: string, token: string): Promise<Partial<Entrega>> {
  if (c.tipo === "video") {
    if (en.meta_video_id) return {};
    const v = await graph<{ id: string }>(
      `/${act}/advideos`,
      { file_url: await urlPublica(c), name: c.nome.slice(0, 100), access_token: token },
      "POST"
    );
    return { meta_video_id: v.id };
  }
  if (en.meta_image_hash) return {};
  const { buf } = await bytesDe(c, 30 * 1024 * 1024);
  const r = await graph<{ images: Record<string, { hash: string }> }>(
    `/${act}/adimages`,
    { bytes: buf.toString("base64"), access_token: token },
    "POST"
  );
  const hash = Object.values(r.images ?? {})[0]?.hash;
  if (!hash) throw new Error("A Meta não devolveu o hash da imagem.");
  return { meta_image_hash: hash };
}

/** Espera o vídeo processar; devolve a thumb preferida ou null se ainda não ficou pronto. */
async function videoPronto(videoId: string, token: string, ateMs: number): Promise<string | null> {
  while (Date.now() < ateMs) {
    const v = await graph<{ status?: { video_status?: string; processing_progress?: number } }>(`/${videoId}`, {
      fields: "status",
      access_token: token,
    });
    const st = v.status?.video_status;
    if (st === "error") throw new Error("A Meta não conseguiu processar o vídeo (formato ou link inacessível).");
    if (st === "ready") {
      const t = await graph<{ data: { uri: string; is_preferred: boolean }[] }>(`/${videoId}/thumbnails`, { access_token: token });
      const thumb = t.data?.find((x) => x.is_preferred) ?? t.data?.[0];
      if (!thumb) throw new Error("O vídeo processou, mas a Meta não gerou miniatura.");
      return thumb.uri;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  return null;
}

/**
 * Sobe a entrega aprovada como anúncio PAUSADO. Cada passo grava o id na
 * entrega, então chamar de novo continua de onde parou (vídeo grande pode
 * levar mais que uma chamada para processar). Devolve se terminou.
 */
export async function subirNaMeta(en: Entrega, e: Estrategia, c: Criativo): Promise<"pronto" | "processando"> {
  if (e.objetivo === "video" && c.tipo !== "video") throw new Error("Objetivo 'visualização de vídeo' só aceita vídeo.");
  if (!e.link && e.objetivo === "trafego") throw new Error("Estratégia de tráfego precisa de link de destino.");
  if (!en.texto.trim()) throw new Error("Escreva o texto do anúncio (ou peça a copy à IA) antes de subir.");
  const { act, token } = await conta();
  const page = await activeConnection("facebook");
  if (!page) throw new Error("Página do Facebook não conectada (/admin/marketing): todo anúncio sai em nome dela.");
  const ig = await activeConnection("instagram");

  const { adsetId } = await garantirCampanha(e, act, token);
  const midia = await garantirMidia(en, c, act, token);
  if (Object.keys(midia).length) await updateEntrega(en.id, midia);
  const cur = { ...en, ...midia };

  let creativeId = cur.meta_creative_id;
  if (!creativeId) {
    const cta = e.link ? { type: e.cta, value: { link: e.link } } : undefined;
    let spec: Record<string, unknown>;
    if (c.tipo === "video") {
      const thumb = await videoPronto(cur.meta_video_id!, token, Date.now() + 120_000);
      if (!thumb) return "processando";
      spec = {
        video_id: cur.meta_video_id,
        image_url: thumb,
        message: cur.texto,
        title: cur.headline,
        ...(cta ? { call_to_action: cta } : {}),
      };
    } else {
      spec = {
        image_hash: cur.meta_image_hash,
        link: e.link ?? "https://pfc-landing.vercel.app/parcerias",
        message: cur.texto,
        name: cur.headline,
        ...(cta ? { call_to_action: cta } : {}),
      };
    }
    const cr = await graph<{ id: string }>(
      `/${act}/adcreatives`,
      {
        name: `${e.nome} · ${c.nome}`.slice(0, 200),
        object_story_spec: JSON.stringify({
          page_id: page.accountId,
          ...(ig ? { instagram_user_id: ig.accountId } : {}),
          [c.tipo === "video" ? "video_data" : "link_data"]: spec,
        }),
        access_token: token,
      },
      "POST"
    );
    creativeId = cr.id;
    await updateEntrega(en.id, { meta_creative_id: creativeId });
  }

  if (!cur.meta_ad_id) {
    const ad = await graph<{ id: string }>(
      `/${act}/ads`,
      {
        name: `${cur.angulo ? `${cur.angulo} · ` : ""}${c.nome}`.slice(0, 200),
        adset_id: adsetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: "PAUSED",
        access_token: token,
      },
      "POST"
    );
    await updateEntrega(en.id, { meta_ad_id: ad.id });
  }
  return "pronto";
}

/** Link do anúncio no Gerenciador. */
export function metaAdUrl(act: string | null, adId: string): string {
  const id = act?.replace(/^act_/, "") ?? "";
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${id}&selected_ad_ids=${adId}`;
}
