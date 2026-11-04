import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { BUCKET, download } from "@/lib/producao/store";
import { db, logAgenda, type Material, type MaterialTipo } from "./store";

/**
 * Fotos, logos e referências do episódio. O arquivo vai do navegador direto
 * para o Storage por URL assinada: a função da Vercel não aceita corpo acima
 * de 4,5 MB, e foto de celular e vídeo passam disso fácil.
 */
export const MAX_MATERIAL = 50 * 1024 * 1024;
const ACEITOS = /^(image\/|video\/|application\/pdf$)/;

const dirDe = (episodioId: string) => `agenda/${episodioId}/materiais/`;

function nomeSeguro(nome: string): string {
  const s = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(-80);
  return s || "arquivo";
}

export type PedidoUpload = { path: string; token: string };

/** URL assinada para o navegador subir um arquivo do episódio. */
export async function pedirUpload(episodioId: string, nome: string, mime: string, tamanho: number): Promise<PedidoUpload> {
  if (!ACEITOS.test(mime)) throw new Error("Mande imagem, vídeo ou PDF.");
  if (tamanho > MAX_MATERIAL) throw new Error("Arquivo acima de 50 MB.");
  const path = `${dirDe(episodioId)}${randomUUID().slice(0, 8)}-${nomeSeguro(nome)}`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Storage: ${error?.message ?? "sem URL"}`);
  return { path, token: data.token };
}

export type NovoMaterial = {
  episodio_id: string;
  convidado_id: string | null;
  apresentador_id: string | null;
  tipo: MaterialTipo;
  path: string;
  nome: string;
  mime: string;
  enviado_por: string;
  /** Bloco do espelho da transmissão; fora dele quando não vem. */
  bloco?: number | null;
};

/** Registra o arquivo que o navegador acabou de subir, conferindo que ele está mesmo lá. */
export async function registrarMaterial(m: NovoMaterial): Promise<Material> {
  const dir = dirDe(m.episodio_id);
  if (!m.path.startsWith(dir) || m.path.includes("..")) throw new Error("Arquivo fora do episódio.");
  const file = m.path.slice(dir.length);
  const { data: lista } = await db().storage.from(BUCKET).list(dir.slice(0, -1), { search: file, limit: 5 });
  const obj = (lista ?? []).find((o) => o.name === file);
  if (!obj) throw new Error("O arquivo não chegou. Tente enviar de novo.");
  const tamanho = Number((obj.metadata as { size?: number } | null)?.size ?? 0);

  const { data, error } = await db()
    .from("agenda_materiais")
    .insert({ ...m, nome: m.nome.slice(0, 200), tamanho, usar_na_arte: m.tipo !== "outro" })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logAgenda(m.episodio_id, m.enviado_por, "enviou material", `${m.nome} (${m.tipo})`);
  return data as Material;
}

export async function removerMaterial(id: string, actor: string): Promise<void> {
  const { data } = await db().from("agenda_materiais").delete().eq("id", id).select("*").maybeSingle();
  if (!data) return;
  await db().storage.from(BUCKET).remove([data.path]);
  await logAgenda(data.episodio_id, actor, "apagou material", data.nome);
}

/**
 * Imagem pronta para mandar ao Gemini ou recortar: girada, no máximo 1600 px,
 * JPEG (PNG com transparência fica PNG, por causa dos logos). Arquivo que o
 * sharp não abre (HEIC, vídeo) volta null.
 */
export async function imagemDe(path: string): Promise<{ buf: Buffer; mime: string } | null> {
  const raw = await download(path);
  if (!raw) return null;
  try {
    const img = sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true });
    const meta = await sharp(raw).metadata();
    if (meta.hasAlpha) return { buf: await img.png().toBuffer(), mime: "image/png" };
    return { buf: await img.jpeg({ quality: 88 }).toBuffer(), mime: "image/jpeg" };
  } catch {
    return null;
  }
}
