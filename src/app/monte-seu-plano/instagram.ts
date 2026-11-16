"use server";

import { lerMarcaInstagram, type LeituraIg } from "@/lib/marca-instagram";
import { handleInstagram } from "@/lib/monte-plano";

/** Lê nome, logo e cor da marca pelo @ do Instagram (Monte seu plano e chat). */
export async function buscarInstagram(entrada: string): Promise<LeituraIg> {
  const h = handleInstagram(String(entrada ?? "").slice(0, 200));
  if (!h) return { ok: false, motivo: "invalido" };
  return lerMarcaInstagram(h);
}
