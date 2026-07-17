/** Uma seção livre de conteúdo dentro da landing do parceiro. */
export type PartnerSection = {
  heading: string;
  body: string;
};

export type Partner = {
  id: string;
  slug: string;
  name: string;
  /** Plano/relação comercial (ex: "Apoio", "Patrocinador", "Master"). */
  plan: string | null;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  website: string | null;
  /** URL de destino do CTA principal (site, WhatsApp, cardápio, etc). */
  cta_url: string | null;
  cta_label: string | null;
  /** Cor PRIMÁRIA da marca em hex (ex: "#FFD700"). */
  accent: string | null;
  /** Cor secundária da marca (apoio). */
  color_secondary: string | null;
  /** Cor de fundo da página do parceiro. */
  color_bg: string | null;
  /** Preset de estilo visual (moderno|elegante|vibrante|minimalista|corporativo). */
  style_preset: string | null;
  sections: PartnerSection[] | null;
  active: boolean;
  created_at: string;
};

export type PartnerClick = {
  id: string;
  partner_id: string;
  source: string | null; // "qr" | "direct" | "site" ...
  referer: string | null;
  user_agent: string | null;
  created_at: string;
};

/** Lead captado pelo formulário público de /parcerias. */
export type Lead = {
  id: string;
  name: string;
  company: string;
  segment: string | null;
  whatsapp: string;
  message: string | null;
  source: string | null;
  status: "novo" | "contatado" | "fechado" | "descartado";
  created_at: string;
};

/** Destaque manual do Instagram (curado no admin). */
export type IgHighlight = {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string;
  active: boolean;
  sort_order: number;
  created_at: string;
};
