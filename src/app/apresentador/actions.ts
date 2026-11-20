"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { cleanInstagram, db } from "@/lib/agenda/store";
import { TERMO_VERSAO, hashDoTermo } from "@/lib/apresentadores/termo";
import {
  atualizarCadastro,
  cadastroPorToken,
  criarCadastro,
  isTipoMaterial,
  pedirUploadApresentador,
  quadrosDe,
  registrarMaterialApresentador,
  removerMaterialApresentador,
  type NovoCadastro,
} from "@/lib/apresentadores/store";
import { normalizeWhatsapp } from "@/lib/lead-triage";

function str(form: FormData, key: string, max = 2000): string | null {
  const v = String(form.get(key) ?? "").trim().slice(0, max);
  return v || null;
}

function dadosDe(form: FormData): NovoCadastro | string {
  const nome = str(form, "nome", 120);
  if (!nome) return "Diga seu nome.";
  const whatsapp = normalizeWhatsapp(str(form, "whatsapp") ?? "");
  if (!whatsapp) return "Informe um WhatsApp válido com DDD.";
  const email = str(form, "email", 200)?.toLowerCase() ?? null;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return "Informe um e-mail válido.";
  const igRaw = str(form, "instagram", 100);
  const instagram = igRaw ? cleanInstagram(igRaw) : null;
  if (igRaw && !instagram) return "Esse @ do Instagram não parece válido.";
  const quadros = quadrosDe(form);
  if (quadros.length === 0) return "Marque o quadro que você apresenta.";
  return {
    nome,
    papel: str(form, "papel", 60)?.toUpperCase() ?? null,
    email,
    whatsapp,
    instagram,
    quadros,
    bio: str(form, "bio"),
  };
}

/** Cadastro pelo link público. No sucesso, vai para a página pessoal mandar os materiais. */
export async function cadastrarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // Honeypot: bot preenche, humano não vê. Finge sucesso sem gravar.
  if (str(form, "site_url")) return { ok: true, error: null };

  const dados = dadosDe(form);
  if (typeof dados === "string") return { ok: false, error: dados };
  if (form.get("termo_aceite") !== "1") return { ok: false, error: "Para seguir, leia e aceite o termo de uso de imagem." };
  const termoNome = str(form, "termo_nome", 160);
  if (!termoNome || termoNome.split(/\s+/).length < 2) return { ok: false, error: "Escreva seu nome completo para assinar o termo." };
  if (str(form, "termo_hash") !== hashDoTermo()) return { ok: false, error: "O termo foi atualizado. Recarregue a página e leia de novo." };

  const h = headers();
  let token: string;
  try {
    const c = await criarCadastro(dados, {
      termo_versao: TERMO_VERSAO,
      termo_hash: hashDoTermo(),
      termo_nome: termoNome,
      termo_ip: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      termo_user_agent: h.get("user-agent")?.slice(0, 300) ?? null,
    });
    token = c.token;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para cadastrar agora." };
  }
  redirect(`/apresentador/${token}?novo=1`);
}

async function cadastroAtivo(token: string) {
  const c = await cadastroPorToken(token);
  if (!c) throw new Error("Link inválido.");
  if (c.status === "arquivado") throw new Error("Esse cadastro foi encerrado. Fale com a produção.");
  return c;
}

/** O apresentador corrige os próprios dados pelo link. */
export async function salvarDadosAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const c = await cadastroAtivo(str(form, "token") ?? "");
    const dados = dadosDe(form);
    if (typeof dados === "string") return { ok: false, error: dados };
    // Depois de aprovado, quem muda os quadros é a produção (é ela que monta a grade).
    await atualizarCadastro(c.id, c.status === "aprovado" ? { ...dados, quadros: c.quadros } : dados);
    revalidatePath(`/apresentador/${c.token}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para salvar agora." };
  }
}

type Upload = { ok: true; path: string; token: string } | { ok: false; error: string };

export async function pedirUploadAction(token: string, nome: string, mime: string, tamanho: number): Promise<Upload> {
  try {
    const c = await cadastroAtivo(token);
    return { ok: true, ...(await pedirUploadApresentador(c, nome, mime, tamanho)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para enviar agora." };
  }
}

export async function registrarUploadAction(token: string, path: string, nome: string, mime: string, tipo: string): Promise<ActionState> {
  try {
    const c = await cadastroAtivo(token);
    await registrarMaterialApresentador(c, { path, nome, mime, tipo: isTipoMaterial(tipo) ? tipo : "outro", descricao: null });
    revalidatePath(`/apresentador/${token}`);
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não deu para registrar o arquivo." };
  }
}

export async function removerMaterialAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const c = await cadastroPorToken(token);
  if (!c) return;
  await removerMaterialApresentador(c.id, String(form.get("material") ?? ""));
  revalidatePath(`/apresentador/${token}`);
}

/** Pedido de não usar a imagem em conteúdos novos (cláusula 6 do termo). A produção vê no admin. */
export async function revogarTermoAction(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const c = await cadastroPorToken(token);
  if (!c || c.termo_revogado_em) return;
  await atualizarCadastro(c.id, { termo_revogado_em: new Date().toISOString() });
  // Sai das artes novas na hora; o que já foi publicado fica (cláusula 3).
  await db().from("agenda_apresentadores").update({ ativo: false }).eq("cadastro_id", c.id);
  revalidatePath(`/apresentador/${token}`);
}
