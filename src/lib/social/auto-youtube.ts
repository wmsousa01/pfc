import "server-only";
import { listJobCuts, isContentaConfigured, type ContentaCut } from "@/lib/producao/contenta";
import { TEXT_MODEL, generate, isGeminiConfigured } from "@/lib/producao/gemini";
import { refreshCuttingLives, type ProducaoLive } from "@/lib/producao/lives";
import { db, getConfig, setConfig } from "@/lib/producao/store";
import { defaultCaption, instagramCaption } from "./caption";
import { IG_MAX_SEGUNDOS, IG_TESTES_POR_DIA, RITMO } from "./ritmo";
import type { Platform } from "./store";

/**
 * Publicação automática dos Shorts no YouTube (16/11/2026).
 *
 * Quando o job de shorts de uma live termina no Contenta, o Gemini ranqueia os
 * cortes pelo que performa no canal e os AUTO_POR_LIVE melhores entram na fila
 * do YouTube, nos próximos horários livres (HORARIOS, em Brasília). O resto
 * fica no Contenta para quem quiser programar à mão em /admin/marketing.
 *
 * Live que já tem qualquer post de YouTube do job de shorts é pulada: a equipe
 * programou à mão, ou a automação já passou por ela.
 *
 * Instagram automático (17/11/2026): os mesmos cortes, na mesma ordem da IA,
 * saem como Reel de teste (a Meta promove sozinha os que forem bem, meta.ts)
 * nos HORARIOS_IG. Só cortes verticais de até IG_MAX_SEGUNDOS. O Reel do
 * perfil continua à mão. Pausa e marco inicial próprios (ig_auto_*).
 */

/** Chave em producao_config: "1" pausa a automação. */
export const YT_AUTO_PAUSA = "yt_auto_pausado";
/** Primeira rodada: lives encerradas antes disso não entram (não posta o arquivo). */
const YT_AUTO_DESDE = "yt_auto_desde";
/** Última rodada, para rodar no máximo a cada INTERVALO_MS (a fila roda a cada 5 min). */
const YT_AUTO_ULTIMA = "yt_auto_ultima";
const INTERVALO_MS = 30 * 60_000;

/** Quantos shorts de cada live vão para o YouTube. 5 lives × 5 ≈ 25 por semana, dentro de 4/dia. */
export const AUTO_POR_LIVE = 5;
/**
 * Horários de Brasília, um por vaga do dia (RITMO.youtube.porDia). Três horas
 * entre eles, todos dentro da janela 10h–22h, com até 40 min de folga aleatória.
 */
export const HORARIOS = [10, 13, 16, 19].slice(0, RITMO.youtube.porDia);
const FOLGA_MS = 40 * 60_000;

const BRT_MS = 3 * 3_600_000;
const DIA = 86_400_000;
const meiaNoiteBrt = (t: number) => Math.floor((t - BRT_MS) / DIA) * DIA + BRT_MS;

/** Shorts de verdade: o YouTube só trata como Short até 3 min. */
const isShort = (c: ContentaCut) => c.durationSec == null || (c.durationSec >= 8 && c.durationSec <= 180);

export async function isYoutubeAutoPaused(): Promise<boolean> {
  return (await getConfig(YT_AUTO_PAUSA)) === "1";
}

/** Chave em producao_config: "1" pausa o Instagram automático. */
export const IG_AUTO_PAUSA = "ig_auto_pausado";
/** Lives disparadas antes disso não vão para o Instagram automático. */
const IG_AUTO_DESDE = "ig_auto_desde";
/** Horários dos Reels de teste: uma hora depois de cada Short, um por vaga de teste do dia. */
export const HORARIOS_IG = [11, 14, 17, 20].slice(0, IG_TESTES_POR_DIA);

export async function isInstagramAutoPaused(): Promise<boolean> {
  return (await getConfig(IG_AUTO_PAUSA)) === "1";
}

/** Reel do Instagram: só vertical e até IG_MAX_SEGUNDOS (16:9 deu 0 views). */
const serveInstagram = (c: ContentaCut, outputFormat: string | null) =>
  outputFormat !== "landscape" && isShort(c) && (c.durationSec == null || c.durationSec <= IG_MAX_SEGUNDOS);

