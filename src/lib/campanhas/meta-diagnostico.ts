import "server-only";
import { graph, MetaError } from "@/lib/social/meta";
import { activeConnection } from "@/lib/social/store";

/**
 * Diagnóstico da conta de anúncios da Meta, rodando no servidor com o token
 * que já está em social_connections (a chave que decifra o token é sensível
 * na Vercel e não sai de lá).
 *
 * Só lê. A única chamada de escrita é a criação de campanha com
 * execution_options=validate_only: a Meta valida e não cria nada. É ela que
 * mostra travas que a leitura não mostra (ex.: "authenticate your account in
 * Ads Manager", que bloqueia criar e editar mas deixa ler).
 */

export type Nivel = "ok" | "aviso" | "erro";
export type Achado = { nivel: Nivel; titulo: string; detalhe?: string };

export type ItemMeta = {
  id: string;
  nome: string;
  status: string;
  efetivo: string;
  extra?: string;
  problemas: string[];
};

export type Diagnostico = {
  em: string;
  conta: { id: string; nome: string; moeda: string; fuso: string; gasto: string; status: string } | null;
  usuario: string | null;
  achados: Achado[];
  campanhas: ItemMeta[];
  conjuntos: ItemMeta[];
  anuncios: ItemMeta[];
};

const STATUS_CONTA: Record<number, { t: string; n: Nivel }> = {
  1: { t: "Ativa", n: "ok" },
  2: { t: "Desativada", n: "erro" },
  3: { t: "Com pagamento pendente", n: "erro" },
  7: { t: "Em análise de risco", n: "erro" },
  8: { t: "Acerto de pagamento pendente", n: "erro" },
  9: { t: "Em período de carência", n: "aviso" },
  100: { t: "Fechamento pendente", n: "erro" },
  101: { t: "Fechada", n: "erro" },
};

const MOTIVO: Record<number, string> = {
  1: "política de integridade de anúncios",
  2: "revisão de propriedade intelectual",
  3: "risco no pagamento",
  4: "conta cinza encerrada",
  5: "revisão AFC",
  6: "integridade do negócio",
  7: "encerramento permanente",
  8: "conta de revenda sem uso",
  9: "conta sem uso",
};

const EFETIVO: Record<string, string> = {
  ACTIVE: "no ar",
  PAUSED: "pausado",
  CAMPAIGN_PAUSED: "campanha pausada",
  ADSET_PAUSED: "conjunto pausado",
  PENDING_REVIEW: "em análise",
  IN_PROCESS: "processando",
  DISAPPROVED: "reprovado",
  WITH_ISSUES: "com problemas",
  PENDING_BILLING_INFO: "falta pagamento",
  PREAPPROVED: "pré-aprovado",
  ARCHIVED: "arquivado",
  DELETED: "apagado",
};

export const efetivoPt = (s: string) => EFETIVO[s] ?? s;

type Issue = { error_summary?: string; error_message?: string; level?: string };
const issues = (l?: Issue[]) => (l ?? []).map((i) => i.error_summary || i.error_message || "problema sem descrição");

