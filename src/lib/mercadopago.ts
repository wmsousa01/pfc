import "server-only";

/**
 * Mercado Pago — Checkout Pro da app "PFCTV Ads" (credenciais em
 * MP_ACCESS_TOKEN). Só duas chamadas: criar a preferência e ler um pagamento.
 *
 * O webhook nunca confia no corpo da notificação: ele só traz o id, e o
 * pagamento é relido aqui com o token do vendedor. Uma notificação forjada
 * não tem como aprovar nada.
 */

const API = "https://api.mercadopago.com";

export const mpConfigured = () => Boolean(process.env.MP_ACCESS_TOKEN);

async function mp<T>(path: string, init?: RequestInit): Promise<T | null> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(`${API}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    console.error("[mercadopago]", path, res.status, (await res.text()).slice(0, 500));
    return null;
  }
  return (await res.json()) as T;
}

export type PreferenceInput = {
  checkoutId: string;
  title: string;
  description: string;
  amount: number;
  metodo: "pix" | "cartao";
  payer: { name: string; email: string };
  /** Origem pública do site (https://www.pfctv.com.br ou a do preview). */
  origin: string;
};

/** Cria a preferência e devolve a URL do pagamento. */
export async function createPreference(
  input: PreferenceInput
): Promise<{ id: string; url: string } | null> {
  const https = input.origin.startsWith("https://");
  const back = `${input.origin}/contratar/retorno?ref=${input.checkoutId}`;

  const payment_methods =
    input.metodo === "pix"
      ? {
          // À vista: Pix (bank_transfer) e boleto (ticket).
          excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }],
          installments: 1,
        }
      : {
          // Até 3x sem juros depende do "parcelamento sem juros" ligado na
          // conta; acima disso o MP cobra o juro do comprador (lib/payment).
          excluded_payment_types: [{ id: "ticket" }, { id: "bank_transfer" }, { id: "atm" }],
          installments: 12,
        };

  const [first, ...rest] = input.payer.name.trim().split(/\s+/);
  const body = {
    items: [
      {
        id: input.checkoutId,
        title: input.title.slice(0, 250),
        description: input.description.slice(0, 250),
        category_id: "services",
        quantity: 1,
        currency_id: "BRL",
        unit_price: Math.round(input.amount * 100) / 100,
      },
    ],
    payer: { name: first, surname: rest.join(" ") || undefined, email: input.payer.email },
    external_reference: input.checkoutId,
    statement_descriptor: "PFCTV",
    payment_methods,
    back_urls: { success: back, pending: back, failure: back },
    // O MP só aceita auto_return e notificação com URL pública em https.
    ...(https
      ? {
          auto_return: "approved",
          notification_url: `${input.origin}/api/mercadopago/webhook`,
        }
      : {}),
    // Pix vence em 3 dias; a preferência some junto.
    expires: true,
    expiration_date_to: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
  };

  const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>(
    "/checkout/preferences",
    { method: "POST", body: JSON.stringify(body) }
  );
  if (!pref) return null;
  const sandbox = (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-");
  return { id: pref.id, url: sandbox ? pref.sandbox_init_point : pref.init_point };
}

export type MpPayment = {
  id: number;
  status: string; // approved | pending | in_process | rejected | cancelled | refunded | charged_back
  status_detail: string;
  external_reference: string | null;
  transaction_amount: number;
  currency_id: string;
  installments: number;
  payment_type_id: string;
  date_approved: string | null;
};

export async function getPayment(id: string): Promise<MpPayment | null> {
  if (!/^\d{1,20}$/.test(id)) return null;
  return mp<MpPayment>(`/v1/payments/${id}`);
}

/** Pagamentos já feitos para um checkout (fallback quando o retorno não traz o id). */
export async function findPaymentsByReference(ref: string): Promise<MpPayment[]> {
  const r = await mp<{ results: MpPayment[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(ref)}&sort=date_created&criteria=desc`
  );
  return r?.results ?? [];
}
