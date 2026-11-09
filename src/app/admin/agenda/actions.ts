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
  salvarFotoApresentador,
  sincronizarAgenda,
  sincronizarLive,
} from "@/lib/agenda/fluxo";
import { abrirEspelho } from "@/lib/agenda/espelho";
import { adicionarExtra, removerExtra } from "@/lib/agenda/extras";
import { decidir } from "@/lib/agenda/sugestoes";
import { importarRoteiro, tirarRoteiro } from "@/lib/agenda/roteiro";
import { disconnectCalendar } from "@/lib/agenda/gcal";
import { pedirUpload, registrarMaterial, removerMaterial } from "@/lib/agenda/materiais";
import { FONTES_KEY, gerarPautaNews } from "@/lib/agenda/noticias";
import { SITES_KEY } from "@/lib/agenda/sites";
import { escolherArteSemana, gerarArteSemana, liberarSemana, programarSemana } from "@/lib/agenda/semana";
import { PASTA_KEY, atualizarVideo, enviarVideo, liberarEnvio, ligarVideo, tirarFrames } from "@/lib/agenda/video";
import {
  brt,
  cleanInstagram,
  db,
  getEpisodio,
  logAgenda,
  MATERIAL_TIPOS,
  segundaDe,
  updateConvidado,
  updateEpisodio,
  type Briefing,
  type IgFormato,
  type MaterialTipo,
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
    cargo: opt(form, "cargo")?.toUpperCase().slice(0, 60) ?? null,
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
    // Sem nome, o episódio sai sem convidado (PFC News: só o apresentador e o tema).
    const dados = str(form, "nome") ? convidadoDe(form) : null;
    if (!dados && !opt(form, "tema")) throw new Error("Sem convidado, escreva o tema da semana.");
    const r = await criarEpisodio(
      { quadro, inicio: inicio.toISOString(), duracao_min: Number(str(form, "duracao")) || 90, tema: opt(form, "tema") },
      dados,
      actorOf(role)
    );
    id = r.episodioId;
    if (r.convidado) await atualizarPerfilIg(r.convidado).catch(() => null);
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

export async function cargoConvidadoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => updateConvidado(str(form, "convidado"), { cargo: opt(form, "cargo")?.toUpperCase().slice(0, 60) ?? null }));
}

/** Quais apresentadores do quadro entram neste episódio (nenhum marcado = todos). */
export async function apresentadoresEpisodioAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async (a) => {
    const id = str(form, "id");
    const ids = form.getAll("apresentador").map(String).filter(Boolean);
    await updateEpisodio(id, { apresentadores: ids.length ? ids : null });
    await logAgenda(id, a, "escolheu os apresentadores");
  });
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
    // As notícias do PFC News não têm campo no formulário: ficam como estavam.
    const antes = (await getEpisodio(id))?.briefing;
    const b: Briefing = {
      ...(antes?.noticias ? { noticias: antes.noticias } : {}),
      resumo: str(form, "resumo"),
      pauta: pautaDeTexto(str(form, "pauta")),
      cuidados: str(form, "cuidados"),
      titulo_live: str(form, "titulo_live").slice(0, 100),
      descricao_yt: str(form, "descricao_yt"),
      legenda_ig: str(form, "legenda_ig"),
      arte: {
        l1: up("l1"),
        l2: up("l2"),
        ...(up("l3") ? { l3: up("l3") } : {}),
        ...(str(form, "topicos") ? { topicos: str(form, "topicos").toUpperCase().slice(0, 120) } : {}),
        ...(str(form, "sub") ? { sub: str(form, "sub").toUpperCase().slice(0, 120) } : {}),
        ...(str(form, "cena") ? { cena: str(form, "cena").slice(0, 500) } : {}),
      },
    };
    await updateEpisodio(id, { briefing: b, ig_legenda: b.legenda_ig });
    await logAgenda(id, a, "editou o briefing");
  });
}

// ---- Arte ----

