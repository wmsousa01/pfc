import { NextResponse, type NextRequest } from "next/server";
import { runAgendaQueue } from "@/lib/agenda/fluxo";
import { runSocialQueue } from "@/lib/social/publisher";

export const dynamic = "force-dynamic";
// Upload de Short no YouTube leva ~1 min; a rodada para de pegar post em 150 s.
export const maxDuration = 300;

/**
 * Fila de publicação orgânica. Chamada a cada 5 min pelo pg_cron (014_social_cron.sql).
 * Também publica as artes de divulgação programadas na agenda.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // A agenda não derruba a fila dos cortes se falhar.
  const agenda = await runAgendaQueue().catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }));
  return NextResponse.json({ ...(await runSocialQueue()), agenda });
}
