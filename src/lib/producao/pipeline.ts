import "server-only";
import { randomUUID } from "crypto";
import { composeThumb, prepareLogo, preparePeople } from "./compose";
import { IMAGE_MODEL, pickBestFrame, renderPlate, suggestHeadlines } from "./gemini";
import { matte } from "./matte";
import { detectQuadro } from "./playlists";
import { platePrompt } from "./prompt";
import { isQuadroId, quadroLogoPath, themeOf } from "./quadros";
import {
  LOGO_PATH,
  db,
  download,
  getConfig,
  getVideo,
  headlineText,
  logEvent,
  updateVideo,
  upload,
  type Headline,
  type ProducaoThumb,
  type ProducaoVideo,
} from "./store";
import { fetchTranscript, listRecentUploads, publishVideo, setThumbnail } from "./youtube-api";

export const AUTOMACAO = "automação";

/**
 * Short não leva thumb 16:9 — o feed de Shorts nem mostra. Só entram na
 * fila os cortes acima de 3 minutos (limite atual de duração de um Short).
 */
const MIN_DURATION_SEC = 181;
/** Um "gerando" mais velho que isso morreu no meio (timeout da função). */
const STALE_MS = 10 * 60_000;

/**
 * Lê os uploads recentes do canal: corte privado novo entra na fila, e o que
 * já foi aprovado e ficou público no YouTube vira "publicada".
 */
export async function syncChannel(actor: string): Promise<{ novos: number; publicados: number }> {
  const videos = await listRecentUploads(50);
  const { data: known } = await db()
    .from("producao_videos")
    .select("id, youtube_id, status")
    .in("youtube_id", videos.map((v) => v.id));
  const byYt = new Map((known ?? []).map((k) => [k.youtube_id as string, k]));

  let novos = 0;
  let publicados = 0;
  for (const v of videos) {
    // Live (em andamento ou já encerrada) não é corte: segue por syncLives().
    if (v.liveEndedAt || v.liveState !== "none") continue;
    const row = byYt.get(v.id);
    if (!row) {
      if (v.privacy === "public" || v.durationSec < MIN_DURATION_SEC) continue;
      const { data, error } = await db()
        .from("producao_videos")
        .insert({
          youtube_id: v.id,
          title: v.title,
          duration_sec: v.durationSec,
          privacy: v.privacy,
          yt_thumb_url: v.thumbUrl,
          uploaded_at: v.uploadedAt,
        })
        .select("id")
        .single();
      if (error || !data) continue;
      novos++;
      await logEvent(data.id, actor, "entrou na fila", `${v.privacy} no YouTube`);
      continue;
    }
    await db()
      .from("producao_videos")
      .update({ privacy: v.privacy, title: v.title, yt_thumb_url: v.thumbUrl })
      .eq("id", row.id);
    if (row.status === "aprovada" && v.privacy === "public") {
      await updateVideo(row.id, { status: "publicada" });
      await logEvent(row.id, AUTOMACAO, "publicado", "o vídeo ficou público no YouTube");
      publicados++;
    }
  }
  return { novos, publicados };
}

/** Marca "gerando" só se ninguém mais estiver gerando — cron e botão não duplicam. */
async function claim(id: string): Promise<boolean> {
  const stale = new Date(Date.now() - STALE_MS).toISOString();
  const { data } = await db()
    .from("producao_videos")
    .update({ status: "gerando", error: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .or(`status.in.(novo,revisar,erro),and(status.eq.gerando,updated_at.lt.${stale})`)
    .select("id");
  return (data?.length ?? 0) > 0;
}

/**
 * Frame de onde saem as pessoas. O enviado à mão manda. Senão, entre a
 * miniatura automática e os três frames que o próprio YouTube extrai do
 * vídeo (maxres1..3, em 1280×720), o Gemini escolhe o de rosto de frente e
 * olhos abertos — a miniatura padrão costuma pegar olho fechado e perfil.
 */
async function chooseFrame(v: ProducaoVideo): Promise<{ frame: Buffer; note: string }> {
  if (v.frame_path) {
    const f = await download(v.frame_path);
    if (f) return { frame: f, note: "frame enviado à mão" };
  }
  const urls = [
    v.yt_thumb_url,
    ...[1, 2, 3].map((n) => `https://i.ytimg.com/vi/${v.youtube_id}/maxres${n}.jpg`),
  ].filter((u): u is string => !!u);
  const got = await Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u, { cache: "no-store" }).catch(() => null);
      return res?.ok ? Buffer.from(await res.arrayBuffer()) : null;
    })
  );
  const frames = got.filter((f): f is NonNullable<typeof f> => !!f);
  if (frames.length === 0) {
    throw new Error("Sem frame: as miniaturas do YouTube não abriram. Envie um frame do corte no cartão.");
  }
  const pick = await pickBestFrame(frames).catch(() => ({ index: 0, reason: "" }));
  return {
    frame: frames[pick.index],
    note: `frame ${pick.index + 1} de ${frames.length}${pick.reason ? ` (${pick.reason})` : ""}`,
  };
}

/**
 * Gera thumbs para um corte. Sem `headline`, pede headlines ao Gemini a
 * partir da legenda e faz uma imagem por headline (até `count`).
 */
