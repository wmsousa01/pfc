import "server-only";
import { listJobCuts, isContentaConfigured, type ContentaCut } from "@/lib/producao/contenta";
import { TEXT_MODEL, generate, isGeminiConfigured } from "@/lib/producao/gemini";
import { refreshCuttingLives, type ProducaoLive } from "@/lib/producao/lives";
import { db, getConfig, setConfig } from "@/lib/producao/store";
import { defaultCaption } from "./caption";
import { RITMO } from "./ritmo";

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

/** Os próximos `n` horários livres do YouTube a partir de agora. */
async function proximosHorarios(n: number): Promise<Date[]> {
  const agora = Date.now();
  const { data } = await db()
    .from("social_posts")
    .select("scheduled_at")
    .eq("platform", "youtube")
    .in("status", ["agendado", "publicando", "processando", "publicado"])
    .gte("scheduled_at", new Date(agora - DIA).toISOString());
  const ocupados = (data ?? []).map((r) => Date.parse(r.scheduled_at as string));
  const out: Date[] = [];
  const minimo = agora + 15 * 60_000;
  for (let d = 0; d < 60 && out.length < n; d++) {
    const dia = meiaNoiteBrt(agora) + d * DIA;
    for (const h of HORARIOS) {
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

export type AutoYoutubeResult = { live: string; agendados: number; ranking: string[] } | string;

/** Uma rodada: agenda no máximo uma live (o ranking custa uma chamada ao Gemini). */
export async function runYoutubeAuto(): Promise<AutoYoutubeResult> {
  if (!isContentaConfigured()) return "sem Contenta";
  if (await isYoutubeAutoPaused()) return "pausado";

  const agora = Date.now();
  const ultima = await getConfig(YT_AUTO_ULTIMA);
  if (ultima && agora - Date.parse(ultima) < INTERVALO_MS) return "aguardando";
  await setConfig(YT_AUTO_ULTIMA, new Date(agora).toISOString());

  let desde = await getConfig(YT_AUTO_DESDE);
  if (!desde) {
    desde = new Date(agora).toISOString();
    await setConfig(YT_AUTO_DESDE, desde);
  }

  // Sem isso, um job pronto no Contenta só vira "done" quando alguém abre o painel.
  await refreshCuttingLives().catch((e) => console.warn("[yt-auto] refresh:", e));

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
    const { count } = await db()
      .from("social_posts")
      .select("id", { count: "exact", head: true })
      .eq("platform", "youtube")
      .eq("contenta_job_id", job.jobId);
    if ((count ?? 0) > 0) continue;

    const cuts = (await listJobCuts(job.jobId)).items.filter(isShort);
    if (cuts.length === 0) continue;
    const escolhidos = (await ranquear(cuts, live.title)).slice(0, AUTO_POR_LIVE);
    const horarios = await proximosHorarios(escolhidos.length);

    let agendados = 0;
    for (let i = 0; i < escolhidos.length; i++) {
      const cut = escolhidos[i];
      const at = horarios[i];
      if (!at) break;
      const { error } = await db().from("social_posts").insert({
        platform: "youtube",
        contenta_job_id: job.jobId,
        cut_file: cut.file,
        video_url: cut.url,
        thumb_url: cut.thumbUrl,
        // O publicador reescreve o título se vier na fórmula "Tema: o X" (youtube-meta.ts).
        title: (cut.title || cut.file).slice(0, 100),
        caption: defaultCaption(cut),
        scheduled_at: at.toISOString(),
        created_by: "automático",
        trial: false,
        collaborators: [],
      });
      if (!error) agendados++;
      else if (error.code !== "23505") throw new Error(error.message);
    }
    return { live: live.title, agendados, ranking: escolhidos.map((c) => c.title ?? c.file) };
  }
  return "nada novo";
}
