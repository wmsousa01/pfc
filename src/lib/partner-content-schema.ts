import { LINK_ICONS } from "./partner-links";
import type { PartnerContent } from "./types";

/**
 * Mapa das seções editáveis da landing do parceiro (coluna `partners.content`).
 *
 * Este arquivo é a fonte única: o índice, o formulário e a normalização no
 * servidor leem daqui. Para expor um campo novo, acrescente-o aqui — não há
 * formulário escrito à mão por seção.
 *
 * Sem "server-only": o formulário do admin é client component e importa isto.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "url"
  | "select"
  | "lines" // textarea, uma entrada por linha → string[]
  | "csv" // uma linha, separada por vírgula → string[]
  | "boolean";

export type ContentField = {
  name: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  help?: string;
  /** Só para `select`. */
  options?: readonly string[];
  /** Em seções de lista: item sem este campo preenchido é descartado. */
  required?: boolean;
};

type Base = {
  /** Vira a URL: /admin/parceiros/[id]/conteudo/[slug]. */
  slug: string;
  label: string;
  description: string;
  fields: ContentField[];
};

export type ContentSection = Base &
  (
    | {
        /** Lista repetível gravada em `content[contentKey]`. */
        kind: "list";
        contentKey: keyof PartnerContent;
        itemLabel: string;
        /** Texto do estado vazio, explicando o efeito de não ter nenhum item. */
        emptyEffect: string;
      }
    | {
        /** Campos soltos, gravados na raiz de `content` ou dentro de `triage`. */
        kind: "fields";
        container: null | "triage";
      }
  );

/** Chaves válidas de `content.perks[].icon` — espelha `partnerIcons`. */
export const PERK_ICONS = [
  "spark",
  "snowflake",
  "fridge",
  "bottle",
  "truck",
  "wallet",
  "headset",
  "shield",
  "chart",
  "calendar",
  "pin",
  "clock",
  "star",
  "check",
  "wrench",
] as const;

