"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/producao/actions";
import { requireAdmin } from "@/lib/auth";
import { pautaDeTexto } from "@/lib/agenda/briefing";
import {
  YT_STREAM_KEY,
  adicionarConvidado,
  aprovarArte,
  atualizarPerfilIg,
  cancelar,
  confirmar,
  criarEpisodio,
  gerarArtesPara,
  gerarBriefingPara,
  programarInstagram,
  remarcar,
  salvarFoto,
  sincronizarAgenda,
  sincronizarLive,
} from "@/lib/agenda/fluxo";
import { disconnectCalendar } from "@/lib/agenda/gcal";
import {
  brt,
  cleanInstagram,
  db,
  getEpisodio,
  logAgenda,
  updateEpisodio,
  type Briefing,
  type IgFormato,
} from "@/lib/agenda/store";
import { normalizeWhatsapp } from "@/lib/lead-triage";
import { isQuadroId } from "@/lib/producao/quadros";
import { clearConfig, setConfig } from "@/lib/producao/store";

const PATH = "/admin/agenda";
const refresh = () => revalidatePath(PATH, "layout");

function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
const opt = (form: FormData, key: string) => str(form, key) || null;

function actorOf(role: { email: string | null; userId: string }): string {
  return role.email ?? role.userId;
}

function fail(e: unknown): ActionState {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

const ok: ActionState = { ok: true, error: null };

/** Roda a ação e já devolve o estado do formulário. */
async function run(fn: (actor: string) => Promise<unknown>): Promise<ActionState> {
  const role = await requireAdmin();
  try {
    await fn(actorOf(role));
    refresh();
    return ok;
  } catch (e) {
    refresh();
    return fail(e);
  }
}

/** Convidado cadastrado pela equipe: só o nome é obrigatório, o resto ele completa no link. */
function convidadoDe(form: FormData) {
  const nome = str(form, "nome").slice(0, 120);
  if (!nome) throw new Error("Diga o nome do convidado.");
  const ig = opt(form, "instagram");
  const instagram = ig ? cleanInstagram(ig) : null;
  if (ig && !instagram) throw new Error("@ do Instagram inválido.");
  const wa = opt(form, "whatsapp");
  return {
    nome,
    instagram,
    whatsapp: wa ? normalizeWhatsapp(wa) : null,
    email: opt(form, "email")?.toLowerCase() ?? null,
    bio: opt(form, "bio"),
    temas: opt(form, "temas"),
    divulgar: null,
    links: null,
  };
}

/** "2026-11-05" + "19:00" do formulário, no horário de Brasília. */
function inicioDe(form: FormData): Date {
  const data = str(form, "data");
  const hora = str(form, "hora");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || !/^\d{2}:\d{2}$/.test(hora)) throw new Error("Data ou hora inválida.");
  return brt(data, hora);
}

// ---- Episódio ----

export async function novoEpisodioAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const role = await requireAdmin();
  let id: string;
  try {
    const quadro = str(form, "quadro");
    if (!isQuadroId(quadro)) throw new Error("Escolha o quadro.");
    const inicio = inicioDe(form);
    const c = await criarEpisodio(
      { quadro, inicio: inicio.toISOString(), duracao_min: Number(str(form, "duracao")) || 90, tema: opt(form, "tema") },
      convidadoDe(form),
      actorOf(role)
    );
    id = c.episodio_id;
    await atualizarPerfilIg(c).catch(() => null);
    await sincronizarAgenda(id, actorOf(role));
  } catch (e) {
    return fail(e);
  }
  refresh();
  redirect(`${PATH}/${id}`);
}

export async function confirmarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => confirmar(str(form, "id"), a));
}

export async function cancelarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => cancelar(str(form, "id"), a, opt(form, "motivo")));
}

export async function realizadoAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const id = str(form, "id");
  await updateEpisodio(id, { status: "realizado" });
  await logAgenda(id, actorOf(role), "marcou como realizado");
  refresh();
}

export async function remarcarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => remarcar(str(form, "id"), inicioDe(form), Number(str(form, "duracao")) || 90, a));
}

export async function observacoesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => updateEpisodio(str(form, "id"), { observacoes: opt(form, "observacoes"), tema: opt(form, "tema") }));
}

// ---- Convidados ----

export async function addConvidadoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async (a) => {
    const id = str(form, "id");
    const c = await adicionarConvidado(id, convidadoDe(form));
    await logAgenda(id, a, "adicionou convidado", c.nome);
    await atualizarPerfilIg(c).catch(() => null);
    await sincronizarAgenda(id, a);
  });
}

export async function removerConvidadoAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const { data } = await db().from("agenda_convidados").delete().eq("id", str(form, "convidado")).select("episodio_id, nome").maybeSingle();
  if (data) {
    await logAgenda(data.episodio_id, actorOf(role), "removeu convidado", data.nome);
    await sincronizarAgenda(data.episodio_id, actorOf(role));
  }
  refresh();
}

export async function perfilIgAction(form: FormData): Promise<void> {
  await requireAdmin();
  const { data } = await db().from("agenda_convidados").select("*").eq("id", str(form, "convidado")).maybeSingle();
  if (data) await atualizarPerfilIg(data);
  refresh();
}

