"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import {
  addDeliveryLink,
  createClientEpic,
  createDelivery,
  transitionTo,
} from "@/lib/jira";
import { rotatePanelToken, setClientContract } from "@/lib/client-area";
import { getPartnerById } from "@/lib/admin";
import { CURRENT_TERMS_VERSION } from "@/lib/terms";
import type { ClientContract } from "@/lib/types";

const PATH = "/admin/entregas";
// "layout": a lista e a página de cada cliente mostram as mesmas entregas.
const refresh = () => revalidatePath(PATH, "layout");
const ISSUE_KEY = /^[A-Z][A-Z0-9]+-\d+$/;

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function isoDate(v: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export async function createDeliveryAction(form: FormData): Promise<void> {
  await requireAdmin();
  const epic = str(form, "epic");
  const title = str(form, "title").slice(0, 200);
  if (!ISSUE_KEY.test(epic) || title.length < 3) return;
  await createDelivery(epic, title, isoDate(str(form, "due")));
  refresh();
}

/** Marca como entregue; se vier um link, anexa antes, para o cliente já ver. */
export async function deliverAction(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!ISSUE_KEY.test(key)) return;
  const url = str(form, "url");
  if (url) await addDeliveryLink(key, url, str(form, "link_title"));
  await transitionTo(key, "done");
  refresh();
}

export async function addLinkAction(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  const url = str(form, "url");
  if (!ISSUE_KEY.test(key) || !url) return;
  await addDeliveryLink(key, url, str(form, "link_title"));
  refresh();
}

export async function reopenAction(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!ISSUE_KEY.test(key)) return;
  await transitionTo(key, "new");
  refresh();
}

export async function rotateTokenAction(form: FormData): Promise<void> {
  await requireAdmin();
  // Confirmação explícita: trocar o token derruba o link que o cliente já tem.
  if (form.get("confirm") !== "on") return;
  const partnerId = str(form, "partner_id");
  if (partnerId) await rotatePanelToken(partnerId);
  refresh();
}

/**
 * Liga a área do cliente de um patrocinador: cria o Epic no Jira e grava o
 * contrato (que gera os termos para ele aceitar no portal).
 */
export async function activateClientAreaAction(form: FormData): Promise<void> {
  await requireAdmin();
  const partner = await getPartnerById(str(form, "partner_id"));
  if (!partner) return;

  const price = Number(str(form, "price").replace(/\./g, "").replace(",", "."));
  const months = Number.parseInt(str(form, "months"), 10);
  const start = isoDate(str(form, "start"));
  const plan = str(form, "plan");
  const deliverables = str(form, "deliverables")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!plan || !start || !Number.isFinite(price) || price <= 0 || !(months > 0) || !deliverables.length) return;

  const contract: ClientContract = {
    plan,
    price,
    payment: str(form, "payment") || "conforme combinado",
    start,
    months,
    deliverables,
    terms_version: CURRENT_TERMS_VERSION,
  };

  const epic = await createClientEpic(partner.name, plan, [
    `Contrato: Plano ${plan}, ${price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${contract.payment}). Início ${start}, ${months} meses.`,
  ]);
  if (!epic) return;
  await setClientContract(partner.id, epic, contract);
  refresh();
  redirect(`${PATH}/${partner.slug}`);
}
