"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { gerarArte } from "@/lib/ads/arte";
import { publicarStory } from "@/lib/ads/fila";
import { atualizar, getOferta, proximoHorario, recusar } from "@/lib/ads/store";

const refresh = () => {
  revalidatePath("/admin/ofertas");
  revalidatePath("/ofertas");
};
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/** Aprova: gera a arte e agenda o story no próximo horário livre da semana. */
export async function aprovarOferta(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o || o.status !== "paga") return;
  try {
    const arte = await gerarArte(o);
    const quando = await proximoHorario(o.semana);
    await atualizar(o.id, {
      status: "aprovada",
      aprovada_em: new Date().toISOString(),
      arte_path: arte,
      publicar_em: new Date(quando).toISOString(),
      erro: null,
    });
  } catch (e) {
    await atualizar(o.id, { erro: `Aprovação: ${msg(e)}` });
  }
  refresh();
}

/** Refaz a arte (texto corrigido, logo nova) sem mudar o horário. */
export async function refazerArte(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o || !["aprovada", "erro"].includes(o.status)) return;
  try {
    await atualizar(o.id, { arte_path: await gerarArte(o), erro: null });
  } catch (e) {
    await atualizar(o.id, { erro: `Arte: ${msg(e)}` });
  }
  refresh();
}

/** Corrige título e detalhes antes de aprovar (erro de digitação, texto longo). */
export async function editarTexto(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o || !["paga", "aprovada", "erro"].includes(o.status)) return;
  const titulo = String(fd.get("titulo") ?? "").trim().slice(0, 60);
  const descricao = String(fd.get("descricao") ?? "").trim().slice(0, 220);
  if (titulo.length < 4 || descricao.length < 10) return;
  await atualizar(o.id, { titulo, descricao });
  refresh();
}

/** Publica agora (ou tenta de novo depois de um erro). */
export async function publicarAgora(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o || !["aprovada", "erro"].includes(o.status)) return;
  if (o.status === "erro") await atualizar(o.id, { status: "aprovada", erro: null });
  const atual = await getOferta(o.id);
  if (atual) await publicarStory(atual);
  refresh();
}

/** Recusa e devolve 100% pelo Mercado Pago. */
export async function recusarOferta(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o || !["reservada", "paga", "aprovada", "erro"].includes(o.status)) return;
  try {
    await recusar(o, String(fd.get("motivo") ?? "").trim().slice(0, 300));
  } catch (e) {
    await atualizar(o.id, { erro: `Reembolso: ${msg(e)}` });
  }
  refresh();
}

export async function alternarNota(fd: FormData) {
  await requireAdmin();
  const o = await getOferta(String(fd.get("id") ?? ""));
  if (!o) return;
  await atualizar(o.id, { nota_emitida_em: o.nota_emitida_em ? null : new Date().toISOString() });
  refresh();
}
