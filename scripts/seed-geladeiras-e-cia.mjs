/**
 * Cadastra/atualiza a Geladeiras e Cia como parceiro, sobe os assets e
 * imprime o link do painel dele.
 *
 *   node scripts/seed-geladeiras-e-cia.mjs
 *
 * Pré-requisito: rodar supabase/006_parceiro_leads.sql no SQL Editor.
 * Fonte da identidade visual: assets/partners/geladeiras-e-cia/brand.md
 */
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

const SLUG = "geladeiras-e-cia";
const BUCKET = "partner-assets";
const dir = path.join("assets", "partners", SLUG);
const WHATSAPP = "5519998272913";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };

/** Sobe um asset se ele existir na pasta local. */
async function upload(file) {
  const full = path.join(dir, file);
  if (!fs.existsSync(full)) return null;
  const key = `${SLUG}/${file}`;
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(key, fs.readFileSync(full), {
      contentType: MIME[path.extname(file)] ?? "image/png",
      upsert: true,
    });
  if (error) throw new Error(`upload ${file}: ${error.message}`);
  return admin.storage.from(BUCKET).getPublicUrl(key).data.publicUrl;
}

const content = {
  eyebrow: "Parceiro Fora da Caixa",
  highlights: [
    "+16 anos equipando negócios",
    "Entrega e instalação",
    "Novos e seminovos",
  ],
  stats: [
    {
      value: "4.319",
      label: "avaliações no Google",
      href: "https://www.google.com/maps/search/?api=1&query=Geladeiras+e+Cia+Mogi+Gua%C3%A7u",
    },
    { value: "+16 anos", label: "equipando negócios e eventos" },
    { value: "Mogi Guaçu", label: "e região, com equipe local" },
    { value: "Locação", label: "sem travar o seu capital" },
  ],
  products: [
    {
      name: "Freezer horizontal",
      need: "freezer",
      body: "Linha Chest Freezer Tech da Metalfrio: conservação de verdade para congelados, gelo e estoque do dia a dia.",
      tags: ["Metalfrio", "Bivolt", "Inverter"],
    },
    {
      name: "Geladeira / expositor",
      need: "geladeira",
      body: "Organização e visibilidade. O produto aparece, o cliente vê e leva — sem abrir porta atrás de porta.",
      tags: ["Vertical", "Expositor"],
    },
    {
      name: "Cervejeira",
      need: "cervejeira",
      body: "Bebida sempre na temperatura ideal. É o primeiro item que o seu cliente pergunta e o que mais gira no balcão.",
      tags: ["Bebidas", "Balcão"],
    },
  ],
  perks: [
    {
      icon: "shield",
      title: "Equipamentos de qualidade",
      body: "Confiáveis e prontos para o seu negócio, sempre revisados e higienizados antes de entrar na sua loja.",
    },
    {
      icon: "truck",
      title: "Entrega rápida e instalação",
      body: "A gente leva, instala e deixa funcionando. Mais agilidade para você vender.",
    },
    {
      icon: "wallet",
      title: "Cabem no seu bolso",
      body: "Locação flexível e venda com preço justo. Capital travado em equipamento é capital que não gira.",
    },
    {
      icon: "headset",
      title: "Suporte que resolve",
      body: "Atendimento próximo, sempre que precisar. Você fala com gente da sua cidade.",
    },
    {
      icon: "chart",
      title: "Mais vendas",
      body: "Produto sempre gelado é produto que sai. O equipamento certo aumenta o giro do seu balcão.",
    },
    {
      icon: "calendar",
      title: "Planos flexíveis",
      body: "Do evento de fim de semana ao contrato longo: a gente monta o plano na sua realidade.",
    },
  ],
  steps: [
    {
      title: "Você conta o que precisa",
      body: "Responde a triagem aqui da página em menos de um minuto: equipamento, prazo e tipo de negócio.",
    },
    {
      title: "A gente indica a solução",
      body: "Você fala com quem entende: indicamos o equipamento certo para o seu espaço e o seu giro.",
    },
    {
      title: "Entrega, instala e pronto",
      body: "Levamos, instalamos e ficamos por perto. Você se preocupa só em vender.",
    },
  ],
  faq: [
    {
      q: "Vocês atendem fora de Mogi Guaçu?",
      a: "Sim. Atendemos Mogi Guaçu e região e já equipamos eventos por todo o Brasil. Informe a sua cidade na triagem que confirmamos a entrega.",
    },
    {
      q: "Qual o prazo mínimo de locação?",
      a: "Temos planos flexíveis, do evento de fim de semana ao contrato mensal. A gente monta conforme a sua necessidade — é só dizer o período no pedido.",
    },
    {
      q: "Os equipamentos são novos?",
      a: "Trabalhamos com novos e seminovos, para locação e venda. Todos passam por revisão e higienização antes de ir para o cliente.",
    },
    {
      q: "E se der problema no equipamento?",
      a: "Você tem o nosso suporte durante o contrato. Atendimento próximo é o nosso jeito de trabalhar — as condições ficam claras no orçamento.",
    },
    {
      q: "Dá para alugar para um evento ou festa?",
      a: "Dá sim. Freezers e cervejeiras para eventos é o que fazemos há mais de 16 anos.",
    },
  ],
  address: "Rua Luiz Baiochi, 71 — Parque Cidade Nova, Mogi Guaçu/SP",
  hours: [
    "Segunda a quinta: 08h–11h30 e 13h–18h",
    "Sexta: 08h–11h30 e 13h–17h",
    "Sábado e domingo: fechado",
  ],
  whatsapp_message:
    "Olá! Vim pela página de vocês no Fora da Caixa e quero um orçamento.",
  triage: {
    enabled: true,
    title: "Orçamento em 1 minuto",
    subtitle: "Responda 5 perguntas e receba a solução certa para o seu negócio",
    cities: [
      "Mogi Guaçu",
      "Mogi Mirim",
      "Itapira",
      "Estiva Gerbi",
      "Conchal",
      "Aguaí",
      "Outra cidade",
    ],
  },
};

