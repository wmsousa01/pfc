import "server-only";
import { pode, type Acesso } from "@/lib/auth";
import { APROVAR_MATERIAIS } from "@/lib/permissoes";
import { QUADROS, isQuadroId } from "@/lib/producao/quadros";
import { db } from "@/lib/producao/store";
import { TZ } from "@/lib/agenda/store";
import { abrirUpload, apagar, arquivo, garantirCaminho } from "./drive";
import { CATEGORIAS, TIPOS, isCategoria, type Categoria, type Material, type StatusMaterial } from "./tipos";

export * from "./tipos";

/** Teto por arquivo. O Drive aceita bem mais; isto só barra o engano (pasta zipada inteira). */
export const MAX_ARQUIVO = 20 * 1024 * 1024 * 1024;

export const podeAprovar = (a: Acesso) => pode(a, APROVAR_MATERIAIS);
const quem = (a: Acesso) => a.nome ?? a.email ?? a.userId;

export async function logMaterial(id: string, actor: string, action: string, detail?: string) {
  await db().from("materiais_eventos").insert({ material_id: id, actor, action, detail: detail ?? null });
}

export type EpisodioOpcao = { id: string; quadro: string; inicio: string; label: string };

/**
 * Episódios para o editor escolher: os últimos 90 dias e as próximas duas
 * semanas, mais recentes primeiro, com o nome dos convidados.
 */
export async function episodiosRecentes(): Promise<EpisodioOpcao[]> {
  const de = new Date(Date.now() - 90 * 86_400_000).toISOString();
  const ate = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { data: eps } = await db()
    .from("agenda_episodios")
    .select("id, quadro, inicio, tema")
    .gte("inicio", de)
    .lte("inicio", ate)
    .neq("status", "cancelado")
    .order("inicio", { ascending: false })
    .limit(150);
  const lista = (eps ?? []) as { id: string; quadro: string; inicio: string; tema: string | null }[];
  if (lista.length === 0) return [];
  const { data: cs } = await db()
    .from("agenda_convidados")
    .select("episodio_id, nome")
    .in("episodio_id", lista.map((e) => e.id));
  const nomes = new Map<string, string[]>();
  for (const c of (cs ?? []) as { episodio_id: string; nome: string }[]) {
    nomes.set(c.episodio_id, [...(nomes.get(c.episodio_id) ?? []), c.nome]);
  }
  return lista.map((e) => ({
    id: e.id,
    quadro: e.quadro,
    inicio: e.inicio,
    label: rotuloEpisodio(e.inicio, nomes.get(e.id)?.join(", ") || e.tema || "Sem convidado"),
  }));
}

const rotuloEpisodio = (inicio: string, quem: string) =>
  `${new Date(inicio).toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" })} · ${quem}`;

/** Pasta do episódio no Drive: "2026-11-04 · Fulano, Ciclano" (ordena por data). */
async function grupoDoEpisodio(id: string): Promise<{ quadro: string; nome: string } | null> {
  const { data: ep } = await db().from("agenda_episodios").select("id, quadro, inicio, tema").eq("id", id).maybeSingle();
  if (!ep) return null;
  const { data: cs } = await db().from("agenda_convidados").select("nome").eq("episodio_id", id).order("created_at");
  const nomes = ((cs ?? []) as { nome: string }[]).map((c) => c.nome).join(", ");
  const dia = new Date(ep.inicio).toLocaleDateString("en-CA", { timeZone: TZ });
  return { quadro: ep.quadro, nome: `${dia} · ${nomes || ep.tema || "Sem convidado"}` };
}

export type NovoEnvio = {
  categoria: Categoria;
  quadro: string | null;
  episodio_id: string | null;
  referencia: string | null;
  tipo: string;
  titulo: string;
  nota: string | null;
  substitui_id: string | null;
};

/**
 * Caminho no Drive a partir da raiz:
 * Quadros/<Quadro>/<episódio ou referência> · PFC Visita/<negócio> ·
 * Anúncios/<cliente> · Vinhetas[/<nome>].
 */
async function caminhoDe(m: NovoEnvio): Promise<string[]> {
  const ep = m.episodio_id ? await grupoDoEpisodio(m.episodio_id) : null;
  const grupo = ep?.nome ?? m.referencia;
  switch (m.categoria) {
    case "quadro": {
      const quadro = isQuadroId(m.quadro ?? "") ? QUADROS[m.quadro as keyof typeof QUADROS].name : m.quadro || "Outros";
      return [CATEGORIAS.quadro.pasta, quadro, grupo || "Sem episódio"];
    }
    case "visita":
      return [CATEGORIAS.visita.pasta, grupo || "Sem negócio"];
    case "anuncio":
      return [CATEGORIAS.anuncio.pasta, grupo || "Sem cliente"];
    case "vinheta":
      return grupo ? [CATEGORIAS.vinheta.pasta, grupo] : [CATEGORIAS.vinheta.pasta];
  }
}

