"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { MAX_ACOMPANHANTES } from "@/components/agenda/BriefingFields";
import { adicionarConvidado, atualizarPerfilIg, agendar, salvarFoto, sincronizarAgenda, type NovoConvidado } from "@/lib/agenda/fluxo";
import { pedirUpload, registrarMaterial, removerMaterial } from "@/lib/agenda/materiais";
import {
  CONVIDADO,
  cleanInstagram,
  convidadoPorToken,
  convidadosDe,
  db,
  getEpisodio,
  logAgenda,
  updateConvidado,
  type MaterialTipo,
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
    cargo: str(form, "cargo", 60)?.toUpperCase() ?? null,
  };
}

/**
 * Quem vem junto: só o nome é obrigatório; WhatsApp e e-mail, se vierem, têm
 * que ser válidos. `prefix` é "extra_<n>_" no pedido e "" no link do convidado.
 */
function acompanhanteDe(form: FormData, prefix: string): NovoConvidado | string {
  const nome = str(form, `${prefix}nome`, 120);
  if (!nome) return "Diga o nome de cada pessoa que vem junto.";
  const waRaw = str(form, `${prefix}whatsapp`);
  const whatsapp = waRaw ? normalizeWhatsapp(waRaw) : null;
  if (waRaw && !whatsapp) return `O WhatsApp de ${nome} não parece válido. Use o DDD.`;
  const email = str(form, `${prefix}email`, 200)?.toLowerCase() ?? null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return `O e-mail de ${nome} não parece válido.`;
  const igRaw = str(form, `${prefix}instagram`, 100);
  const instagram = igRaw ? cleanInstagram(igRaw) : null;
  if (igRaw && !instagram) return `O @ do Instagram de ${nome} não parece válido.`;
  return {
    nome,
    whatsapp,
    email,
    instagram,
    bio: null,
    temas: null,
    divulgar: null,
    links: null,
    cargo: str(form, `${prefix}cargo`, 60)?.toUpperCase() ?? null,
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
  const extras: NovoConvidado[] = [];
  for (const id of form.getAll("extra").map(String).slice(0, MAX_ACOMPANHANTES)) {
    if (!/^\d+$/.test(id)) continue;
    const e = acompanhanteDe(form, `extra_${id}_`);
    if (typeof e === "string") return { ok: false, error: e };
    extras.push(e);
  }

  let token: string;
  try {
    const c = await agendar(quadro, inicio, dados);
    token = c.token;
    // Foto e perfil são acabamento: se falharem, o horário já está garantido.
    if (foto) await salvarFoto(c.id, foto).catch(() => null);
    await atualizarPerfilIg(c).catch(() => null);
    for (const e of extras) {
      const a = await adicionarConvidado(c.episodio_id, e).catch(() => null);
      if (!a) continue;
      await logAgenda(c.episodio_id, CONVIDADO, "adicionou convidado", `${a.nome} (por ${c.nome})`).catch(() => null);
      await atualizarPerfilIg(a).catch(() => null);
    }
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

/** Pelo link dele, o convidado traz mais alguém para o mesmo episódio. */
export async function adicionarAcompanhanteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const c = await convidadoAtivo(str(form, "token") ?? "");
    const dados = acompanhanteDe(form, "");
    if (typeof dados === "string") return { ok: false, error: dados };
    const todos = await convidadosDe(c.episodio_id);
    if (todos.length >= MAX_ACOMPANHANTES + 1)
      return { ok: false, error: `O episódio já tem ${todos.length} convidados. Para trazer mais gente, fale com a produção.` };
    const a = await adicionarConvidado(c.episodio_id, dados);
    await logAgenda(c.episodio_id, CONVIDADO, "adicionou convidado", `${a.nome} (por ${c.nome})`);
    await atualizarPerfilIg(a).catch(() => null);
    if (a.email) await sincronizarAgenda(c.episodio_id, CONVIDADO);
    revalidatePath(`/convidado/b/${c.token}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para adicionar agora." };
  }
}

// ---- Materiais: fotos, logo e referências que o convidado manda pelo link ----

type Upload = { ok: true; path: string; token: string } | { ok: false; error: string };

/** O convidado só mexe no episódio dele, e enquanto ele não foi gravado nem cancelado. */
async function convidadoAtivo(token: string) {
  const c = await convidadoPorToken(token);
  if (!c) throw new Error("Link inválido.");
  const ep = await getEpisodio(c.episodio_id);
  if (!ep || ep.status === "cancelado" || ep.status === "realizado") throw new Error("Esse episódio não recebe mais materiais.");
  return c;
}

export async function pedirUploadConvidadoAction(token: string, nome: string, mime: string, tamanho: number): Promise<Upload> {
  try {
    const c = await convidadoAtivo(token);
    const { count } = await db().from("agenda_materiais").select("id", { count: "exact", head: true }).eq("convidado_id", c.id);
    if ((count ?? 0) >= 20) throw new Error("Limite de 20 arquivos. Apague algum para mandar outro.");
    return { ok: true, ...(await pedirUpload(c.episodio_id, nome, mime, tamanho)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para enviar agora." };
  }
}

export async function registrarMaterialConvidadoAction(
  token: string,
  path: string,
  nome: string,
  mime: string,
  tipo: string
): Promise<ActionState> {
  try {
    const c = await convidadoAtivo(token);
    const t: MaterialTipo = tipo === "foto" || tipo === "logo" || tipo === "referencia" ? tipo : "outro";
    await registrarMaterial({
      episodio_id: c.episodio_id,
      convidado_id: c.id,
      apresentador_id: null,
      tipo: t,
      path,
      nome,
      mime,
      enviado_por: CONVIDADO,
    });
    revalidatePath(`/convidado/b/${token}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para registrar o arquivo." };
  }
}

export async function removerMaterialConvidadoAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const c = await convidadoPorToken(token);
  if (!c) return;
  const { data } = await db().from("agenda_materiais").select("convidado_id").eq("id", String(form.get("material") ?? "")).maybeSingle();
  if (data?.convidado_id !== c.id) return;
  await removerMaterial(String(form.get("material")), CONVIDADO);
  revalidatePath(`/convidado/b/${token}`);
}
