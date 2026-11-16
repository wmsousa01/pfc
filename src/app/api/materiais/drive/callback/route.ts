import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectDrive } from "@/lib/materiais/drive";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const back = new URL("/admin/materiais", req.nextUrl.origin);
  back.searchParams.set("view", "config");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state || state !== req.cookies.get("drive_oauth_state")?.value) {
    back.searchParams.set("erro", req.nextUrl.searchParams.get("error") ?? "Conexão inválida ou expirada.");
    return NextResponse.redirect(back);
  }

  try {
    back.searchParams.set("ok", await connectDrive(code, `${req.nextUrl.origin}/api/materiais/drive/callback`));
  } catch (e) {
    back.searchParams.set("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("drive_oauth_state");
  return res;
}
