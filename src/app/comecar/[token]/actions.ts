"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { getCheckoutByToken, getMarca } from "@/lib/checkout-store";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};
const MAX_LOGO = 5 * 1024 * 1024;

const str = (f: FormData, k: string, max = 300) => String(f.get(k) ?? "").trim().slice(0, max);

/**
 * Onboarding: o cliente manda o material da marca (cláusula 5 dos termos).
 * Grava direto no parceiro, que segue inativo até a produção revisar e ligar
 * a página no admin.
 */
export async function salvarMarca(form: FormData): Promise<void> {
  const token = str(form, "token", 40);
  const c = await getCheckoutByToken(token);
  if (!c || c.status !== "pago" || !c.partner_id) redirect("/parcerias");
  const admin = createAdminSupabase();
  const marca = await getMarca(c.partner_id);
  if (!admin || !marca) redirect(`/comecar/${token}?erro=1`);

  let logo_url = marca.logo_url;
  const file = form.get("logo");
  if (file instanceof File && file.size > 0) {
    const ext = EXT[file.type];
    if (!ext || file.size > MAX_LOGO) redirect(`/comecar/${token}?erro=logo`);
    const path = `${marca.slug}/logo-${Date.now()}.${ext}`;
    const { error } = await admin.storage
      .from("partner-assets")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
    if (error) redirect(`/comecar/${token}?erro=logo`);
    logo_url = admin.storage.from("partner-assets").getPublicUrl(path).data.publicUrl;
  }

  const wa = str(form, "whatsapp", 30).replace(/\D/g, "");
  const accent = str(form, "accent", 7);
  const website = str(form, "website", 200);

  const { error } = await admin
    .from("partners")
    .update({
      logo_url,
      accent: /^#[0-9a-f]{6}$/i.test(accent) ? accent : marca.accent,
      tagline: str(form, "tagline", 120) || null,
      description: str(form, "description", 1000) || null,
      website: website ? (/^https?:\/\//.test(website) ? website : `https://${website}`) : null,
      instagram: str(form, "instagram", 80).replace(/^@/, "") || null,
      whatsapp: wa.length >= 10 ? (wa.startsWith("55") && wa.length >= 12 ? wa : `55${wa}`) : marca.whatsapp,
      city: str(form, "city", 80) || null,
      cta_label: "Chamar no WhatsApp",
    })
    .eq("id", c.partner_id);
  if (error) redirect(`/comecar/${token}?erro=1`);

  if (!c.onboarding_done_at) {
    await admin.from("checkouts").update({ onboarding_done_at: new Date().toISOString() }).eq("id", c.id);
  }
  revalidatePath("/admin");
  redirect(`/comecar/${token}?ok=1`);
}