function feedback(f?: Record<string, unknown>): string[] {
  // ad_review_feedback: { global: { "Política": "explicação" }, placement_specific: {...} }
  if (!f) return [];
  const out: string[] = [];
  for (const grupo of Object.values(f)) {
    if (grupo && typeof grupo === "object") for (const [k, v] of Object.entries(grupo)) out.push(`${k}: ${String(v)}`);
  }
  return out;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function diagnosticarMeta(): Promise<Diagnostico> {
  const d: Diagnostico = { em: new Date().toISOString(), conta: null, usuario: null, achados: [], campanhas: [], conjuntos: [], anuncios: [] };
  const c = await activeConnection("meta_ads").catch(() => null);
  if (!c) {
    d.achados.push({ nivel: "erro", titulo: "Conta de anúncios não conectada", detalhe: "Conecte a Meta na aba Contas." });
    return d;
  }
  const { accountId: act, token } = c;
  if (c.expiresAt) {
    const dias = Math.floor((new Date(c.expiresAt).getTime() - Date.now()) / 86_400_000);
    if (dias < 0) d.achados.push({ nivel: "erro", titulo: "Token de anúncios vencido", detalhe: "Reconecte a Meta." });
    else if (dias <= 7) d.achados.push({ nivel: "aviso", titulo: `Token de anúncios vence em ${dias} dias`, detalhe: "Reconecte a Meta antes disso." });
  }

  // Token e permissões.
  try {
    const me = await graph<{ id: string; name: string }>("/me", { fields: "id,name", access_token: token });
    d.usuario = me.name;
    const p = await graph<{ data: { permission: string; status: string }[] }>("/me/permissions", { access_token: token });
    const ok = new Set(p.data.filter((x) => x.status === "granted").map((x) => x.permission));
    const faltam = ["ads_management", "ads_read"].filter((x) => !ok.has(x));
    if (faltam.length) d.achados.push({ nivel: "erro", titulo: `Login sem ${faltam.join(" e ")}`, detalhe: "Inclua na configuração do login da Meta e reconecte." });
  } catch (e) {
    const morto = e instanceof MetaError && e.tokenDead;
    d.achados.push({ nivel: "erro", titulo: morto ? "Token da Meta inválido ou revogado" : "Não consegui ler o usuário da Meta", detalhe: msg(e) });
    if (morto) return d;
  }

  // Conta.
  try {
    const a = await graph<{
      name: string;
      account_status: number;
      disable_reason?: number;
      currency: string;
      timezone_name: string;
      amount_spent: string;
      spend_cap?: string;
      funding_source_details?: { display_string?: string };
      user_tasks?: string[];
    }>(`/${act}`, {
      fields: "name,account_status,disable_reason,currency,timezone_name,amount_spent,spend_cap,funding_source_details,user_tasks",
      access_token: token,
    });
    const st = STATUS_CONTA[a.account_status] ?? { t: `Status ${a.account_status}`, n: "aviso" as Nivel };
    const centavos = (v?: string) => (Number(v ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: a.currency || "BRL" });
    d.conta = { id: act, nome: a.name, moeda: a.currency, fuso: a.timezone_name, gasto: centavos(a.amount_spent), status: st.t };
    if (st.n !== "ok") {
      const motivo = a.disable_reason ? MOTIVO[a.disable_reason] ?? `motivo ${a.disable_reason}` : null;
      d.achados.push({ nivel: st.n, titulo: `Conta ${st.t.toLowerCase()}`, detalhe: motivo ? `Motivo informado pela Meta: ${motivo}.` : undefined });
    }
    if (!a.funding_source_details?.display_string) {
      d.achados.push({ nivel: "aviso", titulo: "Sem forma de pagamento cadastrada", detalhe: "Sem ela os anúncios não entram no ar." });
    }
    if (a.spend_cap && Number(a.spend_cap) > 0 && Number(a.amount_spent) >= Number(a.spend_cap)) {
      d.achados.push({ nivel: "erro", titulo: "Limite de gastos da conta atingido", detalhe: `Gasto ${centavos(a.amount_spent)} de ${centavos(a.spend_cap)}.` });
    }
    const tarefas = new Set(a.user_tasks ?? []);
    if (tarefas.size && !tarefas.has("MANAGE") && !tarefas.has("ADVERTISE")) {
      d.achados.push({ nivel: "erro", titulo: "O usuário conectado não pode anunciar nesta conta", detalhe: `Permissões: ${(a.user_tasks ?? []).join(", ")}.` });
    }
  } catch (e) {
    d.achados.push({ nivel: "erro", titulo: "Não consegui ler a conta de anúncios", detalhe: msg(e) });
    return d;
  }

  // Trava de escrita: valida a criação de uma campanha sem criar.
  try {
    const r = await graph<{ success?: boolean; id?: string }>(
      `/${act}/campaigns`,
      {
        name: "PFC · diagnóstico (validate_only)",
        objective: "OUTCOME_ENGAGEMENT",
        status: "PAUSED",
        special_ad_categories: "[]",
        is_adset_budget_sharing_enabled: "false",
        execution_options: JSON.stringify(["validate_only"]),
        access_token: token,
      },
      "POST"
    );
    // Rede de segurança: se a Meta tiver criado mesmo assim, apaga na hora.
    if (r.id) await graph(`/${r.id}`, { status: "DELETED", access_token: token }, "POST").catch(() => null);
  } catch (e) {
    const t = msg(e);
    const trava = /authenticate your account|tried to access your account/i.test(t);
    d.achados.push({
      nivel: "erro",
      titulo: trava ? "A Meta travou a criação e a edição de anúncios" : "A Meta recusou criar campanha",
      detalhe: trava
        ? "Entre no Gerenciador de Anúncios com o usuário conectado e conclua a verificação de segurança. Os anúncios que já estão no ar seguem rodando."
        : t,
    });
  }

  // Campanhas, conjuntos e anúncios (inclui o que não nasceu no painel).
  const lista = async <T,>(path: string, fields: string) =>
    (await graph<{ data: T[] }>(`/${act}/${path}`, { fields, limit: "100", access_token: token })).data ?? [];
  try {
    type Camp = { id: string; name: string; status: string; effective_status: string; objective: string; issues_info?: Issue[] };
    type Conj = Camp & { daily_budget?: string; optimization_goal?: string; end_time?: string };
    type Ad = Camp & { ad_review_feedback?: Record<string, unknown> };
    const [cs, ss, as] = await Promise.all([
      lista<Camp>("campaigns", "id,name,status,effective_status,objective,issues_info"),
      lista<Conj>("adsets", "id,name,status,effective_status,daily_budget,optimization_goal,end_time,issues_info"),
      lista<Ad>("ads", "id,name,status,effective_status,issues_info,ad_review_feedback"),
    ]);
    d.campanhas = cs.map((x) => ({ id: x.id, nome: x.name, status: x.status, efetivo: x.effective_status, extra: x.objective, problemas: issues(x.issues_info) }));
    d.conjuntos = ss.map((x) => ({
      id: x.id,
      nome: x.name,
      status: x.status,
      efetivo: x.effective_status,
      extra: [x.daily_budget && `R$ ${(Number(x.daily_budget) / 100).toFixed(2).replace(".", ",")}/dia`, x.optimization_goal].filter(Boolean).join(" · "),
      problemas: [
        ...issues(x.issues_info),
        ...(x.end_time && new Date(x.end_time).getTime() < Date.now() && x.status === "ACTIVE" ? ["data de término já passou"] : []),
      ],
    }));
    d.anuncios = as.map((x) => ({ id: x.id, nome: x.name, status: x.status, efetivo: x.effective_status, problemas: [...issues(x.issues_info), ...feedback(x.ad_review_feedback)] }));

    const reprovados = as.filter((x) => x.effective_status === "DISAPPROVED").length;
    if (reprovados) d.achados.push({ nivel: "erro", titulo: `${reprovados} anúncio(s) reprovado(s)`, detalhe: "O motivo aparece na lista de anúncios abaixo." });
    const comProblema = [...d.campanhas, ...d.conjuntos, ...d.anuncios].filter((x) => x.problemas.length && x.efetivo !== "DISAPPROVED").length;
    if (comProblema) d.achados.push({ nivel: "aviso", titulo: `${comProblema} item(ns) com problema apontado pela Meta` });
    if (!as.some((x) => x.effective_status === "ACTIVE")) d.achados.push({ nivel: "aviso", titulo: "Nenhum anúncio no ar" });
  } catch (e) {
    d.achados.push({ nivel: "erro", titulo: "Não consegui listar campanhas, conjuntos e anúncios", detalhe: msg(e) });
  }

  if (!d.achados.some((a) => a.nivel === "erro")) d.achados.unshift({ nivel: "ok", titulo: "A conta pode criar e editar anúncios" });
  return d;
}
