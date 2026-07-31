/** Uma seção livre de conteúdo dentro da landing do parceiro. */
export type PartnerSection = {
  heading: string;
  body: string;
};

/** Número de destaque na faixa de prova social (ex: "4.319" / "avaliações"). */
export type PartnerStat = {
  value: string;
  label: string;
  /** Link opcional (ex: perfil do Google). */
  href?: string;
};

/** Um diferencial do parceiro. `icon` é uma chave de `partnerIcons`. */
export type PartnerPerk = {
  icon: string;
  title: string;
  body: string;
};

/** Uma linha de produto exibida em card. */
export type PartnerProduct = {
  name: string;
  body: string;
  /** Etiquetas curtas (ex: "Bivolt", "Inverter"). */
  tags?: string[];
  image_url?: string | null;
  /** Valor pré-selecionado na triagem quando o visitante clica no card. */
  need?: string;
};

export type PartnerStep = { title: string; body: string };
export type PartnerFaq = { q: string; a: string };

/** Ajustes da triagem de leads na página do parceiro. */
export type PartnerTriage = {
  /** Desliga o formulário e deixa só o CTA de WhatsApp. */
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  /** Tipos de negócio ofertados na 1ª pergunta (sobrescreve o padrão). */
  business_types?: string[];
  /** Tipos que valem pontuação extra por serem o cliente ideal do parceiro. */
  ideal_business_types?: string[];
  /** Cidades/bairros sugeridos no campo de localização. */
  cities?: string[];
};

/** Um botão do bloco de contato. */
export type PartnerLink = {
  label: string;
  url: string;
  /** "whatsapp" | "instagram" | "site" | "none". Desconhecido = sem ícone. */
  icon?: string;
  /** Botão preenchido com a cor da marca. Sem nenhum marcado, o 1º vira o primário. */
  primary?: boolean;
};

/** Conteúdo rico da landing do parceiro (coluna `partners.content`). */
export type PartnerContent = {
  /** Frase curta acima do nome, no topo. */
  eyebrow?: string;
  /** Bullets logo abaixo da tagline. */
  highlights?: string[];
  stats?: PartnerStat[];
  perks?: PartnerPerk[];
  products?: PartnerProduct[];
  steps?: PartnerStep[];
  faq?: PartnerFaq[];
  /** Endereço/horário exibidos no bloco de contato. */
  address?: string;
  hours?: string[];
  /** Botões do bloco de contato. Vazio = derivados do cadastro (ver partner-links.ts). */
  links?: PartnerLink[];
  /** Mensagem pré-preenchida do botão flutuante de WhatsApp. */
  whatsapp_message?: string;
  triage?: PartnerTriage;
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
  /** WhatsApp do parceiro, só dígitos com DDI (destino dos leads). */
  whatsapp: string | null;
  /** Handle do Instagram, sem @. */
  instagram: string | null;
  city: string | null;
  /** Conteúdo rico da landing. `{}` = página no formato simples. */
  content: PartnerContent | null;
  active: boolean;
  created_at: string;
};

/** Temperatura do lead, calculada pela triagem. */
export type LeadTemperature = "quente" | "morno" | "frio";

export type PartnerLeadStatus =
  | "novo"
  | "contatado"
  | "negociando"
  | "fechado"
  | "perdido";

