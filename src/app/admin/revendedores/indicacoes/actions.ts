"use server";

import { revalidatePath } from "next/cache";
import { exigir } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CAMPANHA } from "@/lib/campanha";
import { PROTECAO_DIAS, comissaoCents, type Ciclo, type IndicacaoPapel, type IndicacaoStatus } from "@/lib/indicacoes";
import { toCents } from "@/lib/money";
import type { ActionState } from "@/app/admin/producao/actions";

const STATUS: IndicacaoStatus[] = ["registrada", "aprovada", "reuniao", "fechada", "perdida", "rejeitada"];
const PAPEIS: IndicacaoPapel[] = ["indicou", "vendeu", "patrocina"];

function refresh() {
  revalidatePath("/admin/revendedores/indicacoes");
  revalidatePath("/revendedor");
}

/**
 * Atualiza o andamento. Ao aprovar, protege por 60 dias; ao fechar, congela a
 * comissão com a regra do dia (inclusive o bônus de apresentador da campanha).
 */
export async function salvarIndicacao(_prev: ActionState, fd: FormData): Promise<ActionState> {
  await exigir("revendedores.editar");
  const supabase = createServerSupabase();
  const id = String(fd.get("id") ?? "");
  const status = String(fd.get("status") ?? "") as IndicacaoStatus;
  const papel = String(fd.get("papel") ?? "") as IndicacaoPapel;
  const ciclo: Ciclo = fd.get("ciclo") === "anual" ? "anual" : "mensal";
  const mensalCents = toCents(String(fd.get("mensal") ?? "")) || null;
  const retorno = String(fd.get("retorno") ?? "").trim().slice(0, 400) || null;
  if (!id || !STATUS.includes(status) || !PAPEIS.includes(papel)) return { ok: false, error: "Dados inválidos." };

  const { data: atual } = await supabase
    .from("indicacoes")
    .select("*, reseller:resellers(apresentador, quadro)")
    .eq("id", id)
    .maybeSingle();
  if (!atual) return { ok: false, error: "Indicação não encontrada." };

  const agora = new Date();
  const patch: Record<string, unknown> = { status, papel, ciclo, mensal_cents: mensalCents, retorno, updated_at: agora.toISOString() };

  if (["aprovada", "reuniao"].includes(status) && !atual.protegida_ate) {
    patch.protegida_ate = new Date(agora.getTime() + PROTECAO_DIAS * 86_400_000).toISOString();
  }

  if (status === "fechada") {
    if (!mensalCents && papel !== "patrocina") return { ok: false, error: "Informe a mensalidade do contrato para fechar." };
    const fechadaEm = atual.fechada_em ? new Date(atual.fechada_em) : agora;
    const naCampanha = fechadaEm.getTime() <= new Date(CAMPANHA.ate).getTime();
    const r = atual.reseller as { apresentador?: boolean; quadro?: string | null } | null;
    const c = comissaoCents({
      mensalCents: mensalCents ?? 0,
      ciclo,
      papel,
      quadroDoApresentador: !!r?.apresentador && !!r.quadro && r.quadro === atual.quadro,
      naCampanha,
    });
    patch.fechada_em = fechadaEm.toISOString();
    patch.comissao_cents = c.total;
    patch.campanha = naCampanha ? CAMPANHA.id : null;
  } else {
    patch.fechada_em = null;
    patch.comissao_cents = null;
    patch.campanha = null;
  }

  const { error } = await supabase.from("indicacoes").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true, error: null };
}

/** Marca a parcela 1 ou 2 da comissão como paga (Pix feito). */
export async function pagarParcela(fd: FormData) {
  await exigir("revendedores.editar");
  const id = String(fd.get("id") ?? "");
  const n = fd.get("parcela") === "2" ? 2 : 1;
  if (!id) return;
  await createServerSupabase()
    .from("indicacoes")
    .update({ [`parcela${n}_paga_em`]: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  refresh();
}