export async function gerarArteAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const up = (k: string) => str(form, k).toUpperCase().slice(0, 40);
  const [l1, l2, l3] = [up("l1"), up("l2"), up("l3")];
  const modo = str(form, "modo") === "recorte" ? "recorte" : "ia";
  const hoje = form.get("hoje") === "1";
  return run((a) => gerarArtesPara(str(form, "id"), a, l1 && l2 ? { l1, l2, ...(l3 ? { l3 } : {}) } : null, { modo, hoje }));
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

/**
 * Horário avulso: o quadro grava numa data fora do fixo. Com "no lugar de",
 * é mudança de dia: a data original fica bloqueada para o quadro, desde que
 * ninguém esteja marcado nela (senão o convidado ficaria sem aviso).
 */
export async function avulsoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const quadro = str(form, "quadro");
    if (!isQuadroId(quadro)) throw new Error("Escolha o quadro.");
    const data = str(form, "data");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error("Data inválida.");
    const hora = str(form, "hora");
    if (!/^\d{2}:\d{2}$/.test(hora)) throw new Error("Hora inválida.");
    if (brt(data, hora).getTime() <= Date.now()) throw new Error("Esse horário já passou.");
    const original = str(form, "original");
    if (original && !/^\d{4}-\d{2}-\d{2}$/.test(original)) throw new Error("Data original inválida.");
    if (original === data) throw new Error("A data original é a mesma do avulso.");
    const motivo = opt(form, "motivo");
    const fmt = (d: string) => d.split("-").reverse().slice(0, 2).join("/");

    let bloqueioId: number | null = null;
    if (original) {
      const { data: marcados } = await db()
        .from("agenda_episodios")
        .select("id, inicio")
        .eq("quadro", quadro)
        .neq("status", "cancelado")
        .gte("inicio", brt(original, "00:00").toISOString())
        .lt("inicio", brt(original, "23:59").toISOString());
      if (marcados?.length) {
        throw new Error(
          `Já tem episódio marcado em ${fmt(original)}. Remarque ou cancele o episódio antes de mudar o dia.`
        );
      }
      const { data: bl, error } = await db()
        .from("agenda_bloqueios")
        .insert({ data: original, quadro, motivo: `mudou para ${fmt(data)}${motivo ? ` · ${motivo}` : ""}` })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      bloqueioId = bl.id as number;
    }

    const { error } = await db()
      .from("agenda_avulsos")
      .insert({
        quadro,
        data,
        hora,
        duracao_min: Math.max(15, Number(str(form, "duracao")) || 90),
        motivo,
        bloqueio_id: bloqueioId,
      });
    if (error) {
      if (bloqueioId) await db().from("agenda_bloqueios").delete().eq("id", bloqueioId);
      throw new Error(error.code === "23505" ? "Esse horário avulso já existe." : error.message);
    }
  });
}

