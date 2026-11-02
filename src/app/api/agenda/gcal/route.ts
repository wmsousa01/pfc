import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { gcalAuthUrl } from "@/lib/agenda/gcal";

export const dynamic = "force-dynamic";

/** Início da conexão do Google Calendar da produção. */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/agenda/gcal/callback`;
  const res = NextResponse.redirect(gcalAuthUrl(redirectUri, state));
  res.cookies.set("gcal_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/agenda/gcal",
  });
  return res;
}
