import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Cliente mínimo do Mercado Pago para o PFCTV Ads (app "PFCTV Ads", Checkout
 * Pro). Só fetch: preferência, consulta de pagamento, reembolso e a checagem
 * da assinatura do webhook.
 *
 * MP_ACCESS_TOKEN decide o ambiente: credencial do vendedor de teste testa,
 * credencial de produção cobra de verdade. A credencial nunca vai ao cliente.
 */

const API = "https://api.mercadopago.com";

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("MP_ACCESS_TOKEN ausente.");
  return t;
}

export class MpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function mp<T>(path: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof json.message === "string" ? json.message : `HTTP ${res.status}`;
    throw new MpError(`Mercado Pago: ${msg}`, res.status);
  }
  return json as T;
}

export type Preferencia = { id: string; init_point: string; sandbox_init_point?: string };

/** ISO com fuso de Brasília, no formato que a API aceita. */
function isoBrasilia(t: number): string {
  return `${new Date(t - 3 * 3_600_000).toISOString().slice(0, 23)}-03:00`;
}

export async function criarPreferencia(p: {
  ofertaId: string;
  titulo: string;
  valorCents: number;
  comprador: { nome: string; email: string };
  expiraEm: number;
  /** Origem da página (localhost, preview ou produção): para onde o cliente volta. */
  siteUrl: string;
  /** Domínio oficial: o webhook vai sempre para produção, nunca para a origem da requisição. */
  webhookBase: string;
}): Promise<Preferencia> {
  const https = p.siteUrl.startsWith("https://");
  const retorno = `${p.siteUrl}/anuncie/retorno`;
  const webhook = p.webhookBase.startsWith("https://") ? { notification_url: `${p.webhookBase}/api/ads/mp/webhook` } : {};
  return mp<Preferencia>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: `pref-${p.ofertaId}`,
    body: {
      items: [
        {
          id: "oferta-da-semana",
          title: p.titulo.slice(0, 250),
          quantity: 1,
          unit_price: p.valorCents / 100,
          currency_id: "BRL",
        },
      ],
      payer: { name: p.comprador.nome, email: p.comprador.email },
      external_reference: p.ofertaId,
      back_urls: { success: retorno, pending: retorno, failure: retorno },
      // auto_return só com URL pública em https (não funciona em localhost).
      ...(https ? { auto_return: "approved" } : {}),
      ...webhook,
      statement_descriptor: "PFCTV ADS",
      // Boleto compensa devagar demais para uma vaga semanal; ticket baixo é à vista.
      payment_methods: { excluded_payment_types: [{ id: "ticket" }], installments: 1 },
      expires: true,
      expiration_date_to: isoBrasilia(p.expiraEm),
    },
  });
}

export type Pagamento = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference: string | null;
  transaction_amount: number;
  payment_type_id?: string;
  date_approved?: string | null;
};

export function buscarPagamento(id: string): Promise<Pagamento> {
  if (!/^\d{1,20}$/.test(id)) throw new MpError("id de pagamento inválido", 400);
  return mp<Pagamento>(`/v1/payments/${id}`);
}

/** Reembolso total. A chave de idempotência evita devolver duas vezes. */
export async function reembolsar(paymentId: string): Promise<string> {
  const r = await mp<{ id: number }>(`/v1/payments/${paymentId}/refunds`, {
    method: "POST",
    idempotencyKey: `refund-${paymentId}`,
    body: {},
  });
  return String(r.id);
}

/**
 * Assinatura do webhook (x-signature: "ts=...,v1=..."): HMAC-SHA256 do
 * manifesto "id:{data.id};request-id:{x-request-id};ts:{ts};" com a chave
 * secreta do painel. Sem MP_WEBHOOK_SECRET configurado, devolve null (não
 * verificado) — e quem chama segue seguro porque sempre reconsulta o
 * pagamento na API antes de mudar qualquer coisa.
 */
export function assinaturaValida(h: { signature: string | null; requestId: string | null; dataId: string }): boolean | null {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return null;
  if (!h.signature) return false;
  const partes = Object.fromEntries(
    h.signature.split(",").map((kv) => {
      const [k, ...v] = kv.trim().split("=");
      return [k, v.join("=")];
    }),
  );
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${h.dataId.toLowerCase()};${h.requestId ? `request-id:${h.requestId};` : ""}ts:${partes.ts};`;
  const esperado = createHmac("sha256", secret).update(manifesto).digest("hex");
  const a = Buffer.from(esperado);
  const b = Buffer.from(partes.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
