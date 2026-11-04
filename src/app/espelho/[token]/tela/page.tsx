import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EspelhoTela from "@/components/agenda/EspelhoTela";
import { episodioPorEspelho, imagemNaTela, materiaisDoEspelho } from "@/lib/agenda/espelho";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tela | Espelho", robots: { index: false, follow: false } };

/**
 * Fonte de navegador do OBS: só a imagem do bloco no ar, em tela cheia.
 * ?fundo=transparente para sobrepor a outra cena; ?ajuste=cobrir para
 * preencher o quadro cortando as bordas.
 */
export default async function TelaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { fundo?: string; ajuste?: string };
}) {
  const ep = await episodioPorEspelho(params.token);
  if (!ep) notFound();
  return (
    <EspelhoTela
      token={params.token}
      inicial={imagemNaTela(ep, await materiaisDoEspelho(ep.id))}
      transparente={searchParams.fundo === "transparente"}
      cobrir={searchParams.ajuste === "cobrir"}
    />
  );
}