const partner = {
  slug: SLUG,
  name: "Geladeiras e Cia",
  plan: "Parceiro estratégico",
  tagline: "Sua escolha cabe no seu negócio.",
  description:
    "Locação e venda de geladeiras, freezers e cervejeiras — novos e seminovos — para bares, restaurantes, mercados, açougues e eventos em Mogi Guaçu e região. Equipamentos que gelam o seu lucro.",
  website: "https://linktr.ee/geladeirasecia",
  cta_url: `https://wa.me/${WHATSAPP}`,
  cta_label: "Falar no WhatsApp",
  whatsapp: WHATSAPP,
  instagram: "geladeirasecia_",
  city: "Mogi Guaçu/SP",
  // Paleta amostrada do logo oficial (ver brand.md)
  accent: "#00A0E3",
  color_secondary: "#005E91",
  color_bg: "#04223D",
  style_preset: "moderno",
  sections: [],
  content,
  active: true,
};

const logo_url = await upload("logo.png");
const cover_url = await upload("cover.jpg");
if (logo_url) console.log("logo:", logo_url);
if (cover_url) console.log("capa:", cover_url);
else console.log("capa: (nenhuma — coloque cover.jpg em", dir, "e rode de novo)");

const row = { ...partner };
if (logo_url) row.logo_url = logo_url;
if (cover_url) row.cover_url = cover_url;

const { data: saved, error } = await admin
  .from("partners")
  .upsert(row, { onConflict: "slug" })
  .select("id")
  .single();
if (error) throw new Error("upsert partner: " + error.message);

// Token do painel read-only
await admin
  .from("partner_panels")
  .upsert({ partner_id: saved.id }, { onConflict: "partner_id" });
const { data: panel } = await admin
  .from("partner_panels")
  .select("token")
  .eq("partner_id", saved.id)
  .single();

const base = (env.NEXT_PUBLIC_SITE_URL || "https://pfctv.com.br").replace(/\/$/, "");
console.log("\nGeladeiras e Cia cadastrada ✅");
console.log("Página:  " + base + "/parceiros/" + SLUG);
console.log("QR:      " + base + "/go/" + SLUG + "?src=qr");
console.log("Painel:  " + base + "/parceiros/" + SLUG + "/painel?token=" + panel?.token);
