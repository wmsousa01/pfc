import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AoVivoTela from "@/components/ao-vivo/AoVivoTela";
import { quadroDaTela } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tela do OBS | Ao vivo", robots: { index: false, follow: false } };

/**
 * Fonte de navegador do OBS, uma por quadro: cola a URL uma vez na cena e
 * pronto. Os patrocinadores entram e saem conforme as cotas e a régie.
 */
export default async function TelaAoVivoPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { teste?: string };
}) {
  if (!(await quadroDaTela(params.token))) notFound();
  return <AoVivoTela token={params.token} teste={searchParams.teste === "1"} />;
}
