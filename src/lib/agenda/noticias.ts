import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { BUCKET, getConfig } from "@/lib/producao/store";
import { MetaError, igBusinessMedia, type IgPostPublico } from "@/lib/social/meta";
import { activeConnection } from "@/lib/social/store";
import { blocosDoEspelho } from "./espelho";
import { cleanInstagram, db, getEpisodio, logAgenda, quandoLongo, updateEpisodio, type Briefing } from "./store";

/**
 * Pauta do PFC News a partir do que os perfis de notícia da região postaram
 * na semana. A leitura é pelo Business Discovery da conta conectada (API
 * oficial da Meta, não scraping), que só enxerga perfis Business/Creator.
 * O Gemini junta as notícias repetidas entre perfis, escolhe as mais
 * relevantes e monta o roteiro, sempre com a fonte de cada uma.
 */

export const FONTES_KEY = "news_fontes";
export const FONTES_PADRAO = [
  "conexaomogiana",
  "folhamogiana",
  "guacuagora",
  "prefeituramogiguacu",
  "prefeituradeestivagerbi",
  "amadorzaoraiz",
  "prefeiturademogimirim",
];

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

export async function fontesNews(): Promise<string[]> {
  const v = await getConfig(FONTES_KEY);
  if (!v) return FONTES_PADRAO;
  return v
    .split(/[\s,]+/)
    .map((h) => cleanInstagram(h))
    .filter((h): h is string => !!h);
}

export type PostFonte = IgPostPublico & { handle: string };

/** Posts dos últimos `dias` de cada fonte. Fonte que falha não derruba as outras. */
export async function coletarNoticias(dias: number): Promise<{ posts: PostFonte[]; erros: string[] }> {
  const conn = await activeConnection("instagram");
  if (!conn) throw new Error("Instagram não conectado (/admin/marketing): é a conta conectada que lê os perfis.");
  const desde = Date.now() - dias * 86_400_000;
  const posts: PostFonte[] = [];
  const erros: string[] = [];
  for (const handle of await fontesNews()) {
    try {
      const media = await igBusinessMedia(conn.accountId, conn.token, handle, 30);
      posts.push(...media.filter((m) => m.caption && new Date(m.timestamp).getTime() >= desde).map((m) => ({ ...m, handle })));
    } catch (e) {
      erros.push(`@${handle}: ${e instanceof MetaError && e.code === 110 ? "perfil pessoal ou inexistente (a Meta só lê Business/Creator)" : msg(e)}`);
    }
  }
  return { posts: posts.sort((a, b) => b.timestamp.localeCompare(a.timestamp)), erros };
}

const STR = { type: "STRING" } as const;

type Resposta = Omit<Briefing, "noticias"> & {
  tema: string;
  noticias: { titulo: string; resumo: string; fontes: number[] }[];
};

