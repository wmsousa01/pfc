import { NextResponse, type NextRequest } from "next/server";
import { isContentaConfigured } from "@/lib/producao/contenta";
import { runLives, transmissoesAguardandoCorte } from "@/lib/producao/lives";
import { AUTOMACAO } from "@/lib/producao/pipeline";
import { connectedChannel } from "@/lib/producao/youtube-api";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Corte automático das lives, guiado pela agenda. O pg_cron chama a cada
 * 15 min (028_cortes_cron.sql), mas só há trabalho depois do fim previsto de
 * um episódio ao vivo que ainda não foi cortado. Nos outros horários a rota
 * sai sem consultar o YouTube nem o Contenta. Lives fora da agenda continuam
 * no painel de /admin/producao, para cortar com o botão.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isContentaConfigured()) return NextResponse.json({ skipped: "CONTENTA_HUB_SECRET ausente" });

  const episodios = await transmissoesAguardandoCorte();
  if (episodios.length === 0) return NextResponse.json({ skipped: "nenhuma transmissão aguardando corte" });
  if (!(await connectedChannel())) return NextResponse.json({ skipped: "canal não conectado" });

  const lives = await runLives(AUTOMACAO);
  return NextResponse.json({ episodios: episodios.map((e) => `${e.quadro} ${e.inicio}`), ...lives });
}
