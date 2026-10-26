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
 * Credenciais: o site usa a conta de serviço (SAJIRA_*), para que o que o
 * portal escreve no Jira saia em nome dela e o time receba notificação como
 * observador. Token de conta de serviço só autentica pelo gateway
 * api.atlassian.com — no endereço do site ele responde 401/404. O token
 * pessoal (JIRA_*) fica de reserva, pelo endereço do site.
 *
 * Os endereços são fixos de propósito: o .env compartilhado dos projetos tem
 * um JIRA_BASE_URL de outro site Atlassian.
 */

const CLOUD_ID = "6808672a-a23e-4f25-94dd-4ebc6f1106e2"; // tarefaspfc
const SITE_URL = "https://tarefaspfc.atlassian.net";

function credentials(): { base: string; email: string; token: string } | null {
  const { SAJIRA_EMAIL, SAJIRA_TOKEN, JIRA_EMAIL, JIRA_TOKEN } = process.env;
  if (SAJIRA_EMAIL && SAJIRA_TOKEN)
    return { base: `https://api.atlassian.com/ex/jira/${CLOUD_ID}`, email: SAJIRA_EMAIL, token: SAJIRA_TOKEN };
  if (JIRA_EMAIL && JIRA_TOKEN) return { base: SITE_URL, email: JIRA_EMAIL, token: JIRA_TOKEN };
  return null;
}

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

function authHeader(c: { email: string; token: string }): string {
  return `Basic ${Buffer.from(`${c.email}:${c.token}`).toString("base64")}`;
}

export function isJiraConfigured(): boolean {
  return credentials() !== null;
}

