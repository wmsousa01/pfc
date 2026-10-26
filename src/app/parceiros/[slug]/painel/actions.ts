"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPartnerByPanelToken } from "@/lib/partner-leads";
import {
  createUploadTargets,
  formatDocument,
  getPanelExtras,
  isValidDocument,
  linkFilesToComment,
  recordTermsAcceptance,
  registerClientFiles,
  setJiraChat,
} from "@/lib/client-area";
import { buildTerms } from "@/lib/terms";
import { commentOnEpic, createChatIssue, postClientMessage } from "@/lib/jira";
import { site } from "@/lib/config";

export type AcceptTermsState = { error: string | null };

/**
 * Aceite dos termos na área do cliente.
 *
 * O formulário manda o hash do texto que estava na tela. Se não bater com o
 * texto atual (versão trocada enquanto a aba estava aberta), o aceite é
 * recusado: ninguém aceita um texto diferente do que leu.
 */
export async function acceptTermsAction(
  _prev: AcceptTermsState,
  form: FormData
): Promise<AcceptTermsState> {
  const token = String(form.get("token") ?? "");
  const shownHash = String(form.get("terms_hash") ?? "");
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const document = String(form.get("document") ?? "").replace(/\D/g, "");
  const agreed = form.get("agree") === "on";

  const partner = await getPartnerByPanelToken(token);
  if (!partner) return { error: "Link inválido. Peça um novo ao time do PFC." };

  if (!agreed) return { error: "Marque que leu e concorda com os termos." };
  if (name.length < 5 || !name.includes(" "))
    return { error: "Informe o nome completo de quem está aceitando." };
  if (!isValidDocument(document))
    return { error: "CPF ou CNPJ inválido. Confira os números." };

  const { contract, jiraEpic } = await getPanelExtras(partner.id);
  const terms = contract ? buildTerms(partner.name, contract) : null;
  if (!contract || !terms)
    return { error: "Os termos ainda não foram liberados. Fale com o PFC." };
  if (terms.hash !== shownHash)
    return { error: "Os termos foram atualizados. Recarregue a página e leia de novo." };

  const h = headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  const saved = await recordTermsAcceptance({
    partner_id: partner.id,
    terms_version: terms.version,
    terms_hash: terms.hash,
    accepted_name: name,
    accepted_document: document,
    ip,
    user_agent: h.get("user-agent"),
  });
  if (!saved) return { error: "Não foi possível registrar agora. Tente de novo em instantes." };

  // Cópia para o time ver no Jira. O registro que vale é o do banco; se o
  // Jira falhar, o aceite continua feito.
  if (jiraEpic) {
    await commentOnEpic(jiraEpic, [
      `Termos aceitos pelo cliente no painel (versão ${terms.version}).`,
      `Nome: ${saved.accepted_name}`,
      `Documento: ${formatDocument(saved.accepted_document)}`,
      `Data: ${new Date(saved.accepted_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      `IP: ${ip ?? "não informado"}`,
      `Hash do texto: ${terms.hash}`,
    ]);
  }

  redirect(`/parceiros/${partner.slug}/painel?token=${token}&aba=entregas`);
}

/* ---------------------------------------------------------------------
 * Mensagens e arquivos
 * ------------------------------------------------------------------- */

export type UploadPrep =
  | { ok: true; targets: { path: string; token: string; name: string }[] }
  | { ok: false; error: string };

/** 1º passo do envio: URLs assinadas para o navegador subir os arquivos. */
export async function prepareUploadAction(
  token: string,
  files: { name: string; size: number; type: string }[]
): Promise<UploadPrep> {
  const partner = await getPartnerByPanelToken(token);
  if (!partner) return { ok: false, error: "Link inválido." };
  const targets = await createUploadTargets(partner.id, files);
  return typeof targets === "string" ? { ok: false, error: targets } : { ok: true, targets };
}

/**
 * 2º passo: registra os arquivos já enviados e publica a mensagem na
 * conversa do Jira. A tarefa da conversa nasce na primeira mensagem.
 */
export async function sendMessageAction(
  token: string,
  text: string,
  uploaded: { path: string; name: string }[]
): Promise<{ ok: boolean; error: string | null }> {
  const partner = await getPartnerByPanelToken(token);
  if (!partner) return { ok: false, error: "Link inválido." };

  const body = text.trim().slice(0, 5000);
  if (!body && uploaded.length === 0)
    return { ok: false, error: "Escreva uma mensagem ou anexe um arquivo." };

  const extras = await getPanelExtras(partner.id);
  if (!extras.jiraEpic) return { ok: false, error: "Mensagens ainda não liberadas. Fale com o PFC." };

  let chat = extras.jiraChat;
  if (!chat) {
    chat = await createChatIssue(extras.jiraEpic, partner.name);
    if (!chat) return { ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };
    await setJiraChat(partner.id, chat);
  }

  const files = await registerClientFiles(partner.id, uploaded);
  if (!files) return { ok: false, error: "Algum arquivo não terminou de subir. Envie de novo." };

  const commentId = await postClientMessage(
    chat,
    body || "Enviou arquivos.",
    files.map((f) => ({ name: f.file_name, url: `${site.url}/admin/arquivos/${f.id}` }))
  );
  if (!commentId) return { ok: false, error: "Não foi possível enviar agora. Tente de novo em instantes." };

  await linkFilesToComment(
    files.map((f) => f.id),
    commentId
  );
  revalidatePath(`/parceiros/${partner.slug}/painel`);
  return { ok: true, error: null };
}
