/**
 * Cadastra a Real Consultoria em Imóveis como parceiro (Plano Apoio Anual),
 * grava o contrato e o Epic do Jira no painel e imprime os links.
 *
 *   node scripts/seed-real-consultoria.mjs
 *
 * Pré-requisito: supabase/009_area_do_cliente.sql aplicado.
 *
 * A página nasce INATIVA: só vai ao ar quando o cliente mandar o kit da marca
 * (logo.png e cover.jpg em assets/partners/real-consultoria/ e WhatsApp
 * abaixo). O painel — termos e entregas — funciona desde já, porque o token
 * não depende de o parceiro estar ativo.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const SLUG = "real-consultoria";
const BUCKET = "partner-assets";
const dir = path.join("assets", "partners", SLUG);
/** Preencher quando o cliente mandar: só dígitos, com DDI. */
const WHATSAPP = "";
const JIRA_EPIC = "PROD-65";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

async function upload(file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return null;
  const key = `${SLUG}/${file}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, fs.readFileSync(full), {
      contentType: MIME[path.extname(file)] ?? "application/octet-stream",
      upsert: true,
    });
  if (error) throw new Error(`upload ${file}: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

const contract = {
  plan: "Apoio Anual",
  price: 2568,
  payment:
    "12 parcelas sem juros no cartão de crédito, pagas em 23/10/2026 pelo Mercado Pago",
  // Vigência conta do primeiro conteúdo publicado (proposta). Ajustar se a
  // primeira inserção sair em outra data.
  start: "2026-11-01",
  months: 12,
  deliverables: [
    "Inserções pontuais da marca nos conteúdos do PFC",
    "Stories de divulgação no Instagram do PFC",
    "Link na descrição dos episódios",
    "Participação em ações específicas do PFC ao longo do ano",
    "Página própria no site do PFC, com QR rastreável e painel de contatos recebidos",
  ],
  terms_version: "patrocinio-2026-10",
};

const logo_url = await upload("logo.png");
const cover_url = await upload("cover.jpg");
const ready = Boolean(logo_url && WHATSAPP);

const row = {
  slug: SLUG,
  name: "Real Consultoria em Imóveis",
  plan: "Apoio",
  tagline: null,
  description: null,
  instagram: "realconsultoriaemimoveis",
  whatsapp: WHATSAPP || null,
  cta_url: WHATSAPP ? `https://wa.me/${WHATSAPP}` : null,
  cta_label: WHATSAPP ? "Falar no WhatsApp" : null,
  // Paleta amostrada do logo (ver assets/partners/real-consultoria/brand.md)
  accent: "#FF6600",
  color_secondary: "#09095F",
  color_bg: "#06063F",
  style_preset: "corporativo",
  sections: [],
  active: ready,
};
if (logo_url) row.logo_url = logo_url;
if (cover_url) row.cover_url = cover_url;

const { data: saved, error } = await admin
  .from("partners")
  .upsert(row, { onConflict: "slug" })
  .select("id")
  .single();
if (error) throw new Error("upsert partner: " + error.message);

await admin
  .from("partner_panels")
  .upsert({ partner_id: saved.id }, { onConflict: "partner_id" });

const { error: contractError } = await admin
  .from("partner_panels")
  .update({ jira_epic: JIRA_EPIC, contract })
  .eq("partner_id", saved.id);
if (contractError) {
  throw new Error(
    "gravar contrato: " + contractError.message +
      " — a migration supabase/009_area_do_cliente.sql já foi aplicada?"
  );
}

const { data: panel } = await admin
  .from("partner_panels")
  .select("token")
  .eq("partner_id", saved.id)
  .single();

const base = (env.NEXT_PUBLIC_SITE_URL || "https://www.pfctv.com.br").replace(/\/$/, "");
console.log("\nReal Consultoria cadastrada ✅");
console.log("Área do cliente: " + base + "/parceiros/" + SLUG + "/painel?token=" + panel?.token);
console.log(
  ready
    ? "Página:          " + base + "/parceiros/" + SLUG + "\nQR:              " + base + "/go/" + SLUG + "?src=qr"
    : "Página:          inativa até chegar o kit (logo.png em " + dir + " e WHATSAPP no script)"
);