/**
 * Ordena os cortes do melhor para o pior, pelo que a auditoria do canal
 * mostrou que performa. Sem Gemini, ou se ele falhar, fica a ordem do Contenta.
 */
async function ranquear(cuts: ContentaCut[], liveTitle: string): Promise<ContentaCut[]> {
  if (!isGeminiConfigured() || cuts.length <= 1) return cuts;
  const lista = cuts
    .map((c, i) => `${i}. [${c.durationSec ?? "?"}s] ${c.title ?? "(sem título)"} — ${(c.description ?? "").slice(0, 300)}`)
    .join("\n");
  const prompt = `Você escolhe quais cortes do podcast "Papo Fora da Caixa" (Mogi Guaçu, SP) vão para o YouTube Shorts.
Episódio: ${liveTitle}

O que o Analytics do canal mostra (90 dias até 14/11/2026):
- viralizam: futebol, nostalgia dos anos 80/90, humor e memes, situações locais com humor, frase forte ou polêmica de quem fala, comportamento e emoção (filhos, medo, dinheiro)
- performam mal: explicação técnica, assunto institucional de empresa, conselho genérico, corte que só faz sentido com o contexto do episódio
- o público é nacional, 25–44 anos, maioria homens: o corte precisa se sustentar sozinho para quem nunca viu o programa

Cortes:
${lista}

Ordene TODOS os cortes do mais para o menos promissor como Short. Responda só com os índices.`;
  try {
    const json = await generate(TEXT_MODEL, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: { ordem: { type: "ARRAY", items: { type: "INTEGER" } } },
          required: ["ordem"],
        },
      },
    });
    const { ordem } = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as { ordem?: number[] };
    const vistos = new Set<number>();
    const out: ContentaCut[] = [];
    for (const i of ordem ?? []) {
      if (Number.isInteger(i) && cuts[i] && !vistos.has(i)) {
        vistos.add(i);
        out.push(cuts[i]);
      }
    }
    // O que o modelo esqueceu vai para o fim, na ordem do Contenta.
    cuts.forEach((c, i) => !vistos.has(i) && out.push(c));
    return out;
  } catch (e) {
    console.warn("[yt-auto] ranking:", e);
    return cuts;
  }
}

/** Os próximos `n` horários livres da rede a partir de agora. */
async function proximosHorarios(platform: Platform, horarios: number[], n: number): Promise<Date[]> {
  const agora = Date.now();
  const { data } = await db()
    .from("social_posts")
    .select("scheduled_at")
    .eq("platform", platform)
    .in("status", ["agendado", "publicando", "processando", "publicado"])
    .gte("scheduled_at", new Date(agora - DIA).toISOString());
  const ocupados = (data ?? []).map((r) => Date.parse(r.scheduled_at as string));
  const out: Date[] = [];
  const minimo = agora + 15 * 60_000;
  for (let d = 0; d < 60 && out.length < n; d++) {
    const dia = meiaNoiteBrt(agora) + d * DIA;
    for (const h of horarios) {
      const t = dia + h * 3_600_000;
      if (t < minimo) continue;
      // Vaga tomada por post já agendado perto dela (à mão ou rodada anterior).
      if (ocupados.some((o) => Math.abs(o - t) < 90 * 60_000)) continue;
      out.push(new Date(t + Math.floor(Math.random() * FOLGA_MS)));
      if (out.length >= n) break;
    }
  }
  return out;
}

type Rede = {
  platform: "youtube" | "instagram";
  /** Marco inicial (ISO): lives disparadas antes dele não entram. */
  desde: string;
  horarios: number[];
  serve: (c: ContentaCut, outputFormat: string | null) => boolean;
  caption: (c: ContentaCut) => string;
  trial: boolean;
};

export type AutoYoutubeResult =
  | { live: string; agendados: Partial<Record<Rede["platform"], number>>; ranking: string[] }
  | string;

/** Marco inicial da rede, gravado na primeira rodada para não postar o arquivo. */
async function desdeDe(chave: string, agora: number): Promise<string> {
  const v = await getConfig(chave);
  if (v) return v;
  const novo = new Date(agora).toISOString();
  await setConfig(chave, novo);
  return novo;
}

