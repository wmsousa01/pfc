import "server-only";
import { db, getConfig, setConfig } from "@/lib/producao/store";
import { tokenRequest } from "@/lib/producao/youtube-api";
import { activeConnection, saveConnection } from "@/lib/social/store";
import type { Metricas } from "./store";

/**
 * Google Ads API (REST), só leitura nesta fase: anúncio de vídeo precisa do
 * vídeo no YouTube e a criação fica no gerenciador. A equipe monta lá e cola
 * o id do anúncio na entrega; daqui saem as métricas.
 *
 * Usa o mesmo client OAuth do YouTube (GOOGLE_CLIENT_ID), com escopo adwords.
 * O refresh token fica cifrado em social_connections (google_ads).
 *
 * Sem developer token: o Google desligou os tokens em 09/09/2026 e o nível de
 * acesso (Test, Explorer, Basic, Standard) passou a ser do projeto do Google
 * Cloud dono do client OAuth. Test só enxerga conta de teste; a conta real
 * pede Explorer ou acima (Google Ads API > Overview, no Cloud Console). O
 * cabeçalho do token é ignorado hoje e vai ser recusado numa versão futura.
 */
const SCOPE = "https://www.googleapis.com/auth/adwords";
const V = process.env.GOOGLE_ADS_API_VERSION || "v26";
const API = `https://googleads.googleapis.com/${V}`;

export function isGoogleAdsConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleAdsAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

const digits = (v: string) => v.replace(/\D/g, "");

function headers(token: string): Record<string, string> {
  const login = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    // Conta acessada por uma MCC: o id da MCC vai aqui.
    ...(login ? { "login-customer-id": digits(login) } : {}),
  };
}

async function gads<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: headers(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = Array.isArray(json) ? json[0]?.error : json.error;
    const erro = e?.details?.[0]?.errors?.[0];
    const detalhe = erro?.message ?? e?.message ?? "erro";
    const codigo = JSON.stringify(erro?.errorCode ?? {});
    // O projeto do Cloud ainda está no nível Test (só contas de teste).
    if (/CLOUD_PROJECT_NOT_APPROVED_FOR_PRODUCTION|ACTION_NOT_PERMITTED/.test(codigo)) {
      throw new Error(
        "Google Ads: o projeto do Google Cloud do client OAuth está só com acesso de teste. Peça o nível Explorer em APIs e serviços > Google Ads API > Overview no Cloud Console e conecte de novo."
      );
    }
    if (/SERVICE_DISABLED|has not been used in project/.test(JSON.stringify(json))) {
      throw new Error("Google Ads: a Google Ads API está desativada no projeto do Google Cloud. Ative em APIs e serviços > Biblioteca.");
    }
    throw new Error(`Google Ads ${res.status}: ${detalhe}`);
  }
  return json as T;
}

/** Conta vista pelo login: nome, moeda e se é MCC (MCC não tem métrica própria). */
export type ContaGoogle = { id: string; nome: string; moeda: string; mcc: boolean };

/** A conexão fica com este id até a equipe escolher a conta no painel. */
export const CONTA_PENDENTE = "pendente";
const CONTAS_KEY = "gads_contas";

async function infoDaConta(id: string, token: string): Promise<ContaGoogle | null> {
  try {
    const r = await gads<{ results?: { customer?: { descriptiveName?: string; currencyCode?: string; manager?: boolean } }[] }>(
      `/customers/${id}/googleAds:search`,
      token,
      { query: "SELECT customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1" }
    );
    const c = r.results?.[0]?.customer;
    return { id, nome: c?.descriptiveName || id, moeda: c?.currencyCode ?? "", mcc: !!c?.manager };
  } catch {
    // Conta cancelada ou sem permissão direta: fica fora da lista.
    return null;
  }
}

const rotulo = (c: ContaGoogle) => `${c.nome} (${c.moeda || c.id})`;

/**
 * Troca o code e escolhe a conta: GOOGLE_ADS_CUSTOMER_ID manda; senão a única
 * conta de anúncios; senão a única com "Fora da Caixa"/"PFC" no nome. Sem
 * como decidir, grava o acesso como pendente e o painel mostra a lista.
 */