function validar(m: NovoEnvio): NovoEnvio {
  if (!isCategoria(m.categoria)) throw new Error("Escolha a categoria.");
  if (!(m.tipo in TIPOS) || !CATEGORIAS[m.categoria].tipos.includes(m.tipo)) throw new Error("Escolha o tipo do material.");
  const titulo = m.titulo.trim().slice(0, 160);
  if (!titulo) throw new Error("Dê um título ao material.");
  const referencia = m.referencia?.trim().slice(0, 120) || null;
  if (m.categoria === "quadro" && !m.quadro) throw new Error("Escolha o quadro.");
  if ((m.categoria === "visita" || m.categoria === "anuncio") && !m.episodio_id && !referencia) {
    throw new Error(m.categoria === "visita" ? "Escolha o episódio ou escreva o nome do negócio." : "Escreva o cliente ou a campanha.");
  }
  return {
    ...m,
    titulo,
    referencia,
    quadro: m.categoria === "quadro" ? m.quadro : m.categoria === "visita" ? "pfc-visita" : null,
    nota: m.nota?.trim().slice(0, 1000) || null,
  };
}

/** Nome do arquivo no Drive: o original, com a versão na frente a partir da segunda. */
function nomeNoDrive(original: string, versao: number): string {
  const limpo = original.replace(/[\\/]+/g, "-").trim().slice(-180) || "arquivo";
  return versao > 1 ? `v${versao} - ${limpo}` : limpo;
}

export type Sessao = { id: string; uploadUrl: string };

/**
 * Primeiro passo do envio: cria a pasta (se preciso), registra o material como
 * "enviando" e abre a sessão de upload no Drive. Nova versão herda tudo do
 * material original, menos a nota.
 */
