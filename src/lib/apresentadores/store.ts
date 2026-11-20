import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { db, newToken } from "@/lib/agenda/store";
import { BUCKET, download, remover, upload } from "@/lib/producao/store";
import { conferirEnvio, urlDeEnvio } from "@/lib/storage";
import { isQuadroId, type QuadroId } from "@/lib/producao/quadros";

/**
 * Cadastro dos apresentadores: eles mesmos se cadastram, aceitam o termo de
 * imagem e mandam os materiais pelo link pessoal. A equipe aprova e liga o
 * cadastro aos quadros (agenda_apresentadores), que é o que entra nas artes.
 */

export type CadastroStatus = "pendente" | "aprovado" | "arquivado";

export type Cadastro = {
  id: string;
  token: string;
  nome: string;
  papel: string | null;
  email: string;
  whatsapp: string;
  instagram: string | null;
  quadros: string[];
  bio: string | null;
  status: CadastroStatus;
  termo_versao: string;
  termo_hash: string;
  termo_nome: string;
  termo_aceito_em: string;
  termo_ip: string | null;
  termo_user_agent: string | null;
  termo_revogado_em: string | null;
  created_at: string;
  updated_at: string;
};

export type MaterialApresentadorTipo = "foto" | "video" | "vinheta" | "logo" | "documento" | "outro";

export const TIPOS_MATERIAL: Record<MaterialApresentadorTipo, string> = {
  foto: "Foto minha",
  video: "Vídeo",
  vinheta: "Vinheta / abertura",
  logo: "Logo",
  documento: "Roteiro / PDF",
  outro: "Outro material",
};

export const isTipoMaterial = (v: string): v is MaterialApresentadorTipo => v in TIPOS_MATERIAL;

export type MaterialApresentador = {
  id: string;
  cadastro_id: string;
  tipo: MaterialApresentadorTipo;
  path: string;
  nome: string;
  mime: string;
  tamanho: number;
  descricao: string | null;
  created_at: string;
};

export const MAX_ARQUIVO = 50 * 1024 * 1024;
export const MAX_ARQUIVOS = 40;
const ACEITOS = /^(image\/|video\/|application\/pdf$)/;

const dirDe = (cadastroId: string) => `apresentadores/${cadastroId}/`;

function nomeSeguro(nome: string): string {
  const s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return s || "arquivo";
}

export type NovoCadastro = {
  nome: string;
  papel: string | null;
  email: string;
  whatsapp: string;
  instagram: string | null;
  quadros: QuadroId[];
  bio: string | null;
};

export type Aceite = {
  termo_versao: string;
  termo_hash: string;
  termo_nome: string;
  termo_ip: string | null;
  termo_user_agent: string | null;
};

export async function criarCadastro(dados: NovoCadastro, aceite: Aceite): Promise<Cadastro> {
  const { data, error } = await db()
    .from("apresentadores_cadastros")
    .insert({ token: newToken(), ...dados, ...aceite })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Cadastro;
}

export async function cadastroPorToken(token: string): Promise<Cadastro | null> {
  if (!token || token.length < 16) return null;
  const { data } = await db().from("apresentadores_cadastros").select("*").eq("token", token).maybeSingle();
  return (data as Cadastro | null) ?? null;
}

export async function getCadastro(id: string): Promise<Cadastro | null> {
  const { data } = await db().from("apresentadores_cadastros").select("*").eq("id", id).maybeSingle();
  return (data as Cadastro | null) ?? null;
}

export async function listCadastros(): Promise<Cadastro[]> {
  const { data } = await db().from("apresentadores_cadastros").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Cadastro[];
}

