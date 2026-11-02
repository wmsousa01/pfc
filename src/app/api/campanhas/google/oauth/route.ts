import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { googleAdsAuthUrl } from "@/lib/campanhas/google-ads";

export const dynamic = "force-dynamic";

/** Início da conexão do Google Ads: manda o admin para o consentimento do Google. */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/campanhas/google/oauth/callback`;
  const res = NextResponse.redirect(googleAdsAuthUrl(redirectUri, state));
  res.cookies.set("gads_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/campanhas/google/oauth",
  });
  return res;
}