/** Busca as notícias da semana e grava tema e roteiro no episódio. */
export async function gerarPautaNews(epId: string, dias: number, actor: string): Promise<{ usadas: number; erros: string[] }> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  const { posts, erros } = await coletarNoticias(dias);
  if (posts.length === 0) throw new Error(`Nenhum post nos últimos ${dias} dias.${erros.length ? ` ${erros.join(" · ")}` : ""}`);

  // Um post por linha, numerado: o modelo devolve os números das fontes de cada notícia.
  const lista = posts
    .slice(0, 160)
    .map((p, i) => {
      const quando = new Date(p.timestamp).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
      const eng = [p.likes != null && `${p.likes} curtidas`, p.comments != null && `${p.comments} comentários`].filter(Boolean).join(", ");
      return `[${i}] @${p.handle} · ${quando}${eng ? ` · ${eng}` : ""}\n${p.caption.slice(0, 1200).replace(/\s+\n/g, "\n")}`;
    })
    .join("\n\n");

  const prompt = `Você é produtor do PFC News, o giro de notícias do Papo Fora da Caixa (Mogi Guaçu, SP), ao vivo no YouTube em ${quandoLongo(ep.inicio)}.
A região coberta é Mogi Guaçu, Mogi Mirim, Estiva Gerbi, Itapira e cidades vizinhas.${ep.tema ? `\nA equipe já indicou o tema: ${ep.tema}` : ""}

Abaixo estão os posts dos últimos ${dias} dias dos perfis de notícia e das prefeituras da região, numerados entre colchetes.

${lista}

Monte a pauta, em português do Brasil:
- noticias: de 5 a 7 notícias, em ordem de importância para quem mora na região (serviço público, obras, saúde, segurança, economia, eventos grandes; o engajamento ajuda a desempatar). Junte numa notícia só o mesmo assunto postado por perfis diferentes. Ignore sorteio, publi, aniversário, post institucional sem fato novo e notícia de fora da região. Cada uma com titulo (curto), resumo (2 a 3 frases, só com o que está nos posts, sem inventar número, nome ou data) e fontes (os números dos posts usados).
- tema: o tema do episódio em uma linha, puxado pela notícia principal ou pelo fio que liga as da semana.
- resumo: abertura do programa em 3 a 4 frases.
- pauta: um bloco por notícia (bloco = título), com 2 a 3 pontos curtos para o apresentador comentar e uma pergunta para o chat; depois um bloco de fechamento.
- cuidados: o que confirmar antes de falar no ar (versões diferentes entre perfis, informação só da prefeitura, caso policial em andamento). Uma ou duas frases.
- titulo_live: título da live no YouTube, até 90 caracteres, com o gancho da notícia principal, sem caixa alta inteira e sem emoji.
- descricao_yt: 3 parágrafos curtos com as notícias do dia e o convite para comentar ao vivo.
- legenda_ig: legenda de divulgação: gancho na primeira linha, data e horário (${quandoLongo(ep.inicio)}), "ao vivo no YouTube, link na bio", e 3 a 5 hashtags incluindo #PFCNews e #MogiGuaçu.
- arte: l1 até 4 palavras, l2 até 2 palavras (destaque), l3 até 2 palavras (opcional), em MAIÚSCULAS, sobre a notícia principal; topicos com as cidades ou os assuntos separados por " • " (ex.: "MOGI GUAÇU • MOGI MIRIM • ITAPIRA E REGIÃO"); cena com os elementos do fundo ligados à notícia principal, sem pessoas nem texto.
Não copie as legendas: reescreva com as suas palavras.`;

  const json = await generate(TEXT_MODEL, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          noticias: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: { titulo: STR, resumo: STR, fontes: { type: "ARRAY", items: { type: "INTEGER" } } },
              required: ["titulo", "resumo", "fontes"],
            },
          },
          tema: STR,
          resumo: STR,
          pauta: {
            type: "ARRAY",
            items: { type: "OBJECT", properties: { bloco: STR, perguntas: { type: "ARRAY", items: STR } }, required: ["bloco", "perguntas"] },
          },
          cuidados: STR,
          titulo_live: STR,
          descricao_yt: STR,
          legenda_ig: STR,
          arte: {
            type: "OBJECT",
            properties: { l1: STR, l2: STR, l3: STR, topicos: STR, cena: STR },
            required: ["l1", "l2", "topicos", "cena"],
          },
        },
        required: ["noticias", "tema", "resumo", "pauta", "titulo_live", "descricao_yt", "legenda_ig", "arte"],
      },
    },
  });
  const r = JSON.parse(json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}") as Partial<Resposta>;
  if (!r.noticias?.length || !r.arte?.l1) throw new Error("O Gemini não devolveu a pauta.");

  const up = (v?: string) => (v ?? "").trim().toUpperCase();
  const noticias = r.noticias.map((n) => ({
    titulo: n.titulo.trim(),
    resumo: n.resumo.trim(),
    // Só os números que existem na lista; repetido entra uma vez.
    fontes: Array.from(new Set(n.fontes))
      .map((i) => posts[i])
      .filter((p): p is PostFonte => !!p)
      .map((p) => ({ handle: p.handle, url: p.permalink, data: p.timestamp })),
  }));
  const briefing: Briefing = {
    resumo: (r.resumo ?? "").trim(),
    pauta: (r.pauta ?? []).filter((p) => p.bloco && p.perguntas?.length),
    cuidados: (r.cuidados ?? "").trim(),
    titulo_live: (r.titulo_live ?? "").trim().slice(0, 100),
    descricao_yt: (r.descricao_yt ?? "").trim(),
    legenda_ig: (r.legenda_ig ?? "").trim(),
    arte: {
      l1: up(r.arte.l1),
      l2: up(r.arte.l2),
      ...(up(r.arte.l3) ? { l3: up(r.arte.l3) } : {}),
      ...(up(r.arte.topicos) ? { topicos: up(r.arte.topicos) } : {}),
      ...(r.arte.cena?.trim() ? { cena: r.arte.cena.trim() } : {}),
    },
    noticias,
  };
  await updateEpisodio(ep.id, { briefing, tema: ep.tema || (r.tema ?? "").trim() || null, ig_legenda: briefing.legenda_ig });
  const fotos = await fotosDasNoticias(ep.id, briefing, posts);
  await logAgenda(ep.id, actor, "gerou a pauta com as notícias do Instagram", `${posts.length} posts, ${noticias.length} notícias, ${fotos} fotos no espelho`);
  if (erros.length) await logAgenda(ep.id, actor, "não conseguiu ler fontes", erros.join(" · "));
  return { usadas: noticias.length, erros };
}