export async function atualizarCadastro(id: string, patch: Partial<Cadastro>): Promise<void> {
  const { error } = await db()
    .from("apresentadores_cadastros")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function materiaisDoCadastro(cadastroIds: string[]): Promise<MaterialApresentador[]> {
  if (cadastroIds.length === 0) return [];
  const { data } = await db()
    .from("apresentadores_materiais")
    .select("*")
    .in("cadastro_id", cadastroIds)
    .order("created_at", { ascending: false });
  return (data ?? []) as MaterialApresentador[];
}

// ---- Arquivos: do navegador direto ao Storage ----

export async function pedirUploadApresentador(c: Cadastro, nome: string, mime: string, tamanho: number) {
  if (!ACEITOS.test(mime)) throw new Error("Mande imagem, vídeo ou PDF.");
  if (tamanho > MAX_ARQUIVO) throw new Error("Arquivo acima de 50 MB. Para vídeos maiores, fale com a produção.");
  const { count } = await db()
    .from("apresentadores_materiais")
    .select("id", { count: "exact", head: true })
    .eq("cadastro_id", c.id);
  if ((count ?? 0) >= MAX_ARQUIVOS) throw new Error(`Limite de ${MAX_ARQUIVOS} arquivos. Apague algum para mandar outro.`);
  const path = `${dirDe(c.id)}${randomUUID().slice(0, 8)}-${nomeSeguro(nome)}`;
  return { path, url: await urlDeEnvio(BUCKET, path, mime) };
}

/** Registra o arquivo que o navegador acabou de subir, conferindo que ele está mesmo lá. */
export async function registrarMaterialApresentador(
  c: Cadastro,
  m: { path: string; nome: string; mime: string; tipo: MaterialApresentadorTipo; descricao: string | null }
): Promise<void> {
  const dir = dirDe(c.id);
  if (!m.path.startsWith(dir) || m.path.includes("..")) throw new Error("Arquivo fora do seu cadastro.");
  const { tamanho } = await conferirEnvio(BUCKET, m.path, MAX_ARQUIVO);
  const { error } = await db()
    .from("apresentadores_materiais")
    .insert({ cadastro_id: c.id, ...m, nome: m.nome.slice(0, 200), tamanho });
  if (error) throw new Error(error.message);
}

export async function removerMaterialApresentador(cadastroId: string, materialId: string): Promise<void> {
  const { data } = await db()
    .from("apresentadores_materiais")
    .delete()
    .eq("id", materialId)
    .eq("cadastro_id", cadastroId)
    .select("path")
    .maybeSingle();
  if (data?.path) await remover([data.path]);
}

// ---- Aprovação: o cadastro vira apresentador dos quadros ----

/**
 * Liga o cadastro a cada quadro: reaproveita a linha já ligada a ele, ou a
 * de mesmo nome ainda sem cadastro (apresentador criado à mão antes), ou cria.
 * Quadros que saíram da lista ficam inativos, não apagados: episódios antigos
 * ainda apontam para eles.
 */
export async function aprovarCadastro(c: Cadastro, quadros: QuadroId[], fotoMaterialId: string | null): Promise<void> {
  if (quadros.length === 0) throw new Error("Escolha ao menos um quadro.");
  const papel = (c.papel ?? "APRESENTADOR").toUpperCase().slice(0, 60);
  const { data: rows } = await db().from("agenda_apresentadores").select("id, quadro, nome, cadastro_id");
  const todos = (rows ?? []) as { id: string; quadro: string; nome: string; cadastro_id: string | null }[];
  const mesmoNome = (n: string) => n.trim().toLowerCase() === c.nome.trim().toLowerCase();

  const ligados: string[] = [];
  for (const q of quadros) {
    const existente =
      todos.find((r) => r.quadro === q && r.cadastro_id === c.id) ??
      todos.find((r) => r.quadro === q && !r.cadastro_id && mesmoNome(r.nome));
    if (existente) {
      const { error } = await db()
        .from("agenda_apresentadores")
        .update({ cadastro_id: c.id, nome: c.nome, papel, ativo: true })
        .eq("id", existente.id);
      if (error) throw new Error(error.message);
      ligados.push(existente.id);
    } else {
      const { data, error } = await db()
        .from("agenda_apresentadores")
        .insert({ quadro: q, nome: c.nome, papel, cadastro_id: c.id })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      ligados.push(data.id);
    }
  }
  const fora = todos.filter((r) => r.cadastro_id === c.id && !ligados.includes(r.id)).map((r) => r.id);
  if (fora.length) await db().from("agenda_apresentadores").update({ ativo: false }).in("id", fora);

  if (fotoMaterialId) await usarComoFotoPadrao(c.id, fotoMaterialId, ligados);
  await atualizarCadastro(c.id, { status: "aprovado", quadros });
}

/** A foto escolhida vira a foto padrão do apresentador nos quadros dele (JPEG até 1600 px). */
export async function usarComoFotoPadrao(cadastroId: string, materialId: string, apresentadorIds?: string[]): Promise<void> {
  const { data: m } = await db()
    .from("apresentadores_materiais")
    .select("*")
    .eq("id", materialId)
    .eq("cadastro_id", cadastroId)
    .maybeSingle();
  if (!m) throw new Error("Foto não encontrada.");
  if (!String(m.mime).startsWith("image/")) throw new Error("Escolha uma foto, não vídeo ou PDF.");
  const raw = await download(m.path);
  if (!raw) throw new Error("Não deu para ler a foto no Storage.");
  let jpeg: Buffer;
  try {
    jpeg = await sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 90 }).toBuffer();
  } catch {
    throw new Error("Formato de foto não suportado (HEIC?). Peça em JPG ou PNG.");
  }

  let ids = apresentadorIds;
  if (!ids) {
    const { data } = await db().from("agenda_apresentadores").select("id").eq("cadastro_id", cadastroId);
    ids = (data ?? []).map((r) => r.id as string);
  }
  if (ids.length === 0) throw new Error("Aprove o cadastro num quadro antes de escolher a foto padrão.");

  for (const id of ids) {
    // Nome novo a cada troca: a URL assinada antiga não mostra a foto velha do cache.
    const path = `agenda/apresentadores/${id}-${Date.now().toString(36)}.jpg`;
    await upload(path, jpeg, "image/jpeg");
    const { data: antes } = await db().from("agenda_apresentadores").select("foto_path").eq("id", id).maybeSingle();
    await db().from("agenda_apresentadores").update({ foto_path: path }).eq("id", id);
    if (antes?.foto_path) await remover([antes.foto_path]);
  }
}

/** Quadros válidos de um form (checkboxes "quadro"). */
export function quadrosDe(form: FormData): QuadroId[] {
  return Array.from(new Set(form.getAll("quadro").map(String))).filter(isQuadroId);
}
