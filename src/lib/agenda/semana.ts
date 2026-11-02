import "server-only";
import { randomUUID } from "crypto";
import { isGeminiConfigured } from "@/lib/producao/gemini";
import { themeOf } from "@/lib/producao/quadros";
import { LOGO_PATH, download, signedUrls, upload } from "@/lib/producao/store";
import { MetaError, igContainerStatus, igCreateImage, igPublish } from "@/lib/social/meta";
import { activeConnection, revokeConnection } from "@/lib/social/store";
import { logoDoQuadro, pessoasDaArte } from "./arte";
import { chamada, diaCompleto, gerarCenaSemana, type CardSemana } from "./cena";
import { imagemDe } from "./materiais";
import {
  addDays,
  apresentadoresDoEpisodio,
  db,
  getArte,
  materiaisDe,
  quandoLongo,
  type Convidado,
  type Episodio,
  type Semana,
  type SemanaArte,
} from "./store";

/**
 * Agenda da semana: uma arte 3:4 com todos os episódios confirmados de
 * segunda a domingo, um card por episódio, no padrão da arte que a equipe
 * fazia à mão. A referência de cada card é a arte aprovada do episódio.
 */

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type ItemSemana = { ep: Episodio; convidados: Convidado[] };

export async function episodiosDaSemana(segunda: string): Promise<ItemSemana[]> {
  const de = new Date(`${segunda}T00:00:00-03:00`).toISOString();
  const ate = new Date(`${addDays(segunda, 7)}T00:00:00-03:00`).toISOString();
  const { data } = await db()
    .from("agenda_episodios")
    .select("*")
    .in("status", ["confirmado", "realizado"])
    .gte("inicio", de)
    .lt("inicio", ate)
    .order("inicio");
  const eps = (data ?? []) as Episodio[];
  if (eps.length === 0) return [];
  const { data: cs } = await db().from("agenda_convidados").select("*").in("episodio_id", eps.map((e) => e.id)).order("created_at");
  const convidados = (cs ?? []) as Convidado[];
  return eps.map((ep) => ({ ep, convidados: convidados.filter((c) => c.episodio_id === ep.id) }));
}

export async function getSemana(segunda: string): Promise<Semana | null> {
  const { data } = await db().from("agenda_semanas").select("*").eq("semana", segunda).maybeSingle();
  return (data as Semana) ?? null;
}

async function upsertSemana(segunda: string, patch: Partial<Semana>) {
  const { error } = await db()
    .from("agenda_semanas")
    .upsert({ semana: segunda, ...patch, updated_at: new Date().toISOString() }, { onConflict: "semana" });
  if (error) throw new Error(error.message);
}

/** Legenda pronta: uma linha por episódio, na ordem. */
export function legendaSemana(itens: ItemSemana[]): string {
  const linhas = itens.map(({ ep, convidados }) => {
    const t = themeOf(ep.quadro);
    const com = convidados.length ? ` com ${convidados.map((c) => (c.instagram ? `@${c.instagram}` : c.nome)).join(" e ")}` : "";
    const tema = ep.briefing?.arte ? ` — ${[ep.briefing.arte.l1, ep.briefing.arte.l2, ep.briefing.arte.l3].filter(Boolean).join(" ").toLowerCase()}` : ep.tema ? ` — ${ep.tema}` : "";
    return `📍 ${quandoLongo(ep.inicio)}: ${t.name}${com}${tema}`;
  });
  return `A agenda da semana no PFC 🎙️\n\n${linhas.join("\n")}\n\nTudo ao vivo no YouTube, link na bio.\n\n#ForaDaCaixa #PFC #MogiGuaçu`;
}

export async function gerarArteSemana(segunda: string, primeiroHoje: boolean, actor: string): Promise<SemanaArte> {
  if (!isGeminiConfigured()) throw new Error("A agenda da semana precisa do Gemini (GOOGLE_AI_API_KEY).");
  const itens = await episodiosDaSemana(segunda);
  if (itens.length === 0) throw new Error("Nenhum episódio confirmado nesta semana.");

  const cards: CardSemana[] = [];
  for (const { ep, convidados } of itens) {
    const t = themeOf(ep.quadro);
    const arte = ep.arte_id ? await getArte(ep.arte_id) : null;
    const arteImg = arte ? await imagemDe(arte.feed_path) : null;
    const hosts = await apresentadoresDoEpisodio(ep);
    // Sem arte aprovada, as fotos e o logo do quadro entram direto.
    const pessoas = arteImg ? [] : await pessoasDaArte(ep, convidados, await materiaisDe(ep.id));
    const logo = arteImg ? null : await logoDoQuadro(ep.quadro);
    const a = ep.briefing?.arte;
    cards.push({
      quadro: t,
      inicio: ep.inicio,
      arte: arteImg,
      pessoas,
      gravado: !!ep.video_drive_id,
      logo: logo ? { buf: logo, mime: "image/png" } : null,
      convidados: convidados.map((c) => ({ nome: c.nome, papel: c.cargo || "" })),
      apresentadores: hosts.map((h) => h.nome),
      headline: a?.l1 ? { l1: a.l1, l2: a.l2, ...(a.l3 ? { l3: a.l3 } : {}) } : { l1: (ep.tema ?? t.name).toUpperCase(), l2: "" },
      topicos: a?.topicos ?? null,
    });
  }
  const logoPfc = await download(LOGO_PATH);
  const jpeg = await gerarCenaSemana(cards, logoPfc ? { buf: logoPfc, mime: "image/png" } : null, primeiroHoje);

  const id = randomUUID();
  const path = `agenda/semanas/${segunda}/${id}.jpg`;
  await upload(path, jpeg, "image/jpeg");
  const { data, error } = await db()
    .from("agenda_semana_artes")
    .insert({ id, semana: segunda, path, created_by: actor })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  // A primeira versão já fica escolhida, como nos episódios.
  const s = await getSemana(segunda);
  if (!s?.arte_id) await upsertSemana(segunda, { arte_id: id, ig_legenda: s?.ig_legenda ?? legendaSemana(itens) });
  return data as SemanaArte;
}

