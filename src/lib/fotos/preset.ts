/** Ajuste salvo de cada quadro: a equipe acerta uma vez e as fotos do quadro saem iguais. */

import { FORMATOS, type Formato, type Qualidade } from "./enquadro";
import { AJUSTES_PADRAO, LIMITES, type Ajustes } from "./tratamento";

export type Preset = { ajustes: Ajustes; formato: Formato; qualidade: Qualidade };

/** Foto que não é de nenhum quadro (evento, bastidor). */
export const AVULSA = "avulsa";

export const PRESET_PADRAO: Preset = { ajustes: AJUSTES_PADRAO, formato: "4:5", qualidade: "instagram" };

export const chavePreset = (quadro: string) => `fotos_ajuste:${quadro}`;

/** Aceita só números dentro da faixa de cada régua: o valor vem do navegador. */
export function limparPreset(bruto: unknown): Preset {
  const p = (bruto ?? {}) as Partial<Preset> & { ajustes?: Partial<Record<keyof Ajustes, unknown>> };
  const ajustes = { ...AJUSTES_PADRAO };
  for (const chave of Object.keys(LIMITES) as (keyof Ajustes)[]) {
    const v = Number(p.ajustes?.[chave]);
    if (Number.isFinite(v)) ajustes[chave] = Math.round(Math.max(LIMITES[chave][0], Math.min(LIMITES[chave][1], v)));
  }
  const formato = FORMATOS.some((f) => f.id === p.formato) ? (p.formato as Formato) : PRESET_PADRAO.formato;
  const qualidade: Qualidade = p.qualidade === "alta" ? "alta" : "instagram";
  return { ajustes, formato, qualidade };
}

export function mesmoPreset(a: Preset, b: Preset): boolean {
  return (
    a.formato === b.formato &&
    a.qualidade === b.qualidade &&
    (Object.keys(LIMITES) as (keyof Ajustes)[]).every((k) => a.ajustes[k] === b.ajustes[k])
  );
}