/** Quem "enviou" as fotos que vêm dos posts: é por ele que a pauta seguinte apaga as da anterior. */
const AUTOR_FOTOS = "pauta-news";

/**
 * A foto do post de origem de cada notícia vai para o bloco dela no
 * espelho da transmissão, para a equipe técnica ter a imagem na hora sem
 * caçar no Instagram. A URL da Meta é temporária: a foto é copiada para o
 * Storage. Foto que não baixa só fica de fora.
 */
async function fotosDasNoticias(epId: string, b: Briefing, posts: PostFonte[]): Promise<number> {
  const { data: velhas } = await db().from("agenda_materiais").delete().eq("episodio_id", epId).eq("enviado_por", AUTOR_FOTOS).select("path");
  if (velhas?.length) await db().storage.from(BUCKET).remove(velhas.map((v) => v.path as string));

  const porUrl = new Map(posts.map((p) => [p.permalink, p]));
  let n = 0;
  const blocos = blocosDoEspelho(b);
  for (let bloco = 0; bloco < blocos.length; bloco++) {
    const x = blocos[bloco];
    // Até duas fotos por notícia, de perfis diferentes quando houver.
    const fontes = (x.noticia?.fontes ?? []).map((f) => porUrl.get(f.url)).filter((p): p is PostFonte => !!p?.imageUrl);
    for (const p of fontes.slice(0, 2)) {
      try {
        const r = await fetch(p.imageUrl!);
        const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
        if (!r.ok || !mime.startsWith("image/")) continue;
        const buf = Buffer.from(await r.arrayBuffer());
        const nome = `${p.handle}-${p.id}.${mime === "image/png" ? "png" : "jpg"}`;
        const path = `agenda/${epId}/materiais/news-${nome}`;
        const { error } = await db().storage.from(BUCKET).upload(path, buf, { contentType: mime, upsert: true });
        if (error) continue;
        await db().from("agenda_materiais").insert({
          episodio_id: epId,
          tipo: "outro",
          path,
          nome: `@${nome}`,
          mime,
          tamanho: buf.length,
          usar_na_arte: false,
          bloco,
          enviado_por: AUTOR_FOTOS,
        });
        n++;
      } catch {
        // Sem a foto, a notícia continua no espelho com o link do post.
      }
    }
  }
  return n;
}
