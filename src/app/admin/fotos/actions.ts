"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { AVULSA, chavePreset, limparPreset, type Preset } from "@/lib/fotos/preset";
import { clearConfig, setConfig } from "@/lib/producao/store";
import { isQuadroId } from "@/lib/producao/quadros";

const valido = (quadro: string) => quadro === AVULSA || isQuadroId(quadro);

export async function salvarPresetAction(quadro: string, bruto: unknown): Promise<{ ok: boolean; erro?: string; preset?: Preset }> {
  await requireAdmin();
  if (!valido(quadro)) return { ok: false, erro: "Quadro desconhecido." };
  try {
    const preset = limparPreset(bruto);
    await setConfig(chavePreset(quadro), JSON.stringify(preset));
    revalidatePath("/admin/fotos");
    return { ok: true, preset };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui salvar o ajuste." };
  }
}

export async function restaurarPresetAction(quadro: string): Promise<{ ok: boolean; erro?: string }> {
  await requireAdmin();
  if (!valido(quadro)) return { ok: false, erro: "Quadro desconhecido." };
  try {
    await clearConfig(chavePreset(quadro));
    revalidatePath("/admin/fotos");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Não consegui restaurar o ajuste." };
  }
}
