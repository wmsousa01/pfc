"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { createAdminSupabase } from "@/lib/supabase/admin";
import type { PartnerSection } from "@/lib/types";

const BUCKET = "partner-assets";

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/gif": "gif",
};

/**
 * Faz upload de um asset (logo/capa) para o Storage via service-role e retorna
 * a URL pública. Resolve o valor final considerando remoção e URL atual.
 */
async function resolveAsset(
  slug: string,
  kind: "logo" | "cover",
  formData: FormData
): Promise<string | null> {
  const remove = formData.get(`${kind}_remove`) === "on";
  const currentUrl = String(formData.get(`${kind}_url`) ?? "").trim() || null;
  if (remove) return null;

  const file = formData.get(`${kind}_file`);
  if (!(file instanceof File) || file.size === 0) return currentUrl;

  const admin = createAdminSupabase();
  if (!admin) return currentUrl;

  const ext = EXT_BY_MIME[file.type] ?? "png";
  const path = `${slug}/${kind}-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true });
  if (error) throw new Error(`Falha no upload do ${kind}: ${error.message}`);

  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function requireAuth() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  return supabase;
}

function parseSections(formData: FormData): PartnerSection[] {
  const headings = formData.getAll("section_heading").map(String);
  const bodies = formData.getAll("section_body").map(String);
  const out: PartnerSection[] = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]?.trim();
    const body = (bodies[i] ?? "").trim();
    if (heading) out.push({ heading, body });
  }
  return out;
}

export async function savePartner(formData: FormData) {
  const supabase = await requireAuth();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const slug = slugify(slugRaw || name);

  if (!name || !slug) {
    throw new Error("Nome e slug são obrigatórios.");
  }

  const [logo_url, cover_url] = await Promise.all([
    resolveAsset(slug, "logo", formData),
    resolveAsset(slug, "cover", formData),
  ]);

  const payload = {
    name,
    slug,
    plan: (String(formData.get("plan") ?? "").trim() || null) as string | null,
    tagline: (String(formData.get("tagline") ?? "").trim() || null) as string | null,
    description: (String(formData.get("description") ?? "").trim() || null) as string | null,
    logo_url,
    cover_url,
    website: (String(formData.get("website") ?? "").trim() || null) as string | null,
    cta_url: (String(formData.get("cta_url") ?? "").trim() || null) as string | null,
    cta_label: (String(formData.get("cta_label") ?? "").trim() || null) as string | null,
    accent: String(formData.get("accent") ?? "").trim() || "#FFD700",
    color_secondary: String(formData.get("color_secondary") ?? "").trim() || "#1a1a1a",
    color_bg: String(formData.get("color_bg") ?? "").trim() || "#0a0a0a",
    style_preset: String(formData.get("style_preset") ?? "").trim() || "moderno",
    sections: parseSections(formData),
    active: formData.get("active") === "on",
  };

  if (id) {
    const { error } = await supabase.from("partners").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("partners").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin");
  revalidatePath("/parcerias");
  revalidatePath(`/parceiros/${slug}`);
  redirect("/admin");
}

export async function deletePartner(formData: FormData) {
  const supabase = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("partners").delete().eq("id", id);
    revalidatePath("/admin");
    revalidatePath("/parcerias");
  }
  redirect("/admin");
}

export async function togglePartnerActive(formData: FormData) {
  const supabase = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (id) {
    await supabase.from("partners").update({ active }).eq("id", id);
    revalidatePath("/admin");
    revalidatePath("/parcerias");
  }
}

export async function saveHighlight(formData: FormData) {
  const supabase = await requireAuth();
  const payload = {
    title: (String(formData.get("title") ?? "").trim() || null) as string | null,
    image_url: String(formData.get("image_url") ?? "").trim(),
    link_url: String(formData.get("link_url") ?? "").trim(),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    active: true,
  };
  if (payload.image_url && payload.link_url) {
    await supabase.from("ig_highlights").insert(payload);
    revalidatePath("/admin");
    revalidatePath("/");
  }
}

export async function deleteHighlight(formData: FormData) {
  const supabase = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("ig_highlights").delete().eq("id", id);
    revalidatePath("/admin");
    revalidatePath("/");
  }
}

const LEAD_STATUSES = ["novo", "contatado", "fechado", "descartado"];

export async function updateLeadStatus(formData: FormData) {
  const supabase = await requireAuth();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (id && LEAD_STATUSES.includes(status)) {
    await supabase.from("leads").update({ status }).eq("id", id);
    revalidatePath("/admin");
  }
}

export async function deleteLead(formData: FormData) {
  const supabase = await requireAuth();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("leads").delete().eq("id", id);
    revalidatePath("/admin");
  }
}

export async function signOut() {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
