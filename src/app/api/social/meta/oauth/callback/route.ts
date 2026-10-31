import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectMeta } from "@/lib/social/meta";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const back = new URL("/admin/marketing", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state || state !== req.cookies.get("meta_oauth_state")?.value) {
    back.searchParams.set(
      "erro",
      req.nextUrl.searchParams.get("error_description") ?? "Conexão inválida ou expirada."
    );
    return NextResponse.redirect(back);
  }

  try {
    const who = await connectMeta(code, `${req.nextUrl.origin}/api/social/meta/oauth/callback`);
    back.searchParams.set("ok", `Conectado: ${who}`);
  } catch (e) {
    back.searchParams.set("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("meta_oauth_state");
  return res;
}
