"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import {
  findContentSection,
  type ContentField,
  type ContentSection,
} from "@/lib/partner-content-schema";
import type { PartnerContent } from "@/lib/types";

export type ContentFormState = { ok: boolean; error: string | null };

/**
 * Normaliza UM campo vindo do formulário.
 * O payload chega como JSON do cliente, então nada aqui confia no formato:
 * cada campo é convertido pelo `kind` declarado no schema e o resto é
 * descartado. `undefined` significa "não gravar esta chave".
 */
function normalizeField(field: ContentField, raw: unknown): unknown {
  switch (field.kind) {
    case "boolean":
      return raw === true || raw === "true" || raw === "on";

    case "lines":
    case "csv": {
      const list = Array.isArray(raw)
        ? raw.map(String)
        : String(raw ?? "")
            .split(field.kind === "lines" ? /\r?\n/ : ",")
            .map((s) => s.trim());
      const clean = list.map((s) => s.trim()).filter(Boolean);
      return clean.length > 0 ? clean : undefined;
    }

    case "select": {
      const value = String(raw ?? "").trim();
      if (!value) return undefined;
      // Valor fora da lista viraria ícone quebrado na página pública.
      return field.options?.includes(value) ? value : undefined;
    }

    default: {
      const value = String(raw ?? "").trim();
      return value ? value.slice(0, 2000) : undefined;
    }
  }
}

/** Monta o valor final da seção a partir do payload cru. */
function normalizeSection(
  section: ContentSection,
  raw: unknown
): { key: string; value: unknown } {
  if (section.kind === "list") {
    const rows = Array.isArray(raw) ? raw : [];
    const items: Record<string, unknown>[] = [];

    for (const row of rows.slice(0, 60)) {
      if (!row || typeof row !== "object") continue;
      const source = row as Record<string, unknown>;
      const item: Record<string, unknown> = {};

      for (const field of section.fields) {
        const value = normalizeField(field, source[field.name]);
        if (value !== undefined) item[field.name] = value;
      }

      // Linha sem o campo obrigatório é linha que o usuário deixou em branco.
      const required = section.fields.filter((f) => f.required);
      if (required.some((f) => !item[f.name])) continue;
      if (Object.keys(item).length === 0) continue;

      items.push(item);
    }

    return { key: section.contentKey as string, value: items };
  }

  const source = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const bag: Record<string, unknown> = {};

  for (const field of section.fields) {
    const value = normalizeField(field, source[field.name]);
    if (value !== undefined) bag[field.name] = value;
  }

  return { key: section.container ?? "", value: bag };
}

/**
 * Grava UMA seção do conteúdo do parceiro.
 *
 * Lê o `content` atual e devolve o objeto inteiro com apenas a chave da seção
 * trocada — gravar só a seção sobrescreveria a coluna e apagaria todas as
 * outras. Como é ler-e-escrever, dois admins salvando seções diferentes ao
 * mesmo tempo fazem o último vencer; com um punhado de parceiros isso não
 * acontece, e resolver de verdade exigiria um `jsonb_set` no banco.
 */
export async function savePartnerContentSection(
  _prev: ContentFormState,
  formData: FormData
): Promise<ContentFormState> {
  await requireAdmin();

  const partnerId = String(formData.get("partner_id") ?? "").trim();
  const sectionSlug = String(formData.get("section") ?? "").trim();
  const section = findContentSection(sectionSlug);

  if (!partnerId || !section) {
    return { ok: false, error: "Seção desconhecida." };
  }

  let payload: unknown;
  try {
    payload = JSON.parse(String(formData.get("payload") ?? "null"));
  } catch {
    return { ok: false, error: "Não foi possível ler o formulário." };
  }

  const supabase = createServerSupabase();
  const { data: partner, error: readError } = await supabase
    .from("partners")
    .select("slug, content")
    .eq("id", partnerId)
    .maybeSingle();

  if (readError || !partner) {
    return { ok: false, error: "Parceiro não encontrado." };
  }

  const current: PartnerContent =
    partner.content && typeof partner.content === "object"
      ? (partner.content as PartnerContent)
      : {};

  const { key, value } = normalizeSection(section, payload);
  const next: Record<string, unknown> = { ...current };

  if (section.kind === "fields" && !section.container) {
    // Campos soltos na raiz: cada um vale por si, os ausentes são removidos.
    const bag = value as Record<string, unknown>;
    for (const field of section.fields) {
      if (bag[field.name] === undefined) delete next[field.name];
      else next[field.name] = bag[field.name];
    }
  } else {
    next[key] = value;
  }

  const { error } = await supabase
    .from("partners")
    .update({ content: next })
    .eq("id", partnerId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/parceiros/${partner.slug}`);
  revalidatePath(`/admin/parceiros/${partnerId}`);
  revalidatePath(`/admin/parceiros/${partnerId}/conteudo`);
  revalidatePath(`/admin/parceiros/${partnerId}/conteudo/${sectionSlug}`);

  return { ok: true, error: null };
}
