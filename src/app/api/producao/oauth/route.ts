import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { authUrl } from "@/lib/producao/youtube-api";

export const dynamic = "force-dynamic";

/** Início da conexão do canal: manda o admin para o consentimento do Google. */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/producao/oauth/callback`;
  const res = NextResponse.redirect(authUrl(redirectUri, state));
  res.cookies.set("yt_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/producao/oauth",
  });
  return res;
}
