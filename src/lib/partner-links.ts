import { site } from "./config";
import type { Partner, PartnerContent, PartnerLink } from "./types";

/**
 * Botões do bloco de contato da landing do parceiro.
 *
 * Até então eram três botões fixos no JSX — WhatsApp, Instagram e site — com
 * rótulo escrito no código. Agora vivem em `content.links` e são editáveis.
 *
 * Quando `content.links` está vazio, os três antigos são DERIVADOS dos campos
 * do cadastro. Isso mantém no ar todo parceiro que já existe sem precisar de
 * migração de dados: só quem editar a seção passa a ter a lista própria.
 *
 * Módulo puro (sem server-only): a página pública e o admin usam os dois.
 */

/** Link de WhatsApp do parceiro, com a mensagem pré-escrita dele. */
export function whatsappHref(
  partner: Pick<Partner, "whatsapp" | "cta_url">,
  content: PartnerContent
): string | null {
  if (!partner.whatsapp) return partner.cta_url ?? null;
  const digits = partner.whatsapp.replace(/\D/g, "");
  const message =
    content.whatsapp_message ?? `Olá! Vim pela página de vocês no ${site.brand}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** Os três botões clássicos, montados a partir do cadastro. */
export function derivePartnerLinks(
  partner: Pick<Partner, "whatsapp" | "cta_url" | "instagram" | "website">,
  content: PartnerContent
): PartnerLink[] {
  const links: PartnerLink[] = [];
  const wa = whatsappHref(partner, content);

  if (wa) {
    links.push({
      label: "Falar no WhatsApp",
      url: wa,
      icon: "whatsapp",
      primary: true,
    });
  }
  if (partner.instagram) {
    const handle = partner.instagram.replace(/^@/, "");
    links.push({
      label: `@${handle}`,
      url: `https://instagram.com/${handle}`,
      icon: "instagram",
    });
  }
  if (partner.website) {
    links.push({ label: "Visitar o site", url: partner.website, icon: "site" });
  }
  return links;
}

/** O que a página deve renderizar: a lista editada ou, na falta dela, a derivada. */
export function partnerLinksFor(
  partner: Pick<Partner, "whatsapp" | "cta_url" | "instagram" | "website">,
  content: PartnerContent
): PartnerLink[] {
  const custom = content.links?.filter((l) => l?.label && l?.url);
  return custom?.length ? custom : derivePartnerLinks(partner, content);
}

/** Ícones oferecidos no editor. `none` = botão só com texto. */
export const LINK_ICONS = ["whatsapp", "instagram", "site", "none"] as const;
