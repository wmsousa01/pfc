"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import {
  alternarCota,
  apagarCota,
  getCota,
  MAX_MIDIA,
  modalidadesDo,
  pedirUploadMidia,
  salvarCota,
  trocarLinks,
  type CotaInput,
} from "@/lib/ao-vivo/store";
import { isMomento, isPosicao, isTipo } from "@/lib/ao-vivo/tipos";
import { BUCKET, remover } from "@/lib/producao/store";
import { conferirEnvio } from "@/lib/storage";
import { isQuadroId } from "@/lib/producao/quadros";

export type ActionState = { ok: boolean; error: string | null };

const fail = (e: unknown): ActionState => ({ ok: false, error: e instanceof Error ? e.message : String(e) });
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string) => {
  const v = str(f, k);
  return v === "" ? null : Math.round(Number(v));
};
const data = (f: FormData, k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(str(f, k)) ? str(f, k) : null);

export async function pedirUploadAction(nome: string, mime: string, tamanho: number) {
  await requireAdmin();
  try {
    return { ok: true as const, ...(await pedirUploadMidia(nome, mime, tamanho)) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Cria ou edita a cota (o combinado de inserções com o parceiro). */
export async function salvarCotaAction(form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const id = str(form, "id") || null;
    const quadro = str(form, "quadro");
    const tipo = str(form, "tipo");
    const momento = str(form, "momento");
    const posicao = str(form, "posicao") || "inferior-direito";
    const partner_id = str(form, "partner_id");
    if (!partner_id) throw new Error("Escolha o parceiro.");
    if (!isQuadroId(quadro)) throw new Error("Escolha o quadro.");
    if (!isTipo(tipo)) throw new Error("Escolha o tipo.");
    if (!isMomento(momento)) throw new Error("Escolha o momento.");
    if (!isPosicao(posicao)) throw new Error("Posição inválida.");
    if (momento === "continuo" && tipo !== "logo") throw new Error("Só o logo fica o episódio todo.");

    const modalidade = str(form, "modalidade") || null;
    if (modalidade && !modalidadesDo(quadro).includes(modalidade)) throw new Error("Modalidade não é deste quadro.");

    const freq = str(form, "freq"); // vezes | minutos
    const n = int(form, "freq_n");
    const durante = momento === "durante";
    if (durante && (!n || n < 1)) throw new Error("Diga quantas vezes por episódio ou a cada quantos minutos.");

    let duracao_s = int(form, "duracao_s") ?? 0;
    if (momento === "continuo") duracao_s = 0;
    else if (duracao_s < 3 || duracao_s > 600) throw new Error("Duração entre 3 e 600 segundos.");

    let midia_path = str(form, "midia_path") || null;
    let midia_mime = str(form, "midia_mime") || null;
    if (midia_path && !midia_path.startsWith("ao-vivo/")) throw new Error("Arquivo inválido.");
    if (tipo === "vinheta" && !midia_path) throw new Error("A vinheta precisa do vídeo.");

    const antes = id ? await getCota(id) : null;
    if (id && !antes) throw new Error("Cota não encontrada.");
    if (str(form, "remover_midia") === "1") {
      midia_path = null;
      midia_mime = null;
    }
    if (midia_path && midia_path !== antes?.midia_path) await conferirEnvio(BUCKET, midia_path, MAX_MIDIA);

    const inicio = data(form, "inicio");
    const fim = data(form, "fim");
    if (inicio && fim && fim < inicio) throw new Error("O fim da vigência vem antes do início.");

    const c: CotaInput = {
      partner_id,
      quadro,
      modalidade,
      tipo,
      momento,
      duracao_s,
      vezes: durante && freq !== "minutos" ? Math.min(n!, 30) : null,
      a_cada_min: durante && freq === "minutos" ? Math.min(n!, 180) : null,
      texto: str(form, "texto").slice(0, 140) || null,
      legenda: tipo === "l" ? str(form, "legenda").slice(0, 400) || null : null,
      midia_path,
      midia_mime,
      posicao,
      inicio,
      fim,
      ativo: antes?.ativo ?? true,
      prioridade: int(form, "prioridade") ?? 0,
      observacao: str(form, "observacao").slice(0, 500) || null,
    };
    await salvarCota(id, c);
    if (antes?.midia_path && antes.midia_path !== midia_path) await remover([antes.midia_path]);
    revalidatePath("/admin/ao-vivo");
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

export async function alternarCotaAction(form: FormData): Promise<void> {
  await requireAdmin();
  await alternarCota(str(form, "id"), str(form, "ativo") === "1");
  revalidatePath("/admin/ao-vivo");
}

export async function apagarCotaAction(form: FormData): Promise<void> {
  await requireAdmin();
  await apagarCota(str(form, "id"));
  revalidatePath("/admin/ao-vivo");
}

export async function trocarLinksAction(form: FormData): Promise<void> {
  await requireAdmin();
  const q = str(form, "quadro");
  if (isQuadroId(q)) await trocarLinks(q);
  revalidatePath("/admin/ao-vivo");
}
