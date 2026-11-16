import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth";
import { driveAuthUrl } from "@/lib/materiais/drive";

export const dynamic = "force-dynamic";

/** Início da conexão do Drive onde ficam os materiais dos editores. */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const state = randomBytes(16).toString("hex");
  const redirectUri = `${req.nextUrl.origin}/api/materiais/drive/callback`;
  const res = NextResponse.redirect(driveAuthUrl(redirectUri, state));
  res.cookies.set("drive_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/materiais/drive",
  });
  return res;
}
