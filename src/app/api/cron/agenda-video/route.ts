import { NextResponse, type NextRequest } from "next/server";
import { runVideoQueue } from "@/lib/agenda/video";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Envio dos episódios gravados ao YouTube, em pedaços, e o disparo dos
 * cortes depois da estreia. Chamada a cada 5 min pelo pg_cron (019_agenda_video.sql),
 * separada da fila social para o envio não roubar o tempo dela.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runVideoQueue(240_000));
}
