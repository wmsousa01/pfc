import "server-only";

/**
 * Jira como backend das entregas do cliente.
 *
 * Convenção (tudo no projeto PROD):
 *   - um Epic por cliente; a chave fica em `partner_panels.jira_epic`;
 *   - cada entrega é uma Tarefa filha do Epic com a label `entrega-cliente`.
 *     Tarefa sem essa label é trabalho interno e NUNCA aparece para o cliente;
 *   - o material entregue entra como link na tarefa ("Adicionar link da web").
 *     A descrição da tarefa não é mostrada: é onde o time escreve à vontade.
 *
 * A URL do site é fixa de propósito: o .env compartilhado dos projetos tem um
 * JIRA_BASE_URL de outro site, e o mesmo token autentica nos dois.
 */

const BASE = "https://tarefaspfc.atlassian.net";
const CLIENT_LABEL = "entrega-cliente";
const EPIC_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

export type DeliveryStatus = "programado" | "em_producao" | "entregue";

export type DeliveryLink = { title: string; url: string };

export type ClientDelivery = {
  key: string;
  title: string;
  status: DeliveryStatus;
  dueDate: string | null;
  deliveredAt: string | null;
  links: DeliveryLink[];
};

function authHeader(): string | null {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_TOKEN;
  if (!email || !token) return null;
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

export function isJiraConfigured(): boolean {
  return authHeader() !== null;
}

async function jira<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {}
): Promise<T | null> {
  const auth = authHeader();
  if (!auth) return null;
  const { revalidate, ...rest } = init;
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...rest,
      headers: {
        Authorization: auth,
        Accept: "application/json",
        "Content-Type": "application/json",
        ...rest.headers,
      },
      ...(revalidate !== undefined
        ? { next: { revalidate } }
        : { cache: "no-store" as const }),
    });
    if (!res.ok) {
      console.error(`[jira] ${rest.method ?? "GET"} ${path} → ${res.status}`);
      return null;
    }
    return res.status === 204 ? ({} as T) : ((await res.json()) as T);
  } catch (err) {
    console.error(`[jira] ${path}`, err);
    return null;
  }
}

function toStatus(categoryKey: string | undefined): DeliveryStatus {
  if (categoryKey === "done") return "entregue";
  if (categoryKey === "indeterminate") return "em_producao";
  return "programado";
}

type SearchResult = {
  issues: {
    key: string;
    fields: {
      summary: string;
      duedate: string | null;
      resolutiondate: string | null;
      status: { statusCategory?: { key?: string } };
    };
  }[];
};

type RemoteLink = { object?: { url?: string; title?: string } };

/**
 * Entregas visíveis do cliente, da mais próxima para a mais distante.
 * Devolve null quando o Jira não responde — a página mostra aviso, não vazio.
 */
export async function getClientDeliveries(
  epicKey: string
): Promise<ClientDelivery[] | null> {
  if (!EPIC_KEY.test(epicKey)) return null;

  const found = await jira<SearchResult>("/rest/api/3/search/jql", {
    method: "POST",
    revalidate: 60,
    body: JSON.stringify({
      jql: `parent = ${epicKey} AND labels = "${CLIENT_LABEL}" ORDER BY duedate ASC, created ASC`,
      fields: ["summary", "status", "duedate", "resolutiondate"],
      maxResults: 100,
    }),
  });
  if (!found) return null;

  return Promise.all(
    found.issues.map(async (i) => {
      const remote =
        (await jira<RemoteLink[]>(`/rest/api/3/issue/${i.key}/remotelink`, {
          revalidate: 60,
        })) ?? [];
      const links = remote
        .map((r) => ({ title: r.object?.title ?? "", url: r.object?.url ?? "" }))
        // Só http(s): link interno do Jira ou esquema estranho não vai ao cliente.
        .filter((l) => /^https?:\/\//i.test(l.url))
        .map((l) => ({ title: l.title || l.url, url: l.url }));

      return {
        key: i.key,
        title: i.fields.summary,
        status: toStatus(i.fields.status?.statusCategory?.key),
        dueDate: i.fields.duedate,
        deliveredAt: i.fields.resolutiondate,
        links,
      };
    })
  );
}

/** Comentário em texto simples no Epic (uma linha por parágrafo). */
export async function commentOnEpic(
  epicKey: string,
  lines: string[]
): Promise<boolean> {
  if (!EPIC_KEY.test(epicKey)) return false;
  const body = {
    type: "doc",
    version: 1,
    content: lines.map((text) => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
  const res = await jira(`/rest/api/3/issue/${epicKey}/comment`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return res !== null;
}
