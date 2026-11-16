"use server";

import { createAdminSupabase } from "@/lib/supabase/admin";
import {
  DURACOES,
  OBJETIVOS,
  SEGMENTOS,
  VERBAS,
  orcar,
  handleInstagram,
  resumo,
  type Briefing,
  type Meses,
  type Selecao,
} from "@/lib/monte-plano";

export type EnvioState = { ok: boolean; error: string | null; resumo: string | null };

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 20) : []);

/**
 * Recebe o plano montado. O orçamento é refeito aqui a partir da seleção —
 * o total que a tela mostrou não é confiável e nem é enviado.
 */
export async function enviarPlano(_prev: EnvioState, fd: FormData): Promise<EnvioState> {
  if (str(fd.get("site_url"))) return { ok: true, error: null, resumo: null }; // honeypot

  const name = str(fd.get("name"));
  const digits = str(fd.get("whatsapp"), 30).replace(/\D/g, "");
  if (!name) return { ok: false, error: "Diga seu nome.", resumo: null };
  if (digits.length < 10 || digits.length > 13) {
    return { ok: false, error: "Informe um WhatsApp válido com DDD.", resumo: null };
  }

  let raw: { briefing?: Record<string, unknown>; selecao?: Record<string, unknown> };
  try {
    raw = JSON.parse(String(fd.get("plano") ?? "{}"));
  } catch {
    return { ok: false, error: "Não conseguimos ler o plano. Recarregue a página.", resumo: null };
  }
  const rb = raw.briefing ?? {};
  const rs = raw.selecao ?? {};

  const objetivosValidos = new Set<string>(OBJETIVOS.map((o) => o.id));
  const briefing: Briefing = {
    empresa: str(rb.empresa) || "(empresa não informada)",
    segmento: SEGMENTOS.some((s) => s.label === rb.segmento) ? String(rb.segmento) : "Outro",
    objetivos: strs(rb.objetivos).filter((o) => objetivosValidos.has(o)) as Briefing["objetivos"],
    verba: (VERBAS.find((v) => v.id === rb.verba)?.id ?? "ate-500") as Briefing["verba"],
    exclusividade: rb.exclusividade === true,
    quadro: str(rb.quadro, 60),
    instagram: handleInstagram(str(rb.instagram, 200)) ?? undefined,
  };
  const selecao: Selecao = {
    plano: typeof rs.plano === "string" ? rs.plano : null,
    quadros: strs(rs.quadros),
    modalidades: strs(rs.modalidades),
    visita: rs.visita === true,
    meses: (DURACOES.includes(rs.meses as Meses) ? rs.meses : 3) as Meses,
  };

  const orc = orcar(selecao);
  if (orc.vazio) return { ok: false, error: "Ligue pelo menos um item do plano.", resumo: null };
  const texto = resumo(briefing, orc);

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "Não foi possível enviar agora. Fale direto no WhatsApp.", resumo: texto };

  const { error } = await admin.from("leads").insert({
    name,
    company: briefing.empresa,
    segment: briefing.segmento,
    whatsapp: digits,
    message: texto.slice(0, 2000),
    // Lead do chat comercial (ChatComercial) ou da página.
    source: fd.get("origem") === "chat" ? "chat-comercial" : "monte-seu-plano",
  });
  if (error) return { ok: false, error: "Não foi possível enviar agora. Fale direto no WhatsApp.", resumo: texto };

  return { ok: true, error: null, resumo: texto };
}