export async function fotoConvidadoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const f = form.get("foto");
    if (!(f instanceof File) || f.size === 0) throw new Error("Escolha a foto.");
    await salvarFoto(str(form, "convidado"), f);
  });
}

// ---- Briefing ----

export async function gerarBriefingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => gerarBriefingPara(str(form, "id"), a));
}

export async function salvarBriefingAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async (a) => {
    const id = str(form, "id");
    const up = (k: string) => str(form, k).toUpperCase().slice(0, 40);
    const b: Briefing = {
      resumo: str(form, "resumo"),
      pauta: pautaDeTexto(str(form, "pauta")),
      cuidados: str(form, "cuidados"),
      titulo_live: str(form, "titulo_live").slice(0, 100),
      descricao_yt: str(form, "descricao_yt"),
      legenda_ig: str(form, "legenda_ig"),
      arte: { l1: up("l1"), l2: up("l2"), ...(up("l3") ? { l3: up("l3") } : {}) },
    };
    await updateEpisodio(id, { briefing: b, ig_legenda: b.legenda_ig });
    await logAgenda(id, a, "editou o briefing");
  });
}

// ---- Arte ----

export async function gerarArteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const up = (k: string) => str(form, k).toUpperCase().slice(0, 40);
  const [l1, l2, l3] = [up("l1"), up("l2"), up("l3")];
  return run((a) => gerarArtesPara(str(form, "id"), a, l1 && l2 ? { l1, l2, ...(l3 ? { l3 } : {}) } : null));
}

export async function aprovarArteAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  await aprovarArte(str(form, "id"), str(form, "arte"), actorOf(role)).catch(() => null);
  refresh();
}

// ---- Divulgação e live ----

export async function liveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => sincronizarLive(str(form, "id"), a));
}

export async function instagramAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async (a) => {
    const formatos = form.getAll("formato").map(String).filter((f): f is IgFormato => f === "feed" || f === "story");
    const when = str(form, "quando");
    let quando: Date | null = null;
    if (when) {
      quando = new Date(`${when}:00-03:00`);
      if (Number.isNaN(quando.getTime())) throw new Error("Data inválida.");
      if (quando.getTime() < Date.now()) quando = null;
    }
    await programarInstagram(str(form, "id"), { formatos, legenda: str(form, "legenda"), collab: form.get("collab") === "1", quando }, a);
  });
}

/** Cancela o post programado, ou libera para programar de novo depois de um erro. */
export async function instagramResetAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  const id = str(form, "id");
  const ep = await getEpisodio(id);
  if (!ep || ep.ig_status === "publicando") return;
  await updateEpisodio(id, { ig_status: "nenhum", ig_publicar_em: null, ig_erro: null });
  await logAgenda(id, actorOf(role), "cancelou o post do Instagram");
  refresh();
}

// ---- Configuração ----

export async function slotAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const quadro = str(form, "quadro");
    if (!isQuadroId(quadro)) throw new Error("Escolha o quadro.");
    const hora = str(form, "hora");
    if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error("Hora inválida.");
    const num = (k: string, d: number) => Math.max(0, Number(str(form, k)) || d);
    const { error } = await db()
      .from("agenda_slots")
      .upsert(
        {
          quadro,
          weekday: Number(str(form, "weekday")),
          hora,
          duracao_min: num("duracao", 90),
          antecedencia_dias: num("antecedencia", 2),
          janela_dias: num("janela", 42),
          ativo: true,
        },
        { onConflict: "quadro,weekday,hora" }
      );
    if (error) throw new Error(error.message);
  });
}

export async function slotToggleAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db().from("agenda_slots").update({ ativo: str(form, "ativo") === "1" }).eq("id", Number(str(form, "slot")));
  refresh();
}

export async function slotRemoverAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db().from("agenda_slots").delete().eq("id", Number(str(form, "slot")));
  refresh();
}

export async function bloqueioAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const data = str(form, "data");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida.");
    const quadro = str(form, "quadro");
    const { error } = await db()
      .from("agenda_bloqueios")
      .insert({ data, quadro: isQuadroId(quadro) ? quadro : null, motivo: opt(form, "motivo") });
    if (error) throw new Error(error.message);
  });
}

export async function bloqueioRemoverAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db().from("agenda_bloqueios").delete().eq("id", Number(str(form, "bloqueio")));
  refresh();
}

export async function gcalConfigAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const cal = str(form, "calendar");
    if (cal) await setConfig("gcal_calendar_id", cal);
    else await clearConfig("gcal_calendar_id");
    await setConfig("agenda_equipe", str(form, "equipe"));
  });
}

export async function gcalDisconnectAction(): Promise<void> {
  await requireAdmin();
  await disconnectCalendar();
  refresh();
}

export async function streamAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const id = str(form, "stream");
    if (id) await setConfig(YT_STREAM_KEY, id);
    else await clearConfig(YT_STREAM_KEY);
  });
}

export async function agendaSyncAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => sincronizarAgenda(str(form, "id"), a));
}
