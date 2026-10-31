import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { metaAuthUrl } from "@/lib/social/meta";

export const dynamic = "force-dynamic";

/** Início da conexão Facebook + Instagram: manda o admin para o login da Meta. */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/social/meta/oauth/callback`;
  const res = NextResponse.redirect(metaAuthUrl(redirectUri, state));
  res.cookies.set("meta_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/social/meta/oauth",
  });
  return res;
}
