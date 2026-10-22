import type { MetadataRoute } from "next";
import { site } from "@/lib/config";

/**
 * Um sitemap sozinho não basta: sem robots, o buscador acha o painel e os
 * redirects rastreados do mesmo jeito. As duas listas precisam concordar — o
 * que está bloqueado aqui é exatamente o que ficou de fora do sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/revendedor",
        "/sem-acesso",
        "/redefinir-senha",
        "/go/",
        "/r/",
        "/parceiros/*/painel",
        "/proposta/",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
