import { NextResponse, type NextRequest } from "next/server";
import { runQueue } from "@/lib/producao/pipeline";
import { connectedChannel } from "@/lib/producao/youtube-api";

export const dynamic = "force-dynamic";
// Cada thumb leva ~25 s no Gemini; duas em paralelo por corte, dois cortes.
export const maxDuration = 300;

/** Rodada automática da produção (Vercel Cron). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await connectedChannel())) {
    return NextResponse.json({ skipped: "canal não conectado" });
  }
  return NextResponse.json(await runQueue(2));
}
