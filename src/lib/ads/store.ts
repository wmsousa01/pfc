import "server-only";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { OFERTA, horarioDoStory, type OfertaStatus } from "./config";
import { buscarPagamento, reembolsar } from "./mercadopago";

export type Oferta = {
  id: string;
  codigo: string;
  semana: string;
  status: OfertaStatus;
  empresa: string;
  responsavel: string;
  documento: string;
  email: string;
  whatsapp: string;
  instagram: string | null;
  cidade: string;
  titulo: string;
  descricao: string;
  cor: string | null;
  logo_path: string | null;
  valor_cents: number;
  termos_em: string;
  reservada_ate: string;
  mp_preference_id: string | null;
  mp_payment_id: string | null;
  mp_status: string | null;
  pago_em: string | null;
  reembolso_id: string | null;
  aprovada_em: string | null;
  arte_path: string | null;
  publicar_em: string | null;
  publicada_em: string | null;
  post_id: string | null;
  erro: string | null;
  motivo_recusa: string | null;
  cliques: number;
  nota_emitida_em: string | null;
  created_at: string;
  updated_at: string;
};

export function db() {
  const admin = createAdminSupabase();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY ausente.");
  return admin;
}

export async function getOferta(id: string): Promise<Oferta | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await db().from("ads_ofertas").select("*").eq("id", id).maybeSingle();
  return (data as Oferta) ?? null;
}

export async function atualizar(id: string, patch: Partial<Oferta>): Promise<void> {
  const { error } = await db()
    .from("ads_ofertas")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Vagas livres de cada semana à venda. */
export async function vagasLivres(semanas: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    semanas.map(async (s) => {
      const { data } = await db().rpc("ads_vagas_ocupadas", { p_semana: s });
      out[s] = Math.max(0, OFERTA.vagasPorSemana - Number(data ?? 0));
    }),
  );
  return out;
}

export type NovaReserva = {
  codigo: string;
  semana: string;
  empresa: string;
  responsavel: string;
  documento: string;
  email: string;
  whatsapp: string;
  instagram: string;
  cidade: string;
  titulo: string;
  descricao: string;
  cor: string;
  valor_cents: number;
  reservada_ate: string;
};

/** Reserva atômica; null = a semana lotou. */
export async function reservar(r: NovaReserva): Promise<string | null> {
  const { data, error } = await db().rpc("ads_reservar_oferta", { p: r, p_vagas: OFERTA.vagasPorSemana });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}

/**
 * Traz o estado de um pagamento do Mercado Pago para a oferta. Chamado pelo
 * webhook e pela página de retorno (que funciona até em localhost, onde o
 * webhook não chega). Idempotente: só avança a oferta, nunca volta atrás.
 */
export async function sincronizarPagamento(paymentId: string): Promise<Oferta | null> {
  const p = await buscarPagamento(paymentId);
  if (!p.external_reference) return null;
  const o = await getOferta(p.external_reference);
  if (!o) return null;

  // Pagamento de outra oferta com o mesmo id não pode sobrescrever esta.
  if (o.mp_payment_id && o.mp_payment_id !== String(p.id)) return o;

  const base = { mp_payment_id: String(p.id), mp_status: p.status };
  if (p.status === "approved") {
    if (Math.round(p.transaction_amount * 100) < o.valor_cents) {
      await atualizar(o.id, { ...base, erro: `Valor pago (${p.transaction_amount}) menor que o da oferta.` });
      return getOferta(o.id);
    }
    if (o.status === "reservada" || o.status === "cancelada") {
      // Aprovado depois de a reserva vencer: aceita mesmo assim (pode passar
      // 1 vaga da semana). Recusar dinheiro já pago é pior para o cliente.
      await atualizar(o.id, { ...base, status: "paga", pago_em: p.date_approved ?? new Date().toISOString() });
    } else {
      await atualizar(o.id, base);
    }
  } else if ((p.status === "pending" || p.status === "in_process") && o.status === "reservada") {
    // Pix gerado e ainda não pago: segura a vaga mais um pouco.
    const ate = Date.now() + OFERTA.reservaPixHoras * 3_600_000;
    await atualizar(o.id, { ...base, reservada_ate: new Date(Math.max(ate, Date.parse(o.reservada_ate))).toISOString() });
  } else {
    await atualizar(o.id, base);
  }
  return getOferta(o.id);
}

export async function listarOfertas(filtro: { semana?: string; status?: OfertaStatus[] } = {}): Promise<Oferta[]> {
  let q = db().from("ads_ofertas").select("*").order("semana", { ascending: false }).order("created_at", { ascending: true });
  if (filtro.semana) q = q.eq("semana", filtro.semana);
  if (filtro.status?.length) q = q.in("status", filtro.status);
  const { data, error } = await q.limit(300);
  if (error) throw new Error(error.message);
  return (data as Oferta[]) ?? [];
}

/** Próximo horário de story da semana: a posição é quantas já foram aprovadas. */
export async function proximoHorario(semana: string): Promise<number> {
  const { count } = await db()
    .from("ads_ofertas")
    .select("id", { count: "exact", head: true })
    .eq("semana", semana)
    .not("aprovada_em", "is", null);
  const h = horarioDoStory(semana, count ?? 0);
  // Aprovou depois do horário previsto: sai na próxima rodada da fila.
  return Math.max(h, Date.now() + 5 * 60_000);
}

/** Recusa e devolve o dinheiro. Sem pagamento, só cancela. */
export async function recusar(o: Oferta, motivo: string): Promise<void> {
  let reembolsoId = o.reembolso_id;
  if (o.mp_payment_id && !reembolsoId && o.mp_status === "approved") reembolsoId = await reembolsar(o.mp_payment_id);
  await atualizar(o.id, {
    status: o.mp_payment_id ? "recusada" : "cancelada",
    motivo_recusa: motivo || null,
    reembolso_id: reembolsoId,
    publicar_em: null,
  });
}

/** Clique no link rastreado; devolve o destino ou null. */
export async function registrarClique(codigo: string): Promise<{ whatsapp: string; empresa: string; titulo: string } | null> {
  if (!/^[a-z0-9]{4,12}$/.test(codigo)) return null;
  const { data } = await db().rpc("ads_registrar_clique", { p_codigo: codigo });
  const row = Array.isArray(data) ? data[0] : null;
  return row ?? null;
}