export const PARTNER_CONTENT_SECTIONS: ContentSection[] = [
  {
    slug: "topo",
    label: "Topo da página",
    description:
      "A frase acima do nome e os bullets curtos logo abaixo da tagline.",
    kind: "fields",
    container: null,
    fields: [
      {
        name: "eyebrow",
        label: "Frase acima do nome",
        kind: "text",
        placeholder: "Parceiro Fora da Caixa",
      },
      {
        name: "highlights",
        label: "Bullets do topo",
        kind: "lines",
        placeholder: "+16 anos equipando negócios\nEntrega e instalação",
        help: "Um por linha. Três costuma ser o limite antes de virar ruído.",
      },
    ],
  },
  {
    slug: "numeros",
    label: "Faixa de números",
    description:
      "A prova social logo abaixo do topo — avaliações do Google, tempo de casa, cidade.",
    kind: "list",
    contentKey: "stats",
    itemLabel: "Número",
    emptyEffect: "Sem nenhum número, a faixa inteira some da página.",
    fields: [
      {
        name: "value",
        label: "Número",
        kind: "text",
        required: true,
        placeholder: "4.319",
      },
      {
        name: "label",
        label: "Legenda",
        kind: "text",
        placeholder: "avaliações no Google",
      },
      {
        name: "href",
        label: "Link (opcional)",
        kind: "url",
        placeholder: "https://...",
        help: "Com link, o número vira clicável.",
      },
    ],
  },
  {
    slug: "beneficios",
    label: "Benefícios",
    description: "Os diferenciais do parceiro, em cards com ícone.",
    kind: "list",
    contentKey: "perks",
    itemLabel: "Benefício",
    emptyEffect: "Sem nenhum benefício, a seção some da página.",
    fields: [
      {
        name: "icon",
        label: "Ícone",
        kind: "select",
        options: PERK_ICONS,
        help: "Chave desconhecida cai no ícone padrão, não quebra.",
      },
      { name: "title", label: "Título", kind: "text", required: true },
      { name: "body", label: "Descrição", kind: "textarea" },
    ],
  },
  {
    slug: "produtos",
    label: "Produtos",
    description: "As linhas de produto exibidas em card.",
    kind: "list",
    contentKey: "products",
    itemLabel: "Produto",
    emptyEffect: "Sem nenhum produto, a vitrine some da página.",
    fields: [
      { name: "name", label: "Nome", kind: "text", required: true },
      { name: "body", label: "Descrição", kind: "textarea" },
      {
        name: "tags",
        label: "Etiquetas",
        kind: "csv",
        placeholder: "Bivolt, Inverter",
        help: "Separadas por vírgula.",
      },
      { name: "image_url", label: "Imagem (URL)", kind: "url" },
      {
        name: "need",
        label: "Necessidade na triagem",
        kind: "text",
        help: "Ao clicar no card, a triagem já abre com esta opção marcada.",
      },
    ],
  },
  {
    slug: "passos",
    label: "Como funciona",
    description: "Os passos numerados que explicam o processo ao visitante.",
    kind: "list",
    contentKey: "steps",
    itemLabel: "Passo",
    emptyEffect: "Sem nenhum passo, a seção some da página.",
    fields: [
      { name: "title", label: "Título", kind: "text", required: true },
      { name: "body", label: "Descrição", kind: "textarea" },
    ],
  },
  {
    slug: "faq",
    label: "Perguntas frequentes",
    description: "O FAQ que responde a objeção antes de ela virar desistência.",
    kind: "list",
    contentKey: "faq",
    itemLabel: "Pergunta",
    emptyEffect: "Sem nenhuma pergunta, o FAQ some da página.",
    fields: [
      { name: "q", label: "Pergunta", kind: "text", required: true },
      { name: "a", label: "Resposta", kind: "textarea" },
    ],
  },
  {
    slug: "contato",
    label: "Contato",
    description: "Endereço, horários e a mensagem que já vem escrita no WhatsApp.",
    kind: "fields",
    container: null,
    fields: [
      { name: "address", label: "Endereço", kind: "text" },
      {
        name: "hours",
        label: "Horários",
        kind: "lines",
        placeholder: "Seg a Sex: 8h às 18h\nSáb: 8h às 12h",
        help: "Um por linha.",
      },
      {
        name: "whatsapp_message",
        label: "Mensagem pré-escrita do WhatsApp",
        kind: "textarea",
        help: "O que já aparece digitado quando o visitante abre a conversa.",
      },
    ],
  },
  {
    slug: "botoes",
    label: "Botões de contato",
    description:
      "Os botões no fim da página. Vazio, eles são montados sozinhos a partir do WhatsApp, Instagram e site do cadastro.",
    kind: "list",
    contentKey: "links",
    itemLabel: "Botão",
    emptyEffect:
      "Sem nenhum botão aqui, a página volta a montar os três padrão do cadastro.",
    fields: [
      {
        name: "label",
        label: "Texto do botão",
        kind: "text",
        required: true,
        placeholder: "Falar no WhatsApp",
      },
      {
        name: "url",
        label: "Link",
        kind: "url",
        required: true,
        placeholder: "https://wa.me/55...",
      },
      {
        name: "icon",
        label: "Ícone",
        kind: "select",
        options: LINK_ICONS,
        help: "\"none\" deixa o botão só com o texto.",
      },
      {
        name: "primary",
        label: "Botão principal (preenchido com a cor da marca)",
        kind: "boolean",
        help: "Sem nenhum marcado, o primeiro da lista vira o principal.",
      },
    ],
  },
  {
    slug: "triagem",
    label: "Triagem de leads",
    description:
      "O formulário que qualifica o visitante antes de mandar para o WhatsApp.",
    kind: "fields",
    container: "triage",
    fields: [
      {
        name: "enabled",
        label: "Triagem ligada",
        kind: "boolean",
        help: "Desligada, a página mostra só o botão de WhatsApp — e você para de receber lead qualificado.",
      },
      { name: "title", label: "Título", kind: "text" },
      { name: "subtitle", label: "Subtítulo", kind: "textarea" },
      {
        name: "business_types",
        label: "Tipos de negócio",
        kind: "lines",
        help: "Um por linha. Vazio usa a lista padrão.",
      },
      {
        name: "ideal_business_types",
        label: "Tipos que pontuam mais",
        kind: "lines",
        help: "O cliente ideal do parceiro. Um por linha — precisa bater com a lista acima.",
      },
      {
        name: "cities",
        label: "Cidades sugeridas",
        kind: "lines",
        help: "Um por linha.",
      },
    ],
  },
];

export function findContentSection(slug: string): ContentSection | undefined {
  return PARTNER_CONTENT_SECTIONS.find((s) => s.slug === slug);
}

/** Quantos itens a seção tem hoje — usado no índice. */
export function countForSection(
  section: ContentSection,
  content: PartnerContent | null
): number {
  if (!content) return 0;

  if (section.kind === "list") {
    const value = content[section.contentKey];
    return Array.isArray(value) ? value.length : 0;
  }

  const bag = (
    section.container ? content[section.container] : content
  ) as Record<string, unknown> | undefined;
  if (!bag) return 0;

  return section.fields.filter((f) => {
    const v = bag[f.name];
    if (v === undefined || v === null || v === "") return false;
    if (Array.isArray(v)) return v.length > 0;
    return true;
  }).length;
}