export async function iniciarEnvio(
  a: Acesso,
  dados: NovoEnvio,
  f: { nome: string; mime: string; tamanho: number },
  origin: string
): Promise<Sessao> {
  if (!(f.tamanho > 0)) throw new Error("Arquivo vazio.");
  if (f.tamanho > MAX_ARQUIVO) throw new Error("Arquivo acima de 20 GB. Divida em partes ou fale com a produção.");

  let m: NovoEnvio;
  let versao = 1;
  if (dados.substitui_id) {
    const orig = await getMaterial(dados.substitui_id);
    if (!orig) throw new Error("O material original não existe mais.");
    if (orig.enviado_por !== a.userId && !podeAprovar(a)) throw new Error("Só quem enviou pode mandar nova versão.");
    if (orig.status !== "ajuste" && orig.status !== "recebido") throw new Error("Esse material não está esperando nova versão.");
    m = {
      categoria: orig.categoria,
      quadro: orig.quadro,
      episodio_id: orig.episodio_id,
      referencia: orig.referencia,
      tipo: orig.tipo,
      titulo: orig.titulo,
      nota: dados.nota?.trim().slice(0, 1000) || null,
      substitui_id: orig.id,
    };
    versao = orig.versao + 1;
  } else {
    m = validar(dados);
  }

  const pastaId = await garantirCaminho(await caminhoDe(m));
  const nome = nomeNoDrive(f.nome, versao);
  const mime = f.mime || "application/octet-stream";

  const { data, error } = await db()
    .from("materiais")
    .insert({
      ...m,
      versao,
      status: "enviando",
      drive_pasta_id: pastaId,
      nome_arquivo: nome,
      mime,
      tamanho: f.tamanho,
      enviado_por: a.userId,
      enviado_por_nome: quem(a),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não registrou o envio.");

  try {
    const uploadUrl = await abrirUpload({ pastaId, nome, mime, tamanho: f.tamanho, origin });
    return { id: data.id, uploadUrl };
  } catch (e) {
    await db().from("materiais").delete().eq("id", data.id);
    throw e;
  }
}

/**
 * Segundo passo: o navegador terminou o PUT e mandou o id do arquivo. Confere
 * no Drive que o arquivo existe e está na pasta reservada antes de dar como
 * recebido; nova versão aposenta a anterior.
 */
export async function confirmarEnvio(a: Acesso, id: string, fileId: string): Promise<Material> {
  const m = await getMaterial(id);
  if (!m || m.enviado_por !== a.userId) throw new Error("Envio não encontrado.");
  if (m.status !== "enviando") return m;

  const f = await arquivo(fileId);
  if (!f || f.trashed || !m.drive_pasta_id || !f.parents?.includes(m.drive_pasta_id)) {
    throw new Error("O arquivo não chegou ao Drive. Tente enviar de novo.");
  }

  const { data, error } = await db()
    .from("materiais")
    .update({
      status: "recebido",
      drive_file_id: f.id,
      tamanho: f.size ? Number(f.size) : m.tamanho,
      mime: f.mimeType || m.mime,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "enviando")
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não confirmou o envio.");

  if (m.substitui_id) {
    await db().from("materiais").update({ status: "substituido", updated_at: new Date().toISOString() }).eq("id", m.substitui_id);
    await logMaterial(m.substitui_id, quem(a), "enviou nova versão", `v${m.versao}`);
  }
  await logMaterial(id, quem(a), "enviou", `${m.nome_arquivo}${m.nota ? ` · ${m.nota}` : ""}`);
  return data as Material;
}

/** Upload que falhou no meio: some da lista e, se o arquivo chegou a ser criado, do Drive. */
export async function cancelarEnvio(a: Acesso, id: string, fileId?: string | null): Promise<void> {
  const m = await getMaterial(id);
  if (!m || m.enviado_por !== a.userId || m.status !== "enviando") return;
  if (fileId) await apagar(fileId);
  await db().from("materiais").delete().eq("id", id).eq("status", "enviando");
}

export async function revisar(a: Acesso, id: string, decisao: "aprovado" | "ajuste", comentario: string): Promise<void> {
  if (!podeAprovar(a)) throw new Error("Você não tem permissão para revisar materiais.");
  const m = await getMaterial(id);
  if (!m) throw new Error("Material não encontrado.");
  if (m.status !== "recebido" && m.status !== "ajuste" && m.status !== "aprovado") throw new Error("Esse material não está em revisão.");
  const texto = comentario.trim().slice(0, 2000);
  if (decisao === "ajuste" && !texto) throw new Error("Diga o que precisa ajustar.");
  const { error } = await db()
    .from("materiais")
    .update({
      status: decisao,
      comentario: texto || null,
      revisado_por: quem(a),
      revisado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logMaterial(id, quem(a), decisao === "aprovado" ? "aprovou" : "pediu ajuste", texto || undefined);
}

export async function arquivar(a: Acesso, id: string): Promise<void> {
  if (!podeAprovar(a)) throw new Error("Você não tem permissão para arquivar materiais.");
  const { error } = await db().from("materiais").update({ status: "arquivado", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(error.message);
  await logMaterial(id, quem(a), "arquivou");
}

export async function getMaterial(id: string): Promise<Material | null> {
  const { data } = await db().from("materiais").select("*").eq("id", id).maybeSingle();
  return (data as Material) ?? null;
}

/** Quem não revisa só vê o que enviou. */
export function podeVer(a: Acesso, m: Material): boolean {
  return podeAprovar(a) || m.enviado_por === a.userId;
}

export type Filtro = { categoria?: Categoria; status?: StatusMaterial[]; busca?: string; limite?: number };

export async function listarMateriais(a: Acesso, f: Filtro = {}): Promise<Material[]> {
  let q = db()
    .from("materiais")
    .select("*")
    .neq("status", "enviando")
    .order("created_at", { ascending: false })
    .limit(f.limite ?? 300);
  if (!podeAprovar(a)) q = q.eq("enviado_por", a.userId);
  if (f.categoria) q = q.eq("categoria", f.categoria);
  if (f.status?.length) q = q.in("status", f.status);
  if (f.busca) {
    const b = f.busca.replace(/[%,()]/g, " ").trim();
    if (b) q = q.or(`titulo.ilike.%${b}%,referencia.ilike.%${b}%,nome_arquivo.ilike.%${b}%,enviado_por_nome.ilike.%${b}%`);
  }
  const { data } = await q;
  return (data ?? []) as Material[];
}

/** Todas as versões do material, da primeira à atual. */
export async function versoesDe(m: Material): Promise<Material[]> {
  let raiz = m;
  for (let i = 0; i < 20 && raiz.substitui_id; i++) {
    const ant = await getMaterial(raiz.substitui_id);
    if (!ant) break;
    raiz = ant;
  }
  const out = [raiz];
  for (let i = 0; i < 20; i++) {
    const { data } = await db()
      .from("materiais")
      .select("*")
      .eq("substitui_id", out[out.length - 1].id)
      .neq("status", "enviando")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) break;
    out.push(data as Material);
  }
  return out;
}

export async function eventosDe(id: string) {
  const { data } = await db().from("materiais_eventos").select("*").eq("material_id", id).order("created_at");
  return (data ?? []) as { id: number; actor: string; action: string; detail: string | null; created_at: string }[];
}

/** Número do menu: quem revisa vê o que chegou; o editor, os ajustes pedidos a ele. */
export async function contadorMateriais(a: Acesso): Promise<{ n: number; alerta?: boolean }> {
  try {
    if (podeAprovar(a)) {
      const { count } = await db().from("materiais").select("id", { count: "exact", head: true }).eq("status", "recebido");
      return { n: count ?? 0 };
    }
    const { count } = await db()
      .from("materiais")
      .select("id", { count: "exact", head: true })
      .eq("status", "ajuste")
      .eq("enviado_por", a.userId);
    return { n: count ?? 0, alerta: (count ?? 0) > 0 };
  } catch {
    return { n: 0 };
  }
}
