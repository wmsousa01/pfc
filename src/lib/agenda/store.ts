import "server-only";
import { randomBytes } from "crypto";
import { site } from "@/lib/config";
import { isQuadroId, type QuadroId } from "@/lib/producao/quadros";
import { db } from "@/lib/producao/store";

export { db };

/** Brasília não tem mais horário de verão: o fuso é sempre -03:00. */
export const TZ = "America/Sao_Paulo";
const OFFSET = "-03:00";

export type EpisodioStatus = "solicitado" | "confirmado" | "realizado" | "cancelado";
export type IgStatus = "nenhum" | "agendado" | "publicando" | "publicado" | "erro";
export type IgFormato = "feed" | "story";

export type Briefing = {
  /** Quem é o convidado, em poucas linhas, para o apresentador. */
  resumo: string;
  /** Blocos da conversa, cada um com as perguntas. */
  pauta: { bloco: string; perguntas: string[] }[];
  /** O que evitar ou tratar com cuidado. */
  cuidados: string;
  titulo_live: string;
  descricao_yt: string;
  legenda_ig: string;
  /**
   * Headline da arte de divulgação (mesmo formato das thumbs), a linha de
   * tópicos ("DISCIPLINA • TREINAMENTO • SEGURANÇA PÚBLICA"), uma frase de
   * apoio opcional e o cenário temático que a IA desenha atrás das pessoas.
   */
  arte: { l1: string; l2: string; l3?: string; topicos?: string; sub?: string; cena?: string };
};

export type Slot = {
  id: number;
  quadro: string;
  weekday: number;
  hora: string;
  duracao_min: number;
  antecedencia_dias: number;
  janela_dias: number;
  ativo: boolean;
};

export type Bloqueio = { id: number; data: string; quadro: string | null; motivo: string | null };

