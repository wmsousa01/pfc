"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { atualizarPerfilIg, agendar, salvarFoto, sincronizarAgenda, type NovoConvidado } from "@/lib/agenda/fluxo";
import {
  CONVIDADO,
  cleanInstagram,
  convidadoPorToken,
  getEpisodio,
  logAgenda,
  updateConvidado,
} from "@/lib/agenda/store";
import { normalizeWhatsapp } from "@/lib/lead-triage";
import { isQuadroId } from "@/lib/producao/quadros";

function str(form: FormData, key: string, max = 2000): string | null {
  const v = String(form.get(key) ?? "").trim().slice(0, max);
  return v || null;
}

/** Campos do briefing, validados. Erro volta como string. */
function dadosDe(form: FormData): NovoConvidado | string {
  const nome = str(form, "nome", 120);
  if (!nome) return "Diga seu nome.";
  const whatsapp = normalizeWhatsapp(str(form, "whatsapp") ?? "");
  if (!whatsapp) return "Informe um WhatsApp válido com DDD.";
  const email = str(form, "email", 200)?.toLowerCase() ?? null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Informe um e-mail válido: é por ele que chega o convite da agenda.";
  const igRaw = str(form, "instagram", 100);
  const instagram = igRaw ? cleanInstagram(igRaw) : null;
  if (igRaw && !instagram) return "Esse @ do Instagram não parece válido.";
  return {
    nome,
    whatsapp,
    email,
    instagram,
    bio: str(form, "bio"),
    temas: str(form, "temas"),
    divulgar: str(form, "divulgar"),
    links: str(form, "links", 500),
  };
}

function fotoDe(form: FormData): File | null {
  const f = form.get("foto");
  return f instanceof File && f.size > 0 ? f : null;
}

/** Pedido de horário pelo link público. No sucesso, vai para a página do convidado. */
export async function agendarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // Honeypot: bot preenche, humano não vê. Finge sucesso sem gravar.
  if (str(form, "site_url")) return { ok: true, error: null };

  const quadro = str(form, "quadro");
  const inicio = str(form, "inicio");
  if (!isQuadroId(quadro)) return { ok: false, error: "Quadro inválido." };
  if (!inicio) return { ok: false, error: "Escolha um horário." };
  const dados = dadosDe(form);
  if (typeof dados === "string") return { ok: false, error: dados };
  const foto = fotoDe(form);

  let token: string;
  try {
    const c = await agendar(quadro, inicio, dados);
    token = c.token;
    // Foto e perfil são acabamento: se falharem, o horário já está garantido.
    if (foto) await salvarFoto(c.id, foto).catch(() => null);
    await atualizarPerfilIg(c).catch(() => null);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para agendar agora." };
  }
  redirect(`/convidado/b/${token}?novo=1`);
}

/** O convidado completa ou corrige o briefing pelo link dele. */
export async function salvarBriefingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const token = str(form, "token") ?? "";
  const c = await convidadoPorToken(token);
  if (!c) return { ok: false, error: "Link inválido." };
  const ep = await getEpisodio(c.episodio_id);
  if (!ep || ep.status === "cancelado") return { ok: false, error: "Esse episódio foi cancelado." };
  const dados = dadosDe(form);
  if (typeof dados === "string") return { ok: false, error: dados };

  try {
    const igMudou = dados.instagram !== c.instagram;
    await updateConvidado(c.id, { ...dados, briefing_em: new Date().toISOString() });
    const foto = fotoDe(form);
    if (foto) await salvarFoto(c.id, foto);
    if (igMudou) await atualizarPerfilIg({ ...c, ...dados }).catch(() => null);
    await logAgenda(ep.id, CONVIDADO, "atualizou o briefing", dados.nome);
    // E-mail novo precisa entrar no convite da agenda.
    if (dados.email !== c.email) await sincronizarAgenda(ep.id, CONVIDADO);
    revalidatePath(`/convidado/b/${token}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para salvar agora." };
  }
}
