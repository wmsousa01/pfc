import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// carrega .env.local
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

const SLUG = "contenta-ai";
const BUCKET = "partner-assets";
const dir = path.join("assets", "partners", SLUG);

async function upload(file, contentType) {
  const buf = fs.readFileSync(path.join(dir, file));
  const key = `${SLUG}/${file}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, buf, { contentType, upsert: true });
  if (error) throw new Error(`upload ${file}: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

const partner = {
  slug: SLUG,
  name: "Contenta AI",
  plan: "Patrocinador",
  tagline: "Grave uma vez. Apareça em todo lugar.",
  description:
    "A IA que transforma 1 vídeo em dezenas de conteúdos prontos para postar. Cortes automáticos, transcrição, títulos com SEO e Shorts gerados por IA — economize horas de edição e escale sua produção de conteúdo.",
  website: "https://www.contentaai.com.br",
  cta_url: "https://www.contentaai.com.br",
  cta_label: "Ganhar 30 créditos grátis",
  accent: "#7C3AED",
  color_secondary: "#3B82F6",
  color_bg: "#0a0a0a",
  style_preset: "moderno",
  active: true,
  sections: [
    {
      heading: "O que a Contenta AI faz",
      body: "• Corte automático dos melhores momentos\n• Legendas inteligentes\n• Reenquadramento perfeito (9:16)\n• Títulos virais com SEO\n• Publicação automática em Reels, TikTok, Shorts e YouTube",
    },
    {
      heading: "Comece grátis",
      body: "30 créditos grátis, sem precisar de cartão. Transforme seus vídeos longos em dezenas de conteúdos prontos para postar e multiplique sua presença.",
    },
  ],
};

const logo_url = await upload("logo.svg", "image/svg+xml");
const cover_url = await upload("cover.png", "image/png");
console.log("logo:", logo_url);
console.log("cover:", cover_url);

const row = { ...partner, logo_url, cover_url };
const { error } = await admin
  .from("partners")
  .upsert(row, { onConflict: "slug" });
if (error) throw new Error("upsert partner: " + error.message);

console.log("Contenta AI cadastrado/atualizado ✅ -> /parceiros/" + SLUG);