/** Lead qualificado captado na página de um parceiro. */
export type PartnerLead = {
  id: string;
  partner_id: string;
  name: string;
  whatsapp: string;
  city: string | null;
  business_type: string | null;
  need: string | null;
  mode: string | null;
  quantity: number | null;
  timeframe: string | null;
  note: string | null;
  score: number;
  temperature: LeadTemperature;
  channel: string;
  source: string | null;
  answers: Record<string, unknown>;
  status: PartnerLeadStatus;
  handed_off_at: string | null;
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

/** Produto da loja. Valores sempre em CENTAVOS. */
export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  detail: string | null;
  price_cents: number;
  cost_cents: number;
  image_url: string | null;
  /** Segunda imagem, revelada no hover (ex: frente da camiseta). */
  image_alt_url: string | null;
  /** Variações disponíveis (ex: ["P","M","G"]). Vazio = sem variação. */
  variants: string[];
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type CommissionType = "percent" | "fixed";

/** Revendedor: apresentador de quadro, influencer ou parceiro que indica vendas. */
export type Reseller = {
  id: string;
  /** Conta de login (criada pelo admin). Null = ainda sem acesso ao painel. */
  user_id: string | null;
  /** Vira o link (/r/{slug}) e o cupom (slug em maiúsculas). */
  slug: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  /** Papel dele no ecossistema: "Influencer", "Quadro PFC News"... */
  role_label: string | null;
  notes: string | null;
  commission_type: CommissionType;
  /** Percentual (quando 'percent') ou centavos por peça (quando 'fixed'). */
  commission_value: number;
  /** Desconto que o cupom dele dá ao cliente (0 a 30%). 0 = cupom só atribui. */
  discount_percent: number;
  active: boolean;
  created_at: string;
};

/** Andamento da ENTREGA do pedido. */
export type OrderStatus =
  | "novo"
  | "confirmado"
  | "producao"
  | "pronto"
  | "entregue"
  | "cancelado";

/** Andamento do PAGAMENTO do cliente. */
export type PaymentStatus = "pendente" | "pago" | "estornado";

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  variant: string | null;
  qty: number;
  unit_price_cents: number;
  unit_cost_cents: number;
};

export type Order = {
  id: string;
  code: string;
  reseller_id: string | null;
  customer_name: string;
  customer_whatsapp: string;
  customer_note: string | null;
  delivery_method: string;
  delivery_address: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  /** Valor LÍQUIDO cobrado do cliente — já com o desconto do cupom aplicado. */
  total_cents: number;
  /** Desconto do cupom, congelado no pedido. */
  discount_cents: number;
  cost_cents: number;
  commission_cents: number;
  commission_paid: boolean;
  commission_paid_at: string | null;
  delivered_at: string | null;
  source: string | null;
  created_at: string;
};

/** Pedido com os itens e o revendedor já resolvidos (usado nas listagens). */
export type OrderWithDetails = Order & {
  items: OrderItem[];
  reseller: Pick<Reseller, "id" | "name" | "slug"> | null;
};

/**
 * O que o REVENDEDOR enxerga (funções `reseller_orders()` /
 * `reseller_order_items()`, migração 007). Sem custo de produção — que é margem
 * do PFC — e sem os dados de contato do cliente, que ele não precisa para
 * acompanhar comissão.
 */
export type ResellerOrderItem = Omit<OrderItem, "unit_cost_cents">;

export type ResellerOrder = Omit<
  Order,
  "cost_cents" | "customer_whatsapp" | "delivery_address" | "source"
> & { items: ResellerOrderItem[] };

/**
 * O mínimo que `summarizeOrders` precisa. Existe para os mesmos números
 * valerem para o admin (pedido completo) e para o revendedor (pedido podado).
 */
export type SummarizableOrder = {
  status: OrderStatus;
  payment_status: PaymentStatus;
  total_cents: number;
  commission_cents: number;
  commission_paid: boolean;
  items: { qty: number }[];
};

/** Números consolidados de um revendedor (exclui pedidos cancelados). */
export type ResellerStats = {
  orders: number;
  units: number;
  /** Faturamento bruto gerado por ele. */
  revenue_cents: number;
  commission_cents: number;
  commission_paid_cents: number;
  /** Comissão de pedidos já entregues e pagos pelo cliente, ainda não repassada. */
  commission_due_cents: number;
  delivered: number;
  pending_delivery: number;
};

export type ResellerWithStats = Reseller & { stats: ResellerStats };

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