export async function escolherArteSemana(segunda: string, arteId: string): Promise<void> {
  await upsertSemana(segunda, { arte_id: arteId });
}

export async function programarSemana(
  segunda: string,
  opts: { legenda: string; collab: boolean; quando: Date | null }
): Promise<void> {
  const s = await getSemana(segunda);
  if (!s?.arte_id) throw new Error("Gere a arte da semana primeiro.");
  if (!(await activeConnection("instagram"))) throw new Error("Instagram não conectado (/admin/marketing).");
  await upsertSemana(segunda, {
    ig_legenda: opts.legenda,
    ig_collab: opts.collab,
    ig_publicar_em: (opts.quando ?? new Date()).toISOString(),
    ig_status: "agendado",
    ig_erro: null,
  });
  if (!opts.quando) await publicarSemana(segunda);
}

export async function liberarSemana(segunda: string): Promise<void> {
  const s = await getSemana(segunda);
  if (!s || s.ig_status === "publicando") return;
  await upsertSemana(segunda, { ig_status: "nenhum", ig_publicar_em: null, ig_erro: null });
}

/** Publica no feed; o collab convida até 3 convidados da semana (limite da Meta). */
async function publicarSemana(segunda: string): Promise<void> {
  const { data: claimed } = await db()
    .from("agenda_semanas")
    .update({ ig_status: "publicando", updated_at: new Date().toISOString() })
    .eq("semana", segunda)
    .eq("ig_status", "agendado")
    .select("*")
    .maybeSingle();
  if (!claimed) return;
  const s = claimed as Semana;
  const conn = await activeConnection("instagram");
  try {
    if (!conn) throw new Error("Instagram não conectado (/admin/marketing).");
    const { data: arte } = await db().from("agenda_semana_artes").select("*").eq("id", s.arte_id).maybeSingle();
    if (!arte) throw new Error("Arte da semana não encontrada.");
    const url = (await signedUrls([arte.path])).get(arte.path);
    if (!url) throw new Error("Não consegui assinar a URL da arte.");
    const itens = s.ig_collab ? await episodiosDaSemana(segunda) : [];
    const collaborators = Array.from(
      new Set(itens.flatMap((i) => i.convidados.map((c) => c.instagram)).filter((v): v is string => !!v))
    ).slice(0, 3);
    const container = await igCreateImage(conn.accountId, conn.token, url, { story: false, caption: s.ig_legenda ?? "", collaborators });
    for (let i = 0; i < 6; i++) {
      const st = await igContainerStatus(container, conn.token);
      if (st.code === "FINISHED") break;
      if (st.code === "ERROR" || st.code === "EXPIRED") throw new Error(`Instagram recusou a arte: ${st.detail ?? st.code}`);
      await sleep(5_000);
    }
    const r = await igPublish(conn.accountId, conn.token, container);
    await upsertSemana(segunda, { ig_status: "publicado", ig_post_url: r.url, ig_erro: null });
  } catch (e) {
    if (e instanceof MetaError && e.tokenDead && conn) await revokeConnection(conn.id);
    await upsertSemana(segunda, { ig_status: "erro", ig_erro: msg(e) });
  }
}

/** Fila do cron: agendas da semana programadas que venceram. */
export async function runSemanaQueue(): Promise<number> {
  const { data } = await db()
    .from("agenda_semanas")
    .select("semana")
    .eq("ig_status", "agendado")
    .lte("ig_publicar_em", new Date().toISOString())
    .limit(2);
  for (const d of data ?? []) await publicarSemana(d.semana);
  return (data ?? []).length;
}

/** Resumo de cada card para a página: o que vai escrito na arte. */
export function resumoCard(ep: Episodio, convidados: Convidado[]) {
  const t = themeOf(ep.quadro);
  const c = chamada(ep.inicio, false);
  return { quadro: t, dia: diaCompleto(ep.inicio), data: c.dia.split(" • ")[1], hora: c.hora, convidados: convidados.map((x) => x.nome) };
}
