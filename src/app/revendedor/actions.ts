"use server";

import { revalidatePath } from "next/cache";
import { requireReseller } from "@/lib/auth";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { quadros } from "@/lib/config";
import type { ActionState } from "@/app/admin/producao/actions";

const str = (fd: FormData, k: string, max = 120) => String(fd.get(k) ?? "").trim().slice(0, max);

/**
 * O parceiro registra uma indicação de patrocínio ANTES do contato (regra 1
 * do programa). Grava pelo service role depois de conferir a sessão: a RLS só
 * deixa o parceiro ler as próprias, não escrever.
 */
export async function registrarIndicacao(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { reseller } = await requireReseller();

  const empresa = str(fd, "empresa");
  const contato = str(fd, "contato", 80);
  const digits = str(fd, "whatsapp", 30).replace(/\D/g, "");
  const interesse = str(fd, "interesse", 300);
  const quadroSlug = str(fd, "quadro", 60);
  const papelRaw = str(fd, "papel", 20);
  const papel = ["indicou", "vendeu", "patrocina"].includes(papelRaw) ? papelRaw : "indicou";
  const observacao = str(fd, "observacao", 600) || null;

  if (!empresa) return { ok: false, error: "Diga o nome da empresa." };
  if (papel !== "patrocina" && (digits.length < 10 || digits.length > 13)) {
    return { ok: false, error: "Informe o WhatsApp do contato com DDD." };
  }
  if (papel === "patrocina" && !reseller.apresentador) {
    return { ok: false, error: "A condição de patrocínio com desconto é para apresentadores. Fale com a equipe." };
  }
  const quadro = quadros.some((q) => q.slug === quadroSlug) ? quadroSlug : null;

  const admin = createAdminSupabase();
  if (!admin) return { ok: false, error: "Não foi possível registrar agora. Tente de novo em instantes." };

  // Regras 3 e 4: contato que já está com o PFC (lead nos últimos 90 dias) ou
  // protegido por outro parceiro não entra. Avisar na hora poupa a viagem.
  if (digits) {
    const desde = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const [{ data: lead }, { data: outra }] = await Promise.all([
      admin.from("leads").select("id").eq("whatsapp", digits).gte("created_at", desde).limit(1).maybeSingle(),
      admin
        .from("indicacoes")
        .select("id, reseller_id")
        .eq("whatsapp", digits)
        .in("status", ["registrada", "aprovada", "reuniao", "fechada"])
        .limit(1)
        .maybeSingle(),
    ]);
    if (outra && (outra as { reseller_id: string }).reseller_id === reseller.id) {
      return { ok: false, error: "Você já registrou esse contato. Acompanhe na lista abaixo." };
    }
    if (outra || lead) {
      return {
        ok: false,
        error: "Esse contato já está em conversa com o PFC (ou com outro parceiro). Fale com a equipe se achar que é engano.",
      };
    }
  }

  const { error } = await admin.from("indicacoes").insert({
    reseller_id: reseller.id,
    empresa,
    contato: contato || null,
    whatsapp: digits || null,
    interesse: interesse || null,
    quadro,
    papel,
    origem: "registro",
    observacao,
  });
  if (error) return { ok: false, error: "Não foi possível registrar agora. Tente de novo em instantes." };

  revalidatePath("/revendedor");
  revalidatePath("/admin/revendedores/indicacoes");
  return { ok: true, error: null };
}
