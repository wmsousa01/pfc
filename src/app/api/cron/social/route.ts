import { NextResponse, type NextRequest } from "next/server";
import { runAdsQueue } from "@/lib/ads/fila";
import { runAgendaQueue } from "@/lib/agenda/fluxo";
import { runYoutubeAuto } from "@/lib/social/auto-youtube";
import { runNumerosQueue } from "@/lib/social/numeros-semana";
import { runSocialQueue } from "@/lib/social/publisher";

export const dynamic = "force-dynamic";
// Upload de Short no YouTube leva ~1 min; a rodada para de pegar post em 150 s.
export const maxDuration = 300;

/**
 * Fila de publicação orgânica. Chamada a cada 5 min pelo pg_cron (014_social_cron.sql).
 * Também publica as artes de divulgação programadas na agenda e o post
 * "Números da semana" (gera o rascunho na terça, publica o que foi aprovado),
 * põe na fila do YouTube os melhores shorts de cada live recém-cortada e
 * publica o story das Ofertas da semana (PFCTV Ads) que chegaram na hora.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // A agenda não derruba a fila dos cortes se falhar.
  const agenda = await runAgendaQueue().catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));
  const ofertas = await runAdsQueue().catch((e) => `erro: ${e instanceof Error ? e.message : String(e)}`);
  const numeros = await runNumerosQueue().catch((e) => `erro: ${e instanceof Error ? e.message : String(e)}`);
  // Antes da fila: o que for agendado para agora já sai nesta rodada.
  const youtubeAuto = await runYoutubeAuto().catch((e) => `erro: ${e instanceof Error ? e.message : String(e)}`);
  return NextResponse.json({ ...(await runSocialQueue()), agenda, numeros, youtubeAuto, ofertas });
}
