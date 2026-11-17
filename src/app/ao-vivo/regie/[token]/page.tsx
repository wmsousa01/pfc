import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AoVivoRegie from "@/components/ao-vivo/AoVivoRegie";
import { estadoRegie, quadroDaRegie } from "@/lib/ao-vivo/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Régie | Ao vivo", robots: { index: false, follow: false } };

/** Painel da régie, sem login (como o espelho): começa a live, segura, solta e pula inserções. */
export default async function RegiePage({ params }: { params: { token: string } }) {
  const quadro = await quadroDaRegie(params.token);
  if (!quadro) notFound();
  return <AoVivoRegie token={params.token} inicial={await estadoRegie(quadro)} />;
}
