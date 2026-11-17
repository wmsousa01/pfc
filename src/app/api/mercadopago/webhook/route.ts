import { NextResponse } from "next/server";
import { applyPayment } from "@/lib/checkout-store";
import { getPayment } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

/**
 * Notificação do Mercado Pago (Checkout Pro). O corpo só serve para achar o
 * id: o pagamento é relido na API com o token do vendedor antes de qualquer
 * mudança, então uma chamada forjada não aprova nada.
 *
 * Responde 200 mesmo quando ignora, para o MP não reenviar à toa; 500 só
 * quando vale a pena ele tentar de novo (falha ao ler o pagamento).
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  let body: { type?: string; topic?: string; action?: string; data?: { id?: string | number } } = {};
  try {
    body = await req.json();
  } catch {
    // IPN antigo vem só com query string.
  }

  const type = body.type ?? body.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
  const id = String(body.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (type !== "payment" || !id) return NextResponse.json({ ok: true, ignored: true });

  const payment = await getPayment(id);
  if (!payment) return NextResponse.json({ ok: false }, { status: 500 });

  const c = await applyPayment(payment);
  return NextResponse.json({ ok: true, status: c?.status ?? "sem-checkout" });
}
