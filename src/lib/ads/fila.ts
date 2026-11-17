import "server-only";
import { MetaError, igContainerStatus, igCreateImage, igPublish } from "@/lib/social/meta";
import { activeConnection, revokeConnection } from "@/lib/social/store";
import { urlAssinada } from "./arte";
import { atualizar, db, type Oferta } from "./store";

/**
 * Fila dos stories das ofertas aprovadas. Roda no cron do social (a cada
 * 5 min). Uma oferta por rodada: story é leve, mas a Meta limita as
 * publicações por dia e a fila orgânica divide o mesmo limite.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 500);

/** Marca "publicando" só se ainda estiver aprovada: cron e botão não publicam duas vezes. */
async function claim(id: string): Promise<boolean> {
  const { data } = await db()
    .from("ads_ofertas")
    .update({ status: "publicando", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "aprovada")
    .select("id");
  return !!data && data.length > 0;
}

export async function publicarStory(o: Oferta): Promise<void> {
  if (!(await claim(o.id))) return;
  const conn = await activeConnection("instagram");
  try {
    if (!conn) throw new Error("Instagram não conectado (Marketing → Contas).");
    const url = await urlAssinada(o.arte_path);
    if (!url) throw new Error("Arte da oferta não encontrada.");
    const container = await igCreateImage(conn.accountId, conn.token, url, { story: true });
    for (let i = 0; i < 6; i++) {
      const st = await igContainerStatus(container, conn.token);
      if (st.code === "FINISHED") break;
      if (st.code === "ERROR" || st.code === "EXPIRED") throw new Error(`Instagram recusou a arte: ${st.detail ?? st.code}`);
      await sleep(4_000);
    }
    const r = await igPublish(conn.accountId, conn.token, container);
    await atualizar(o.id, { status: "publicada", publicada_em: new Date().toISOString(), post_id: r.id, erro: null });
  } catch (err) {
    if (err instanceof MetaError && err.tokenDead && conn) await revokeConnection(conn.id);
    await atualizar(o.id, { status: "erro", erro: msg(err) });
  }
}

export async function runAdsQueue(now = Date.now()): Promise<string | null> {
  const { data } = await db()
    .from("ads_ofertas")
    .select("*")
    .eq("status", "aprovada")
    .lte("publicar_em", new Date(now).toISOString())
    .order("publicar_em", { ascending: true })
    .limit(1);
  const o = (data as Oferta[] | null)?.[0];
  if (!o) return null;
  await publicarStory(o);
  return `story ${o.codigo}`;
}
