"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import type { ActionState } from "@/app/admin/producao/actions";
import { clearConfig, db, setConfig } from "@/lib/producao/store";
import { YT_AUTO_PAUSA } from "@/lib/social/auto-youtube";
import { cancelarNumeros, gerarNumeros, programarNumeros, salvarLegenda } from "@/lib/social/numeros-semana";
import { IG_TESTES_POR_DIA, JANELA_HORAS, dentroDaJanela, isSegunda } from "@/lib/social/ritmo";

const refresh = () => {
  revalidatePath("/admin/marketing/semana");
  revalidatePath("/admin/marketing");
};

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const fail = (e: unknown): ActionState => ({ ok: false, error: e instanceof Error ? e.message : String(e) });

function segundaDo(form: FormData): string {
  const s = str(form, "segunda");
  if (!isSegunda(s)) throw new Error("Semana inválida.");
  return s;
}

export async function gerarNumerosAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await gerarNumeros(segundaDo(form), { manterLegenda: str(form, "manter") === "1" });
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

/** Salva a legenda e, conforme `modo`, publica agora ou programa. */
export async function programarNumerosAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    const segunda = segundaDo(form);
    const legenda = str(form, "legenda").slice(0, 2200);
    if (!legenda) return { ok: false, error: "Escreva a legenda." };
    const modo = str(form, "modo");
    if (modo === "salvar") {
      await salvarLegenda(segunda, legenda);
    } else if (modo === "agora") {
      await programarNumeros(segunda, legenda, null);
    } else {
      const quando = new Date(`${str(form, "quando")}:00-03:00`);
      if (Number.isNaN(quando.getTime())) return { ok: false, error: "Data inválida." };
      if (quando.getTime() < Date.now() + 5 * 60_000) return { ok: false, error: "Escolha um horário no futuro." };
      await programarNumeros(segunda, legenda, quando);
    }
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    refresh();
    return fail(e);
  }
}

export async function cancelarNumerosAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    await cancelarNumeros(segundaDo(form));
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Devolve à fila os Reels de teste que a Meta recusou pelo limite. A fila
 * espalha no ritmo de ritmo.ts (até 4 testes por dia, das 10h às 22h).
 */
export async function devolverTestesAction(_prev: ActionState): Promise<ActionState> {
  await requireAdmin();
  try {
    const { data, error } = await db()
      .from("social_posts")
      .select("id")
      .eq("platform", "instagram")
      .eq("trial", true)
      .eq("status", "erro")
      .ilike("error", "%maximum number of trial reels%")
      .order("scheduled_at", { ascending: true })
      .limit(500);
    if (error) throw new Error(error.message);
    // Já espalhados: um a cada (janela / testes por dia), só das 10h às 22h.
    const passo = (JANELA_HORAS / IG_TESTES_POR_DIA) * 3_600_000;
    let t = dentroDaJanela(Date.now() + 10 * 60_000);
    for (const row of data ?? []) {
      const now = new Date().toISOString();
      await db()
        .from("social_posts")
        .update({ status: "agendado", attempts: 0, error: null, container_id: null, scheduled_at: new Date(t).toISOString(), updated_at: now })
        .eq("id", row.id)
        .eq("status", "erro");
      t = dentroDaJanela(t + passo);
    }
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}

/** Liga ou pausa o agendamento automático dos Shorts no YouTube. */
export async function youtubeAutoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  try {
    if (str(form, "pausar") === "1") await setConfig(YT_AUTO_PAUSA, "1");
    else await clearConfig(YT_AUTO_PAUSA);
    refresh();
    return { ok: true, error: null };
  } catch (e) {
    return fail(e);
  }
}
