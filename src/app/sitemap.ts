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

  /*
   * `lastModified` é data de alteração de conteúdo, não hora de build: com o
   * relógio da requisição aqui, o ISR de 300s faria toda página jurar que
   * mudou a cada 5 minutos, e o buscador aprende a ignorar o sinal. Por isso
   * a data é escrita à mão — ao mexer no conteúdo de uma dessas páginas,
   * atualize a data dela na mesma linha.
   */
  const estaticas: MetadataRoute.Sitemap = [
    {
      path: "/",
      alterado: "2026-07-17",
      changeFrequency: "weekly" as const,
      priority: 1,
    },
    {
      path: "/parcerias",
      alterado: "2026-07-17",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      path: "/cortes",
      alterado: "2026-08-08",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      path: "/pfc-visita",
      alterado: "2026-10-22",
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    {
      path: "/como-anunciar",
      alterado: "2026-08-04",
      changeFrequency: "monthly" as const,
      priority: 0.8,
    },
    {
      path: "/loja",
      alterado: "2026-07-28",
      changeFrequency: "weekly" as const,
      priority: 0.7,
    },
  ].map(({ path, alterado, ...rest }) => ({
    ...rest,
    url: `${site.url}${path}`,
    lastModified: new Date(alterado),
  }));

  /*
   * Página de parceiro muda quando o admin edita o conteúdo, não quando o
   * parceiro foi cadastrado. `updated_at` (migration 008) é o sinal certo;
   * `created_at` fica de reserva para base ainda sem a coluna.
   */
  const parceiros = (await getActivePartners()).map((p) => ({
    url: `${site.url}/parceiros/${p.slug}`,
    lastModified: new Date(p.updated_at ?? p.created_at ?? now),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...estaticas, ...parceiros];
}
