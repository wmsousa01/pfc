import { NextResponse, type NextRequest } from "next/server";
import { assinaturaValida } from "@/lib/ads/mercadopago";
import { sincronizarPagamento } from "@/lib/ads/store";

export const dynamic = "force-dynamic";

/**
 * Webhook do Mercado Pago (tópico payment). O corpo só diz "o pagamento X
 * mudou": o estado de verdade vem sempre de uma consulta à API com a nossa
 * credencial, então uma notificação forjada não aprova nada.
 *
 * Responde 200 rápido para o MP não reenviar; erro nosso responde 500 para
 * ele tentar de novo.
 */
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as { type?: string; topic?: string; data?: { id?: string | number } };
  const tipo = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const dataId = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");

  if (tipo !== "payment" || !/^\d{1,20}$/.test(dataId)) return NextResponse.json({ ignorado: true });

  const ok = assinaturaValida({
    signature: req.headers.get("x-signature"),
    requestId: req.headers.get("x-request-id"),
    dataId,
  });
  if (ok === false) return NextResponse.json({ error: "assinatura inválida" }, { status: 401 });

  try {
    const o = await sincronizarPagamento(dataId);
    return NextResponse.json({ ok: true, oferta: o?.codigo ?? null, status: o?.status ?? null });
  } catch (e) {
    console.error("[ads webhook]", e);
    return NextResponse.json({ error: "falha ao sincronizar" }, { status: 500 });
  }
}
