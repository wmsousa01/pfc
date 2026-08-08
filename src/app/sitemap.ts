import type { MetadataRoute } from "next";
import { site } from "@/lib/config";
import { getActivePartners } from "@/lib/partners";

/**
 * Sitemap público.
 *
 * Só entram páginas que fazem sentido para alguém que chegou pelo Google.
 * Ficam de fora, de propósito:
 *   - /admin, /revendedor, /sem-acesso, /redefinir-senha — área logada;
 *   - /go/[slug] e /r/[slug] — redirects de QR e link de revendedor. Indexar um
 *     redirect rastreado significa contar acesso de robô como acesso de pessoa,
 *     e é justamente esse número que a gente vende como confiável.
 *
 * Revalida junto com a página do parceiro (300s) para que um parceiro novo
 * apareça aqui sem precisar de novo deploy.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const estaticas: MetadataRoute.Sitemap = [
    { path: "/", changeFrequency: "weekly" as const, priority: 1 },
    { path: "/parcerias", changeFrequency: "monthly" as const, priority: 0.9 },
    { path: "/cortes", changeFrequency: "monthly" as const, priority: 0.9 },
    {
      path: "/como-anunciar",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    { path: "/loja", changeFrequency: "weekly" as const, priority: 0.7 },
  ].map(({ path, ...rest }) => ({
    ...rest,
    url: `${site.url}${path}`,
    lastModified: now,
  }));

  const parceiros = (await getActivePartners()).map((p) => ({
    url: `${site.url}/parceiros/${p.slug}`,
    lastModified: p.created_at ? new Date(p.created_at) : now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...estaticas, ...parceiros];
}
