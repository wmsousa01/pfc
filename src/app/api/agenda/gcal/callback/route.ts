import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectCalendar } from "@/lib/agenda/gcal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const back = new URL("/admin/agenda/config", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state || state !== req.cookies.get("gcal_oauth_state")?.value) {
    back.searchParams.set("erro", req.nextUrl.searchParams.get("error") ?? "Conexão inválida ou expirada.");
    return NextResponse.redirect(back);
  }

  try {
    back.searchParams.set("ok", await connectCalendar(code, `${req.nextUrl.origin}/api/agenda/gcal/callback`));
  } catch (e) {
    back.searchParams.set("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("gcal_oauth_state");
  return res;
}