async function jira<T>(
  path: string,
  init: RequestInit & { revalidate?: number } = {}
): Promise<T | null> {
  const c = credentials();
  if (!c) return null;
  const { revalidate, ...rest } = init;
  try {
    const res = await fetch(`${c.base}${path}`, {
      ...rest,
      headers: {
        Authorization: authHeader(c),
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

/* ---------------------------------------------------------------------
 * Conversa com o cliente
 *
 * Uma tarefa por cliente, filha do Epic, com a label `conversa-cliente`.
 * TODO comentário dela é visível para o cliente — conversa interna vai em
 * outra tarefa. Mensagem que vem do portal começa com CLIENT_MARKER (o
 * comentário é postado pelo token do site, então o autor no Jira não diz
 * quem escreveu). Anexos que o time sobe nessa tarefa viram arquivos do PFC
 * para o cliente baixar.
 * ------------------------------------------------------------------- */

const CHAT_LABEL = "conversa-cliente";
const REPLY_LABEL = "responder-cliente";
const CLIENT_MARKER = "[Portal do cliente]";

export type ChatMessage = {
  id: string;
  fromClient: boolean;
  author: string;
  text: string;
  createdAt: string;
};

export type ChatAttachment = {
  id: string;
  fileName: string;
  size: number;
  createdAt: string;
};

type AdfNode = { type?: string; text?: string; content?: AdfNode[] };

/** ADF → texto simples, um parágrafo por linha. */
function adfToText(node: AdfNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  const inner = (node.content ?? []).map(adfToText).join("");
  return node.type === "paragraph" || node.type === "listItem" ? `${inner}\n` : inner;
}

export async function createChatIssue(
  epicKey: string,
  clientName: string
): Promise<string | null> {
  if (!EPIC_KEY.test(epicKey)) return null;
  const project = epicKey.split("-")[0];
  // Tipo pelo id, nunca pelo nome: o nome segue o idioma de quem chama — a
  // conta de serviço vê "Task", o time vê "Tarefa".
  const meta = await jira<{ issueTypes: { id: string; hierarchyLevel: number; subtask?: boolean }[] }>(
    `/rest/api/3/project/${project}`,
    { revalidate: 3600 }
  );
  const taskType = meta?.issueTypes.find((t) => t.hierarchyLevel === 0 && !t.subtask)?.id;
  if (!taskType) return null;

  const created = await jira<{ key: string }>("/rest/api/3/issue", {
    method: "POST",
    body: JSON.stringify({
      fields: {
        project: { key: project },
        issuetype: { id: taskType },
        parent: { key: epicKey },
        summary: `Conversa com o cliente · ${clientName}`,
        labels: [CHAT_LABEL],
        description: {
          type: "doc",
          version: 1,
          content: [
            {
              type: "paragraph",
              content: [
                {
                  type: "text",
                  text: "Todo comentário desta tarefa aparece para o cliente no portal. Para responder, comente aqui. Arquivos anexados aqui ficam disponíveis para ele baixar. Conversa interna vai em outra tarefa.",
                },
              ],
            },
          ],
        },
      },
    }),
  });
  return created?.key ?? null;
}

export async function getChatMessages(issueKey: string): Promise<ChatMessage[] | null> {
  if (!EPIC_KEY.test(issueKey)) return null;
  const res = await jira<{
    comments: {
      id: string;
      created: string;
      author?: { displayName?: string };
      body?: AdfNode;
    }[];
  }>(`/rest/api/3/issue/${issueKey}/comment?orderBy=created&maxResults=200`);
  if (!res) return null;

  return res.comments.map((c) => {
    const raw = adfToText(c.body).trim();
    const fromClient = raw.startsWith(CLIENT_MARKER);
    return {
      id: c.id,
      fromClient,
      author: fromClient ? "Você" : c.author?.displayName ?? "Equipe PFC",
      text: fromClient ? raw.slice(CLIENT_MARKER.length).trim() : raw,
      createdAt: c.created,
    };
  });
}

export async function getChatAttachments(
  issueKey: string
): Promise<ChatAttachment[] | null> {
  if (!EPIC_KEY.test(issueKey)) return null;
  const res = await jira<{
    fields: { attachment?: { id: string; filename: string; size: number; created: string }[] };
  }>(`/rest/api/3/issue/${issueKey}?fields=attachment`);
  if (!res) return null;
  return (res.fields.attachment ?? [])
    .map((a) => ({ id: a.id, fileName: a.filename, size: a.size, createdAt: a.created }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Mensagem do cliente: vira comentário com a marca do portal e liga a label
 * `responder-cliente`, que é o que o time filtra para não deixar ninguém sem
 * resposta. Devolve o id do comentário.
 */
export async function postClientMessage(
  issueKey: string,
  text: string,
  files: { name: string; url: string }[]
): Promise<string | null> {
  if (!EPIC_KEY.test(issueKey)) return null;
  const paragraphs = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const content: unknown[] = [
    { type: "paragraph", content: [{ type: "text", text: CLIENT_MARKER, marks: [{ type: "strong" }] }] },
    ...paragraphs.map((p) => ({ type: "paragraph", content: [{ type: "text", text: p }] })),
  ];
  if (files.length) {
    content.push({
      type: "bulletList",
      content: files.map((f) => ({
        type: "listItem",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: `📎 ${f.name}`, marks: [{ type: "link", attrs: { href: f.url } }] }],
          },
        ],
      })),
    });
  }

  const comment = await jira<{ id: string }>(`/rest/api/3/issue/${issueKey}/comment`, {
    method: "POST",
    body: JSON.stringify({ body: { type: "doc", version: 1, content } }),
  });
  if (!comment) return null;

  await jira(`/rest/api/3/issue/${issueKey}`, {
    method: "PUT",
    body: JSON.stringify({ update: { labels: [{ add: REPLY_LABEL }] } }),
  });
  return comment.id;
}

/** Baixa um anexo da conversa, só se ele for mesmo daquela tarefa. */
export async function fetchChatAttachment(
  issueKey: string,
  attachmentId: string
): Promise<Response | null> {
  const list = await getChatAttachments(issueKey);
  if (!list?.some((a) => a.id === attachmentId)) return null;
  const c = credentials();
  if (!c) return null;
  // O Jira responde com redirect para um link assinado da mídia, que o fetch
  // segue sozinho.
  const res = await fetch(`${c.base}/rest/api/3/attachment/content/${attachmentId}`, {
    headers: { Authorization: authHeader(c) },
    cache: "no-store",
  });
  return res.ok ? res : null;
}