/** Remove o avulso e, se era mudança de dia, libera a data original. */
export async function avulsoRemoverAction(form: FormData): Promise<void> {
  await requireAdmin();
  const id = Number(str(form, "avulso"));
  const { data: av } = await db().from("agenda_avulsos").select("bloqueio_id").eq("id", id).maybeSingle();
  await db().from("agenda_avulsos").delete().eq("id", id);
  if (av?.bloqueio_id) await db().from("agenda_bloqueios").delete().eq("id", av.bloqueio_id);
  refresh();
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

// ---- Materiais do episódio ----

type Upload = { ok: true; path: string; token: string } | { ok: false; error: string };

export async function pedirUploadAction(episodioId: string, nome: string, mime: string, tamanho: number): Promise<Upload> {
  await requireAdmin();
  try {
    return { ok: true, ...(await pedirUpload(episodioId, nome, mime, tamanho)) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** `alvo`: "c:<id>" (convidado) ou "a:<id>" (apresentador), quem aparece no arquivo. */
export async function registrarMaterialAction(
  episodioId: string,
  path: string,
  nome: string,
  mime: string,
  tipo: string,
  alvo: string | null,
  bloco: number | null = null
): Promise<ActionState> {
  const [k, id] = (alvo ?? "").split(":");
  return run((a) =>
    registrarMaterial({
      episodio_id: episodioId,
      convidado_id: k === "c" ? id : null,
      apresentador_id: k === "a" && tipo === "apresentador" ? id : null,
      tipo: tipo in MATERIAL_TIPOS ? (tipo as MaterialTipo) : "outro",
      path,
      nome,
      mime,
      enviado_por: a,
      bloco: bloco != null && Number.isInteger(bloco) && bloco >= 0 ? bloco : null,
    })
  );
}

export async function materialAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const tipo = str(form, "tipo");
    if (!(tipo in MATERIAL_TIPOS)) throw new Error("Tipo inválido.");
    const { error } = await db()
      .from("agenda_materiais")
      .update({
        tipo,
        usar_na_arte: form.get("usar") === "1",
        apresentador_id: tipo === "apresentador" ? opt(form, "apresentador") : null,
        convidado_id: opt(form, "convidado"),
        bloco: str(form, "bloco") === "" ? null : Math.max(0, Math.trunc(Number(str(form, "bloco"))) || 0),
      })
      .eq("id", str(form, "material"));
    if (error) throw new Error(error.message);
  });
}

export async function materialRemoverAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  await removerMaterial(str(form, "material"), actorOf(role));
  refresh();
}

// ---- Apresentadores ----

export async function apresentadorAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const quadro = str(form, "quadro");
    if (!isQuadroId(quadro)) throw new Error("Escolha o quadro.");
    const nome = str(form, "nome").slice(0, 80);
    if (!nome) throw new Error("Diga o nome.");
    const { data, error } = await db()
      .from("agenda_apresentadores")
      .insert({ quadro, nome, papel: (opt(form, "papel") ?? "APRESENTADOR").toUpperCase().slice(0, 60) })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const f = form.get("foto");
    if (f instanceof File && f.size > 0) await salvarFotoApresentador(data.id, f);
  });
}

export async function apresentadorEditarAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const id = str(form, "apresentador");
    const nome = str(form, "nome").slice(0, 80);
    if (!nome) throw new Error("Diga o nome.");
    const { error } = await db()
      .from("agenda_apresentadores")
      .update({ nome, papel: (opt(form, "papel") ?? "APRESENTADOR").toUpperCase().slice(0, 60) })
      .eq("id", id);
    if (error) throw new Error(error.message);
    const f = form.get("foto");
    if (f instanceof File && f.size > 0) await salvarFotoApresentador(id, f);
  });
}

export async function apresentadorToggleAction(form: FormData): Promise<void> {
  await requireAdmin();
  await db().from("agenda_apresentadores").update({ ativo: str(form, "ativo") === "1" }).eq("id", str(form, "apresentador"));
  refresh();
}

export async function apresentadorRemoverAction(form: FormData): Promise<void> {
  await requireAdmin();
  const { data } = await db().from("agenda_apresentadores").delete().eq("id", str(form, "apresentador")).select("foto_path").maybeSingle();
  if (data?.foto_path) await db().storage.from("producao").remove([data.foto_path]);
  refresh();
}

// ---- Agenda da semana ----

function semanaDe(form: FormData): string {
  const s = str(form, "semana");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Semana inválida.");
  return segundaDe(s);
}

export async function gerarSemanaAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => gerarArteSemana(semanaDe(form), form.get("hoje") === "1", a));
}

export async function escolherSemanaAction(form: FormData): Promise<void> {
  await requireAdmin();
  await escolherArteSemana(semanaDe(form), str(form, "arte"));
  refresh();
}

