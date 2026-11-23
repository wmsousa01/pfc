import "server-only";
import { randomUUID } from "crypto";
import { MetaError, graph, igContainerStatus, igCreateImage, igPublish } from "@/lib/social/meta";
import { activeConnection, connectionById, listConnections, revokeConnection, type LiveConnection } from "@/lib/social/store";
import { BUCKET, signedUrls, upload } from "@/lib/producao/store";
import { conferirEnvio, urlDeEnvio } from "@/lib/storage";
import { PASTA_ARTES, PASTA_FOTOS, type PerfilInstagram, type SlideGerado } from "./tipos";

/**
 * Guarda as artes geradas e publica no Instagram.
 *
 * As fotos e as artes ficam no armazenamento do site (área de produção): o
 * navegador envia a foto direto para lá, o servidor desenha e guarda a arte, e
 * a Meta baixa cada imagem por uma URL assinada. Nada passa de 4,5 MB pela
 * função da Vercel.
 */

const MAX_FOTO = 12 * 1024 * 1024;
const MAX_CARROSSEL = 10;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Link para o navegador enviar uma foto já tratada. */
export async function pedirEnvioFoto(): Promise<{ path: string; url: string }> {
  const path = `${PASTA_FOTOS}${randomUUID()}.jpg`;
  return { path, url: await urlDeEnvio(BUCKET, path, "image/jpeg") };
}

/** Confere que a foto chegou e não passou do limite (o que passar é apagado). */
export async function conferirFoto(path: string): Promise<void> {
  await conferirEnvio(BUCKET, path, MAX_FOTO);
}

/** Guarda as artes e devolve caminho e URL assinada de cada uma, na ordem do carrossel. */
export async function guardarArtes(artes: Buffer[]): Promise<SlideGerado[]> {
  const lote = randomUUID();
  const paths = artes.map((_, i) => `${PASTA_ARTES}${lote}/${String(i + 1).padStart(2, "0")}.jpg`);
  await Promise.all(artes.map((a, i) => upload(paths[i], a, "image/jpeg")));
  const urls = await signedUrls(paths);
  return paths.map((path) => ({ path, url: urls.get(path) ?? "" }));
}

/** Perfis do Instagram conectados: o principal e os extras (Lado A Lado B...). */
export async function perfisInstagram(): Promise<PerfilInstagram[]> {
  const contas = await listConnections().catch(() => []);
  return contas
    .filter((c) => c.platform === "instagram" && c.status === "ativa")
    .sort((a, b) => Number(b.principal) - Number(a.principal))
    .map((c) => ({ id: c.id, nome: c.account_name ?? (c.principal ? "Perfil principal" : "Perfil extra"), principal: c.principal }));
}

/** A Meta processa a imagem antes de aceitar a publicação: espera até ficar pronta. */
async function esperarPronto(container: string, token: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const st = await igContainerStatus(container, token);
    if (st.code === "FINISHED") return;
    if (st.code === "ERROR" || st.code === "EXPIRED") throw new Error(`O Instagram recusou a imagem: ${st.detail ?? st.code}`);
    await sleep(3_000);
  }
  throw new Error("O Instagram demorou demais para processar as imagens. Tente publicar de novo.");
}

export type Publicado = { url: string | null; perfil: string };

/**
 * Publica no feed (uma arte ou carrossel de até 10) ou nos Stories (cada arte
 * vira um Story, na ordem). `perfilId` null = perfil principal.
 */
export async function publicarNoInstagram(opts: { paths: string[]; legenda: string; perfilId: number | null; story: boolean }): Promise<Publicado> {
  const paths = opts.paths.filter((p) => p.startsWith(PASTA_ARTES) && !p.includes("..")).slice(0, MAX_CARROSSEL);
  if (!paths.length) throw new Error("Gere o post antes de publicar.");

  const conn: LiveConnection | null = opts.perfilId ? await connectionById(opts.perfilId) : await activeConnection("instagram");
  if (!conn) throw new Error("Instagram não conectado. Conecte o perfil em Marketing > Contas.");

  try {
    const mapa = await signedUrls(paths);
    const urls = paths.map((p) => mapa.get(p));
    if (urls.some((u) => !u)) throw new Error("Não consegui gerar o link das artes para o Instagram.");

    if (opts.story) {
      let ultimo: { id: string; url: string | null } | null = null;
      for (const u of urls) {
        const c = await igCreateImage(conn.accountId, conn.token, u!, { story: true });
        await esperarPronto(c, conn.token);
        ultimo = await igPublish(conn.accountId, conn.token, c);
      }
      return { url: ultimo?.url ?? null, perfil: conn.accountName ?? "Instagram" };
    }

    if (urls.length === 1) {
      const c = await igCreateImage(conn.accountId, conn.token, urls[0]!, { caption: opts.legenda });
      await esperarPronto(c, conn.token);
      const r = await igPublish(conn.accountId, conn.token, c);
      return { url: r.url, perfil: conn.accountName ?? "Instagram" };
    }

    // Carrossel: um item por arte, depois o contêiner com todos, na ordem.
    const filhos: string[] = [];
    for (const u of urls) {
      const r = await graph<{ id: string }>(`/${conn.accountId}/media`, { image_url: u!, is_carousel_item: "true", access_token: conn.token }, "POST");
      filhos.push(r.id);
    }
    for (const f of filhos) await esperarPronto(f, conn.token);
    const carrossel = await graph<{ id: string }>(
      `/${conn.accountId}/media`,
      { media_type: "CAROUSEL", children: filhos.join(","), caption: opts.legenda.slice(0, 2200), access_token: conn.token },
      "POST"
    );
    await esperarPronto(carrossel.id, conn.token);
    const r = await igPublish(conn.accountId, conn.token, carrossel.id);
    return { url: r.url, perfil: conn.accountName ?? "Instagram" };
  } catch (e) {
    // Token vencido: a conta cai para "revogada" e a aba Contas pede para reconectar.
    if (e instanceof MetaError && e.tokenDead) await revokeConnection(conn.id);
    throw e;
  }
}
