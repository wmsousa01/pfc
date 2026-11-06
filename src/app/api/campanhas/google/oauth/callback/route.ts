import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { connectGoogleAds } from "@/lib/campanhas/google-ads";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await requireAdmin();
  const back = new URL("/admin/campanhas?view=contas", req.nextUrl.origin);
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state || state !== req.cookies.get("gads_oauth_state")?.value) {
    back.searchParams.set("erro", req.nextUrl.searchParams.get("error") ?? "Conexão inválida ou expirada.");
    return NextResponse.redirect(back);
  }

  try {
    const nome = await connectGoogleAds(code, `${req.nextUrl.origin}/api/campanhas/google/oauth/callback`);
    back.searchParams.set("ok", `Google Ads conectado: ${nome}`);
  } catch (e) {
    back.searchParams.set("erro", e instanceof Error ? e.message : "Falha ao conectar.");
  }
  const res = NextResponse.redirect(back);
  res.cookies.delete("gads_oauth_state");
  return res;
}