export async function semanaInstagramAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const when = str(form, "quando");
    let quando: Date | null = null;
    if (when) {
      quando = new Date(`${when}:00-03:00`);
      if (Number.isNaN(quando.getTime())) throw new Error("Data inválida.");
      if (quando.getTime() < Date.now()) quando = null;
    }
    await programarSemana(semanaDe(form), { legenda: str(form, "legenda"), collab: form.get("collab") === "1", quando });
  });
}

export async function semanaResetAction(form: FormData): Promise<void> {
  await requireAdmin();
  await liberarSemana(semanaDe(form));
  refresh();
}

// ---- Episódio gravado (Drive → YouTube) ----

export async function ligarVideoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // O select da pasta manda "id|nome"; o campo livre, o link.
  const escolha = str(form, "arquivo");
  const [idDaPasta, ...nome] = escolha.split("|");
  const link = str(form, "link") || idDaPasta;
  return run((a) => ligarVideo(str(form, "id"), link, nome.join("|") || null, a));
}

export async function framesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => tirarFrames(str(form, "id"), a));
}

export async function enviarVideoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  // A primeira leva vai aqui mesmo; o resto, no cron de 5 em 5 minutos.
  return run((a) => enviarVideo(str(form, "id"), a, 200_000));
}

export async function atualizarVideoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => atualizarVideo(str(form, "id"), a));
}

export async function liberarEnvioAction(form: FormData): Promise<void> {
  await requireAdmin();
  await liberarEnvio(str(form, "id"));
  refresh();
}

export async function pastaDriveAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const v = str(form, "pasta");
    const m = /folders\/([A-Za-z0-9_-]+)/.exec(v);
    const id = m?.[1] ?? (/^[A-Za-z0-9_-]{20,}$/.test(v) ? v : null);
    if (!id) throw new Error("Link da pasta inválido.");
    await setConfig(PASTA_KEY, id);
  });
}

// ---- Espelho da transmissão ----

export async function espelhoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => abrirEspelho(str(form, "id"), a, form.get("trocar") === "1"));
}

/** O roteiro do apresentador: um PDF dos materiais (`material`) ou o texto colado (`texto`). */
export async function importarRoteiroAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const material = str(form, "material");
  return run((a) => importarRoteiro(str(form, "id"), material ? { materialId: material } : { texto: str(form, "texto") }, a));
}

export async function tirarRoteiroAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  await tirarRoteiro(str(form, "id"), actorOf(role));
  refresh();
}

/** Notícia de outra fonte no roteiro: link, nome da fonte para o GC, texto colado e a posição. */
export async function extraAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const posicao = str(form, "posicao");
  return run((a) =>
    adicionarExtra(
      str(form, "id"),
      { url: opt(form, "url"), fonte: opt(form, "fonte"), texto: opt(form, "texto"), posicao: posicao === "" ? null : Number(posicao) },
      a
    )
  );
}

/** Aceita (aplica no roteiro) ou recusa uma sugestão da revisão. */
export async function sugestaoAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run((a) => decidir(str(form, "sugestao"), form.get("aceitar") === "1", a));
}

export async function removerExtraAction(form: FormData): Promise<void> {
  const role = await requireAdmin();
  await removerExtra(str(form, "id"), Number(str(form, "indice")), actorOf(role));
  refresh();
}

// ---- PFC News: pauta com as notícias da semana no Instagram ----

export async function pautaNewsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const dias = Math.min(14, Math.max(1, Number(str(form, "dias")) || 7));
  return run((a) => gerarPautaNews(str(form, "id"), dias, a));
}

export async function fontesNewsAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return run(async () => {
    const handles = str(form, "fontes")
      .split(/[\s,]+/)
      .map((h) => cleanInstagram(h))
      .filter((h): h is string => !!h);
    if (handles.length === 0) throw new Error("Coloque pelo menos um @.");
    await setConfig(FONTES_KEY, handles.join(" "));
    const sites = str(form, "sites")
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((u) => (/^https?:\/\//.test(u) ? u : `https://${u}`));
    await setConfig(SITES_KEY, sites.join(" "));
  });
}