export async function connectGoogleAds(code: string, redirectUri: string): Promise<string> {
  const t = await tokenRequest({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("O Google não devolveu refresh_token. Remova o acesso do app na conta Google e conecte de novo.");

  const forced = process.env.GOOGLE_ADS_CUSTOMER_ID ? digits(process.env.GOOGLE_ADS_CUSTOMER_ID) : null;
  let contas: ContaGoogle[];
  if (forced) {
    contas = [(await infoDaConta(forced, t.access_token)) ?? { id: forced, nome: forced, moeda: "", mcc: false }];
  } else {
    const r = await gads<{ resourceNames?: string[] }>("/customers:listAccessibleCustomers", t.access_token);
    const ids = (r.resourceNames ?? []).map((n) => n.split("/")[1]);
    if (ids.length === 0) throw new Error("Essa conta Google não acessa nenhuma conta do Google Ads.");
    contas = (await Promise.all(ids.map((id) => infoDaConta(id, t.access_token)))).filter((c): c is ContaGoogle => !!c);
    if (contas.length === 0) throw new Error(`Nenhuma das contas (${ids.join(", ")}) respondeu: confira o acesso no Google Ads.`);
  }

  const anuncios = contas.filter((c) => !c.mcc);
  const pfc = anuncios.filter((c) => /fora\s*da\s*caixa|pfc/i.test(c.nome));
  const escolhida = forced ? contas[0] : anuncios.length === 1 ? anuncios[0] : pfc.length === 1 ? pfc[0] : null;

  if (!escolhida) {
    await setConfig(CONTAS_KEY, JSON.stringify(contas));
    await saveConnection({ platform: "google_ads", accountId: CONTA_PENDENTE, accountName: null, token: t.refresh_token, scopes: SCOPE });
    return `acesso autorizado; escolha abaixo qual das ${contas.length} contas é a do PFC`;
  }
  await saveConnection({ platform: "google_ads", accountId: escolhida.id, accountName: rotulo(escolhida), token: t.refresh_token, scopes: SCOPE });
  return rotulo(escolhida);
}

/** As contas lidas na conexão, para o seletor do painel. */
export async function contasParaEscolher(): Promise<ContaGoogle[]> {
  const v = await getConfig(CONTAS_KEY);
  try {
    return v ? (JSON.parse(v) as ContaGoogle[]) : [];
  } catch {
    return [];
  }
}

/** Fixa a conta escolhida, com o mesmo refresh token da conexão pendente. */
export async function escolherConta(id: string): Promise<string> {
  const c = (await contasParaEscolher()).find((x) => x.id === digits(id));
  if (!c) throw new Error("Conta fora da lista. Conecte o Google Ads de novo.");
  if (c.mcc) throw new Error("Essa é uma conta de administrador (MCC): escolha a conta de anúncios do PFC.");
  const atual = await activeConnection("google_ads");
  if (!atual) throw new Error("Google Ads não conectado.");
  await saveConnection({ platform: "google_ads", accountId: c.id, accountName: rotulo(c), token: atual.token, scopes: SCOPE });
  await db().from("social_connections").delete().eq("platform", "google_ads").eq("external_account_id", CONTA_PENDENTE);
  return rotulo(c);
}

let cached: { token: string; exp: number } | null = null;

async function conta(): Promise<{ customer: string; token: string }> {
  const c = await activeConnection("google_ads");
  if (!c) throw new Error("Google Ads não conectado.");
  if (c.accountId === CONTA_PENDENTE) throw new Error("Escolha a conta do Google Ads do PFC no painel.");
  if (!cached || cached.exp < Date.now() + 60_000) {
    const t = await tokenRequest({ refresh_token: c.token, grant_type: "refresh_token" });
    cached = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  }
  return { customer: c.accountId, token: cached.token };
}

export async function isGoogleAdsConnected(): Promise<boolean> {
  return !!(await activeConnection("google_ads").catch(() => null));
}

type Row = {
  campaign?: { id?: string; name?: string; status?: string; advertisingChannelType?: string };
  adGroupAd?: { ad?: { id?: string; name?: string } };
  metrics?: Record<string, string | number | undefined>;
};

function metricas(m: Row["metrics"]): Metricas {
  if (!m) return {};
  const n = (v: unknown) => (v === undefined ? undefined : Number(v));
  const micros = (v: unknown) => (v === undefined ? undefined : Number(v) / 1e6);
  return {
    gasto: micros(m.costMicros),
    impressoes: n(m.impressions),
    cliques: n(m.clicks),
    // A API devolve CTR como fração; a Meta, em %.
    ctr: m.ctr === undefined ? undefined : Number(m.ctr) * 100,
    cpc: micros(m.averageCpc),
    conversoes: n(m.conversions),
  };
}

async function search(query: string): Promise<Row[]> {
  const { customer, token } = await conta();
  const out: Row[] = [];
  let pageToken: string | undefined;
  do {
    const r = await gads<{ results?: Row[]; nextPageToken?: string }>(`/customers/${customer}/googleAds:search`, token, {
      query,
      ...(pageToken ? { pageToken } : {}),
    });
    out.push(...(r.results ?? []));
    pageToken = r.nextPageToken;
  } while (pageToken && out.length < 2000);
  return out;
}

export type GoogleCampanha = { id: string; nome: string; status: string; tipo: string; m: Metricas };

const METRICS = "metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.average_cpc, metrics.conversions";

export async function googleCampanhas(): Promise<GoogleCampanha[]> {
  const rows = await search(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, ${METRICS}
     FROM campaign WHERE campaign.status != 'REMOVED' AND segments.date DURING LAST_30_DAYS`
  );
  return rows.map((r) => ({
    id: String(r.campaign?.id ?? ""),
    nome: r.campaign?.name ?? "",
    status: r.campaign?.status ?? "",
    tipo: r.campaign?.advertisingChannelType ?? "",
    m: metricas(r.metrics),
  }));
}

/** Métricas dos últimos 90 dias de cada anúncio ligado a uma entrega. */
export async function googleMetricasAnuncios(adIds: string[]): Promise<Map<string, Metricas>> {
  const out = new Map<string, Metricas>();
  const ids = adIds.map(digits).filter(Boolean);
  if (ids.length === 0) return out;
  // GAQL não tem LAST_90_DAYS: o intervalo vai explícito.
  const desde = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  const rows = await search(
    `SELECT ad_group_ad.ad.id, ${METRICS} FROM ad_group_ad
     WHERE ad_group_ad.ad.id IN (${ids.join(",")}) AND segments.date >= '${desde}'`
  );
  for (const r of rows) {
    const id = String(r.adGroupAd?.ad?.id ?? "");
    if (id) out.set(id, metricas(r.metrics));
  }
  return out;
}
