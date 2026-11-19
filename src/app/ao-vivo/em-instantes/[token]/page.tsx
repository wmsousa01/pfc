import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EmInstantes from "@/components/ao-vivo/EmInstantes";
import { emInstantes } from "@/lib/ao-vivo/em-instantes";
import { quadroDaTela } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Em instantes | Ao vivo", robots: { index: false, follow: false } };

/** Cena "Em instantes" do OBS: link fixo por quadro (o token da tela de inserções). */
export default async function EmInstantesPage({ params }: { params: { token: string } }) {
  const quadro = await quadroDaTela(params.token);
  if (!quadro) notFound();
  return <EmInstantes dados={await emInstantes(quadro)} thumb={`/ao-vivo/em-instantes/${params.token}/thumb`} />;
}
