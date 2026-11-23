import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EspelhoJornal from "@/components/agenda/EspelhoJornal";
import { blocosDoEspelho, episodioPorEspelho, imagemNaTela, jornalNoAr, materiaisDoEspelho } from "@/lib/agenda/espelho";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Telejornal | Espelho", robots: { index: false, follow: false } };

/**
 * Fonte de navegador do OBS para o PFC News: imagem da notícia ao lado do
 * apresentador e GC. ?previa=N confere o bloco N (a partir de 1) sem pôr nada no ar.
 */
export default async function JornalPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { so?: string; lado?: string; previa?: string };
}) {
  const real = await episodioPorEspelho(params.token);
  if (!real) notFound();
  const total = blocosDoEspelho(real.briefing, real.roteiro).length;
  const n = Number(searchParams.previa);
  const previa = Number.isInteger(n) && n >= 1 && n <= total;
  // A prévia só muda a cópia em memória: o bloco no ar do episódio continua o mesmo.
  const ep = previa ? { ...real, espelho_atual: n - 1, espelho_imagem: null } : real;
  const materiais = await materiaisDoEspelho(ep.id);
  return (
    <EspelhoJornal
      token={params.token}
      inicial={{ tela: imagemNaTela(ep, materiais), ...jornalNoAr(ep, materiais) }}
      so={searchParams.so === "imagem" || searchParams.so === "gc" ? searchParams.so : null}
      lado={searchParams.lado === "esquerda" ? "esquerda" : "direita"}
      previa={previa}
    />
  );
}