export async function generateFor(
  videoId: string,
  actor: string,
  opts: { headline?: Headline; count?: number } = {}
): Promise<void> {
  if (!(await claim(videoId))) return;
  const v = await getVideo(videoId);
  if (!v) return;

  try {
    let transcript = v.transcript;
    if (!transcript) {
      transcript = await fetchTranscript(v.youtube_id).catch(() => null);
      if (transcript) await updateVideo(v.id, { transcript });
    }

    let headlines: Headline[];
    if (opts.headline) {
      headlines = [opts.headline];
    } else {
      const s = await suggestHeadlines(v.title, transcript, 3);
      headlines = s.options.slice(0, opts.count ?? 2);
      await updateVideo(v.id, { headline_options: s.options });
    }

    // Identidade do quadro: descoberto pela live de origem uma vez; a equipe pode trocar no cartão.
    let quadro = isQuadroId(v.quadro) ? v.quadro : null;
    if (!quadro) {
      quadro = await detectQuadro(v.title).catch(() => null);
      if (quadro) await updateVideo(v.id, { quadro });
    }
    const theme = themeOf(quadro);

    // Fundo no Gemini em paralelo com a escolha do frame e o recorte.
    const [{ frame, note }, plate, logoRaw] = await Promise.all([
      chooseFrame(v),
      getConfig("plate_prompt").then((p) => renderPlate(platePrompt(p, theme))),
      download(quadroLogoPath(theme.id)).then((l) => l ?? download(LOGO_PATH)),
    ]);
    const [people, logo] = await Promise.all([
      matte(frame).then((m) => preparePeople(m, theme.rim)),
      logoRaw ? prepareLogo(logoRaw) : Promise.resolve(null),
    ]);

    const made = await Promise.allSettled(
      headlines.map(async (h) => {
        const jpeg = await composeThumb(plate, people, logo, h, theme);
        const path = `thumbs/${v.id}/${randomUUID()}.jpg`;
        await upload(path, jpeg, "image/jpeg");
        await db().from("producao_thumbs").insert({
          video_id: v.id,
          storage_path: path,
          l1: h.l1,
          l2: h.l2,
          // Só manda a coluna quando há 3ª linha: thumb de duas linhas segue igual.
          ...(h.l3 ? { l3: h.l3 } : {}),
          model: `composição + ${IMAGE_MODEL}`,
          created_by: actor === AUTOMACAO ? null : actor,
        });
      })
    );
    const ok = made.filter((m) => m.status === "fulfilled").length;
    if (ok === 0) {
      const err = made.find((m) => m.status === "rejected") as PromiseRejectedResult;
      throw err.reason;
    }
    await updateVideo(v.id, { status: "revisar" });
    await logEvent(
      v.id,
      actor,
      "gerou thumbs",
      `${ok} opção(ões) · ${theme.name}${quadro ? "" : " (quadro não identificado)"} · ${note}${transcript ? "" : " · sem legenda, headline só pelo título"}`
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateVideo(v.id, { status: "erro", error: msg.slice(0, 500) });
    await logEvent(v.id, actor, "erro ao gerar", msg.slice(0, 300));
  }
}

/** Sobe a thumb aprovada e publica agora ou agenda. */
export async function approveThumb(thumbId: string, actor: string, publishAt: Date | null): Promise<void> {
  const { data } = await db().from("producao_thumbs").select("*").eq("id", thumbId).maybeSingle();
  const thumb = data as ProducaoThumb | null;
  if (!thumb) throw new Error("Thumb não encontrada.");
  const v = await getVideo(thumb.video_id);
  if (!v) throw new Error("Vídeo não encontrado.");

  try {
    const jpeg = await download(thumb.storage_path);
    if (!jpeg) throw new Error("Arquivo da thumb sumiu do Storage.");
    await setThumbnail(v.youtube_id, jpeg);
    await publishVideo(v.youtube_id, publishAt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await updateVideo(v.id, { error: msg.slice(0, 500) });
    await logEvent(v.id, actor, "erro ao aprovar", msg.slice(0, 300));
    throw e;
  }

  await updateVideo(v.id, {
    status: publishAt ? "aprovada" : "publicada",
    error: null,
    approved_thumb_id: thumb.id,
    approved_by: actor,
    approved_at: new Date().toISOString(),
    publish_at: publishAt?.toISOString() ?? null,
  });
  await logEvent(
    v.id,
    actor,
    publishAt ? "aprovou e agendou" : "aprovou e publicou",
    `${headlineText(thumb)}${publishAt ? ` — ${publishAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}`
  );
}

/** Rodada da automação: sincroniza e gera thumbs para os mais antigos da fila. */
export async function runQueue(limit = 2) {
  const sync = await syncChannel(AUTOMACAO);
  const { data } = await db()
    .from("producao_videos")
    .select("id")
    .eq("status", "novo")
    .order("uploaded_at", { ascending: true })
    .limit(limit);
  for (const row of data ?? []) await generateFor(row.id, AUTOMACAO);
  return { ...sync, gerados: data?.length ?? 0 };
}
