import type { Metadata } from "next";
import { notFound } from "next/navigation";
import InstagramConvidado from "@/components/ao-vivo/InstagramConvidado";
import { instagramDoDia } from "@/lib/ao-vivo/instagram";
import { quadroDaTela } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Instagram do convidado | Ao vivo", robots: { index: false, follow: false } };

/**
 * Cena do OBS com o Instagram do convidado do dia. Usa o mesmo token da tela de
 * inserções do quadro: o link é fixo e troca de convidado sozinho a cada episódio.
 */
export default async function InstagramPage({ params }: { params: { token: string } }) {
  const quadro = await quadroDaTela(params.token);
  if (!quadro) notFound();
  return <InstagramConvidado dados={await instagramDoDia(quadro)} />;
}
