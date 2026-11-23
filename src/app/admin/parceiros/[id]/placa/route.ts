import { notFound } from "next/navigation";
import type { NextRequest } from "next/server";
import { requireAcesso } from "@/lib/auth";
import { getPartnerById } from "@/lib/admin";
import { renderPlaca } from "@/lib/placa";

export const dynamic = "force-dynamic";

/** PNG da placa do QR. `?download=1` baixa como arquivo. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  await requireAcesso("parceiros.ver");
  const partner = await getPartnerById(params.id);
  if (!partner) notFound();

  const png = await renderPlaca(partner);
  const headers = new Headers({ "Content-Type": "image/png", "Cache-Control": "no-store" });
  if (request.nextUrl.searchParams.get("download")) {
    headers.set("Content-Disposition", `attachment; filename="placa-qr-${partner.slug}.png"`);
  }
  return new Response(new Uint8Array(png), { status: 200, headers });
}