/**
 * Uma rodada: agenda no máximo uma live (o ranking custa uma chamada ao
 * Gemini), no YouTube e no Instagram, cada rede com a sua pausa.
 */
export async function runYoutubeAuto(): Promise<AutoYoutubeResult> {
  if (!isContentaConfigured()) return "sem Contenta";
  const [ytPausado, igPausado] = await Promise.all([isYoutubeAutoPaused(), isInstagramAutoPaused()]);
  if (ytPausado && igPausado) return "pausado";

  const agora = Date.now();
  const ultima = await getConfig(YT_AUTO_ULTIMA);
  if (ultima && agora - Date.parse(ultima) < INTERVALO_MS) return "aguardando";
  await setConfig(YT_AUTO_ULTIMA, new Date(agora).toISOString());

  const redes: Rede[] = [];
  if (!ytPausado) {
    redes.push({
      platform: "youtube",
      desde: await desdeDe(YT_AUTO_DESDE, agora),
      horarios: HORARIOS,
      serve: isShort,
      caption: defaultCaption,
      trial: false,
    });
  }
  if (!igPausado) {
    redes.push({
      platform: "instagram",
      desde: await desdeDe(IG_AUTO_DESDE, agora),
      horarios: HORARIOS_IG,
      serve: serveInstagram,
      caption: instagramCaption,
      trial: true,
    });
  }
  const desde = redes.map((r) => r.desde).sort()[0];

  // Sem isso, um job pronto no Contenta só vira "done" quando alguém abre o painel.
  await refreshCuttingLives().catch((e) => console.warn("[auto] refresh:", e));

  const { data } = await db()
    .from("producao_lives")
    .select("*")
    .neq("status", "ignorada")
    .gte("triggered_at", desde)
    .order("triggered_at", { ascending: true })
    .limit(20);
  const lives = (data ?? []) as ProducaoLive[];

  for (const live of lives) {
    const job = live.jobs.find((j) => j.mode === "shorts" && j.status === "done");
    if (!job) continue;
    const disparada = Date.parse(live.triggered_at ?? live.created_at);

    // Redes sem nenhum post desse job: quem já tem foi programado à mão ou por rodada anterior.
    const pendentes: Rede[] = [];
    for (const r of redes) {
      if (disparada < Date.parse(r.desde)) continue;
      const { count } = await db()
        .from("social_posts")
        .select("id", { count: "exact", head: true })
        .eq("platform", r.platform)
        .eq("contenta_job_id", job.jobId);
      if ((count ?? 0) === 0) pendentes.push(r);
    }
    if (pendentes.length === 0) continue;

    const { items, outputFormat } = await listJobCuts(job.jobId);
    const cuts = items.filter((c) => pendentes.some((r) => r.serve(c, outputFormat)));
    if (cuts.length === 0) continue;
    const ranking = await ranquear(cuts, live.title);

    const agendados: Partial<Record<Rede["platform"], number>> = {};
    for (const r of pendentes) {
      const escolhidos = ranking.filter((c) => r.serve(c, outputFormat)).slice(0, AUTO_POR_LIVE);
      const horarios = await proximosHorarios(r.platform, r.horarios, escolhidos.length);
      let n = 0;
      for (let i = 0; i < escolhidos.length; i++) {
        const cut = escolhidos[i];
        const at = horarios[i];
        if (!at) break;
        const { error } = await db().from("social_posts").insert({
          platform: r.platform,
          contenta_job_id: job.jobId,
          cut_file: cut.file,
          video_url: cut.url,
          thumb_url: cut.thumbUrl,
          // O publicador reescreve o título do YouTube se vier na fórmula "Tema: o X" (youtube-meta.ts).
          title: (cut.title || cut.file).slice(0, 100),
          caption: r.caption(cut),
          scheduled_at: at.toISOString(),
          created_by: "automático",
          trial: r.trial,
          collaborators: [],
        });
        if (!error) n++;
        else if (error.code !== "23505") throw new Error(error.message);
      }
      agendados[r.platform] = n;
    }
    return { live: live.title, agendados, ranking: ranking.slice(0, AUTO_POR_LIVE).map((c) => c.title ?? c.file) };
  }
  return "nada novo";
}
