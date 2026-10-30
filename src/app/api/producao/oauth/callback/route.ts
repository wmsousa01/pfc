import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectChannel } from "@/lib/producao/youtube-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const back = new URL("/admin/producao/config", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state || state !== req.cookies.get("yt_oauth_state")?.value) {
    back.searchParams.set("erro", req.nextUrl.searchParams.get("error") ?? "Conexão inválida ou expirada.");
    return NextResponse.redirect(back);
  }

  try {
    const channel = await connectChannel(code, `${req.nextUrl.origin}/api/producao/oauth/callback`);
    back.searchParams.set("ok", channel);
  } catch (e) {
    back.searchParams.set("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("yt_oauth_state");
  return res;
}