export type Episodio = {
  id: string;
  quadro: string;
  inicio: string;
  duracao_min: number;
  status: EpisodioStatus;
  tema: string | null;
  briefing: Briefing | null;
  observacoes: string | null;
  arte_id: string | null;
  gcal_event_id: string | null;
  yt_broadcast_id: string | null;
  ig_formatos: IgFormato[];
  ig_legenda: string | null;
  ig_collab: boolean;
  ig_publicar_em: string | null;
  ig_status: IgStatus;
  ig_posts: { formato: IgFormato; id: string; url: string | null }[];
  ig_erro: string | null;
  /** null = todos os apresentadores ativos do quadro. */
  apresentadores: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IgPerfil = {
  username: string;
  name: string | null;
  biography: string | null;
  followers: number | null;
  picture: string | null;
  /** A Meta só mostra perfil Business/Creator; pessoal volta com este erro. */
  erro?: string;
};

export type Convidado = {
  id: string;
  episodio_id: string;
  token: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  instagram: string | null;
  bio: string | null;
  temas: string | null;
  divulgar: string | null;
  links: string | null;
  /** Como aparece na arte, embaixo do nome ("EMPRESÁRIO"). */
  cargo: string | null;
  foto_path: string | null;
  ig_perfil: IgPerfil | null;
  briefing_em: string | null;
  created_at: string;
  updated_at: string;
};

export type Arte = {
  id: string;
  episodio_id: string;
  feed_path: string;
  story_path: string;
  thumb_path: string;
  l1: string;
  l2: string;
  l3: string | null;
  modo: ArteModo;
  created_by: string | null;
  created_at: string;
};

/** "ia": o Gemini compõe a cena com as fotos reais. "recorte": foto recortada + texto, rosto 100% fiel. */
export type ArteModo = "ia" | "recorte";

export type Apresentador = {
  id: string;
  quadro: string;
  nome: string;
  papel: string;
  foto_path: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
};

export type MaterialTipo = "foto" | "apresentador" | "logo" | "referencia" | "outro";

export const MATERIAL_TIPOS: Record<MaterialTipo, string> = {
  foto: "Foto do convidado",
  apresentador: "Foto do apresentador",
  logo: "Logo",
  referencia: "Referência para a arte",
  outro: "Outro material",
};

export type Material = {
  id: string;
  episodio_id: string;
  convidado_id: string | null;
  apresentador_id: string | null;
  tipo: MaterialTipo;
  path: string;
  nome: string;
  mime: string;
  tamanho: number;
  usar_na_arte: boolean;
  enviado_por: string;
  created_at: string;
};

export type SemanaArte = { id: string; semana: string; path: string; created_by: string | null; created_at: string };

export type Semana = {
  semana: string;
  arte_id: string | null;
  ig_legenda: string | null;
  ig_collab: boolean;
  ig_publicar_em: string | null;
  ig_status: IgStatus;
  ig_post_url: string | null;
  ig_erro: string | null;
  updated_at: string;
};

export type Evento = {
  id: number;
  episodio_id: string;
  actor: string;
  action: string;
  detail: string | null;
  created_at: string;
};

export const CONVIDADO = "convidado";

export const newToken = () => randomBytes(18).toString("base64url");

/** "@Fulano.Silva " ou a URL do perfil → "fulano.silva". */
export function cleanInstagram(v: string): string | null {
  const s = v
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .split(/[/?#\s]/)[0]
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(s) ? s : null;
}

/** Data e hora de Brasília ("2026-11-05", "19:00") → instante. */
export function brt(date: string, hora: string): Date {
  return new Date(`${date}T${hora}:00${OFFSET}`);
}

/** Instante → "2026-11-05" no calendário de Brasília. */
export function brtDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-CA", { timeZone: TZ });
}

/** Dia da semana (0 = domingo) no calendário de Brasília. */
function brtWeekday(date: string): number {
  return new Date(`${date}T12:00:00${OFFSET}`).getUTCDay();
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return brtDate(d);
}

export const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** A segunda-feira da semana da data ("2026-11-05" → "2026-11-02"). */
export function segundaDe(date: string): string {
  return addDays(date, -((brtWeekday(date) + 6) % 7));
}

/** "quinta, 06/11 às 19h" */
export function quandoLongo(iso: string): string {
  const d = new Date(iso);
  const wd = WEEKDAYS[brtWeekday(brtDate(d))];
  const dia = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const [h, m] = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":");
  return `${wd}, ${dia} às ${h}h${m === "00" ? "" : m}`;
}

export async function listSlots(quadro?: QuadroId): Promise<Slot[]> {
  let q = db().from("agenda_slots").select("*").order("weekday").order("hora");
  if (quadro) q = q.eq("quadro", quadro);
  const { data } = await q;
  return (data ?? []) as Slot[];
}

/** Quadros que aceitam auto-agendamento (têm horário fixo ativo). */
export async function quadrosAbertos(): Promise<QuadroId[]> {
  const slots = (await listSlots()).filter((s) => s.ativo);
  return Array.from(new Set(slots.map((s) => s.quadro))).filter(isQuadroId);
}

export type Vaga = { inicio: string; duracao_min: number };

/**
 * Horários livres do quadro: as datas dos horários fixos dentro da janela,
 * tirando bloqueios e o que já tem episódio (pedido ou confirmado).
 */
export async function vagasLivres(quadro: QuadroId): Promise<Vaga[]> {
  const slots = (await listSlots(quadro)).filter((s) => s.ativo);
  if (slots.length === 0) return [];
  const hoje = brtDate(new Date());
  const ate = addDays(hoje, Math.max(...slots.map((s) => s.janela_dias)));

  const [{ data: bloq }, { data: ocupados }] = await Promise.all([
    db().from("agenda_bloqueios").select("data, quadro").gte("data", hoje).lte("data", ate),
    db()
      .from("agenda_episodios")
      .select("inicio")
      .eq("quadro", quadro)
      .neq("status", "cancelado")
      .gte("inicio", new Date().toISOString()),
  ]);
  const bloqueado = new Set(
    (bloq ?? []).filter((b) => !b.quadro || b.quadro === quadro).map((b) => b.data as string)
  );
  const ocupado = new Set((ocupados ?? []).map((o) => new Date(o.inicio as string).getTime()));

  const out: Vaga[] = [];
  for (const s of slots) {
    for (let i = s.antecedencia_dias; i <= s.janela_dias; i++) {
      const date = addDays(hoje, i);
      if (brtWeekday(date) !== s.weekday || bloqueado.has(date)) continue;
      const inicio = brt(date, s.hora);
      if (ocupado.has(inicio.getTime())) continue;
      out.push({ inicio: inicio.toISOString(), duracao_min: s.duracao_min });
    }
  }
  return out.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export async function getEpisodio(id: string): Promise<Episodio | null> {
  const { data } = await db().from("agenda_episodios").select("*").eq("id", id).maybeSingle();
  return (data as Episodio) ?? null;
}

export async function updateEpisodio(id: string, patch: Partial<Episodio>) {
  const { error } = await db()
    .from("agenda_episodios")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function convidadosDe(episodioId: string): Promise<Convidado[]> {
  const { data } = await db()
    .from("agenda_convidados")
    .select("*")
    .eq("episodio_id", episodioId)
    .order("created_at");
  return (data ?? []) as Convidado[];
}

export async function convidadoPorToken(token: string): Promise<Convidado | null> {
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(token)) return null;
  const { data } = await db().from("agenda_convidados").select("*").eq("token", token).maybeSingle();
  return (data as Convidado) ?? null;
}

export async function updateConvidado(id: string, patch: Partial<Convidado>) {
  const { error } = await db()
    .from("agenda_convidados")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getArte(id: string): Promise<Arte | null> {
  const { data } = await db().from("agenda_artes").select("*").eq("id", id).maybeSingle();
  return (data as Arte) ?? null;
}

export async function apresentadoresDo(quadro: string, soAtivos = true): Promise<Apresentador[]> {
  let q = db().from("agenda_apresentadores").select("*").eq("quadro", quadro).order("ordem").order("created_at");
  if (soAtivos) q = q.eq("ativo", true);
  const { data } = await q;
  return (data ?? []) as Apresentador[];
}

/** Os apresentadores do episódio: os escolhidos nele ou, sem escolha, todos os ativos do quadro. */
export async function apresentadoresDoEpisodio(ep: Episodio): Promise<Apresentador[]> {
  const todos = await apresentadoresDo(ep.quadro, false);
  if (ep.apresentadores) return todos.filter((a) => ep.apresentadores!.includes(a.id));
  return todos.filter((a) => a.ativo);
}

export async function materiaisDe(episodioId: string): Promise<Material[]> {
  const { data } = await db().from("agenda_materiais").select("*").eq("episodio_id", episodioId).order("created_at");
  return (data ?? []) as Material[];
}

export async function logAgenda(episodioId: string, actor: string, action: string, detail?: string) {
  await db().from("agenda_eventos").insert({ episodio_id: episodioId, actor, action, detail: detail ?? null });
}

export const linkConvidado = (token: string) => `${site.url}/convidado/b/${token}`;
