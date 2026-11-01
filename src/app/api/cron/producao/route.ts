import { NextResponse, type NextRequest } from "next/server";
import { isContentaConfigured } from "@/lib/producao/contenta";
import { runLives } from "@/lib/producao/lives";
import { AUTOMACAO, runQueue } from "@/lib/producao/pipeline";
import { runPlaylists } from "@/lib/producao/playlists";
import { connectedChannel } from "@/lib/producao/youtube-api";

export const dynamic = "force-dynamic";
// Cada thumb leva ~25 s no Gemini; duas em paralelo por corte, dois cortes.
export const maxDuration = 300;

/** Rodada automática da produção (Vercel Cron): lives → Contenta, cortes → thumbs. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await connectedChannel())) {
    return NextResponse.json({ skipped: "canal não conectado" });
  }
  // As lives vão primeiro e não derrubam as thumbs se o Contenta falhar.
  const lives = isContentaConfigured()
    ? await runLives(AUTOMACAO).catch((e) => ({ lives_erro: e instanceof Error ? e.message : String(e) }))
    : { lives: "CONTENTA_HUB_SECRET ausente" };
  const thumbs = await runQueue(2);
  // Cortes que subiram desde a última rodada vão para as playlists do quadro.
  const playlists = isContentaConfigured()
    ? await runPlaylists().catch((e) => ({ erro: e instanceof Error ? e.message : String(e) }))
    : null;
  return NextResponse.json({ ...lives, ...thumbs, playlists });
}
