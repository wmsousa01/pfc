import "server-only";
import { TEXT_MODEL, generate } from "@/lib/producao/gemini";
import { BUCKET, getConfig } from "@/lib/producao/store";
import { MetaError, igBusinessMedia } from "@/lib/social/meta";
import { activeConnection } from "@/lib/social/store";
import { comuns, palavras } from "./casar-noticias";
import { blocosDoEspelho, codigoDoPost, type BlocoEspelho } from "./espelho";
import { baixarImagem, coletarSites } from "./sites";
import { cleanInstagram, db, getEpisodio, logAgenda, quandoLongo, updateEpisodio, type Briefing, type Materia, type Roteiro } from "./store";

/**
 * Pauta do PFC News a partir do que saiu na semana nos perfis de notícia da
 * região no Instagram (Business Discovery da conta conectada, API oficial
 * da Meta, que só enxerga perfis Business/Creator) e nos sites das
 * prefeituras (ver sites.ts). O Gemini escolhe as notícias e escreve o
 * roteiro no formato que o apresentador usa — abertura, matérias com
 * manchete, leitura, comentário, a piada (H), pergunta para reflexão e
 * serviço, e o encerramento —, sempre com a fonte de cada matéria.
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

/** Uma fonte da pauta: post do Instagram ou notícia do site de uma prefeitura. */
export type ItemFonte = {
  id: string;
  /** Perfil do Instagram, ou o host do site ("mogimirim.sp.gov.br"). */
  handle: string;
  site: boolean;
  url: string;
  data: string;
  texto: string;
  imagem: string | null;
  engajamento: string | null;
};

/** Posts e notícias dos últimos `dias`. Fonte que falha não derruba as outras. */
export async function coletarNoticias(dias: number): Promise<{ itens: ItemFonte[]; erros: string[] }> {
  const desde = Date.now() - dias * 86_400_000;
  const itens: ItemFonte[] = [];
  const erros: string[] = [];
  const conn = await activeConnection("instagram");
  if (!conn) erros.push("Instagram não conectado (/admin/marketing): os perfis de notícia ficaram de fora.");
  for (const handle of conn ? await fontesNews() : []) {
    try {
      const media = await igBusinessMedia(conn!.accountId, conn!.token, handle, 30);
      for (const m of media) {
        if (!m.caption || new Date(m.timestamp).getTime() < desde) continue;
        const eng = [m.likes != null && `${m.likes} curtidas`, m.comments != null && `${m.comments} comentários`].filter(Boolean).join(", ");
        itens.push({ id: m.id, handle, site: false, url: m.permalink, data: m.timestamp, texto: m.caption, imagem: m.imageUrl, engajamento: eng || null });
      }
    } catch (e) {
      erros.push(`@${handle}: ${e instanceof MetaError && e.code === 110 ? "perfil pessoal ou inexistente (a Meta só lê Business/Creator)" : msg(e)}`);
    }
  }
  const sites = await coletarSites(dias);
  erros.push(...sites.erros);
  for (const a of sites.artigos) {
    itens.push({ id: a.id, handle: a.site, site: true, url: a.url, data: a.data, texto: `${a.titulo}\n${a.texto}`, imagem: a.imagem, engajamento: null });
  }
  return { itens: itens.sort((a, b) => b.data.localeCompare(a.data)), erros };
}

const STR = { type: "STRING" } as const;

/** O plano do programa: as matérias escolhidas, sem o texto delas. */
type Plano = Pick<Briefing, "cuidados" | "titulo_live" | "descricao_yt" | "legenda_ig" | "arte"> & {
  tema: string;
  abertura: string;
  encerramento: string;
  materias: { bloco: string; titulo: string; manchete: string; fontes: number[] }[];
};

type Texto = { leitura: string; comentario: string; humor: string; reflexao: string; pontos: string[]; servico: string };

/**
 * Palavras em comum que uma fonte precisa ter com a matéria para valer como
 * fonte dela. O modelo às vezes aponta o post vizinho na lista — era daí que
 * vinha a foto de uma notícia no bloco de outra.
 */
const FONTE_MIN = 4;
/** Matérias escritas ao mesmo tempo. */
const PARALELO = 5;

/** Texto limpo; parágrafo separado por espaços duplos (o Gemini às vezes faz isso) vira linha em branco. */
const limpo = (v?: string | null) =>
  (v ?? "")
    .replace(/\r/g, "")
    .replace(/([.!?:”"])[ \t]{2,}(?=\S)/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;

/**
 * O Gemini às vezes entra em laço numa saída longa ("no ParkShopping Mogi
 * Mirim de segunda a sexta... no ParkShopping Mogi Mirim de segunda a
 * sexta..." até o limite). Oito palavras seguidas aparecendo quatro vezes
 * é laço: a chamada é refeita.
 */
function emLaco(s: string): boolean {
  if (s.length > 20_000) return true;
  const w = s.split(/\s+/);
  const vistos = new Map<string, number>();
  for (let i = 0; i + 8 <= w.length; i++) {
    const k = w.slice(i, i + 8).join(" ");
    const n = (vistos.get(k) ?? 0) + 1;
    if (n >= 4) return true;
    vistos.set(k, n);
  }
  return false;
}

/** Chamada com saída JSON, refeita uma vez se vier cortada, em laço ou quebrada. */
async function pedirJson<T>(texto: string, schema: object, maxOutputTokens: number): Promise<T> {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const json = await generate(TEXT_MODEL, {
      contents: [{ parts: [{ text: texto }] }],
      generationConfig: { maxOutputTokens, responseMimeType: "application/json", responseSchema: schema },
    });
    const cand = json.candidates?.[0];
    const saida: string = (cand?.content?.parts ?? []).map((x: { text?: string }) => x.text ?? "").join("");
    if (cand?.finishReason === "MAX_TOKENS" || emLaco(saida)) continue;
    try {
      return JSON.parse(saida) as T;
    } catch {
      continue;
    }
  }
  throw new Error("O Gemini se perdeu escrevendo (texto repetido ou cortado). Gere de novo.");
}

const QUEM_SOMOS = `Você é produtor do PFC News, a revista eletrônica de informação, análise e acontecimentos do Papo Fora da Caixa (Mogi Guaçu, SP).
A região coberta é Mogi Guaçu, Mogi Mirim, Estiva Gerbi, Itapira e cidades vizinhas.`;

function promptPlano(quando: string, tema: string | null, dias: number, lista: string): string {
  return `${QUEM_SOMOS}
O programa vai ao ar ao vivo no YouTube em ${quando}.${tema ? `\nA equipe já indicou o tema: ${tema}` : ""}

Abaixo estão as fontes dos últimos ${dias} dias, numeradas entre colchetes: posts dos perfis de notícia e das prefeituras no Instagram (@perfil) e notícias dos sites das prefeituras (site ...).

${lista}

Monte o plano do programa, em português do Brasil:
- materias: de 6 a 10 notícias, na ordem do programa, agrupadas em 2 ou 3 blocos temáticos. Cada uma com:
  - bloco: o rótulo do bloco, igual em todas as matérias do mesmo bloco ("BLOCO 1 — Abertura e panorama regional", "BLOCO 2 — Saúde: números que merecem atenção").
  - titulo: "Assunto: o fato" (ex.: "Mobilidade: a chegada da Rota Mogiana", "Mogi Mirim: nova sede do SAAE").
  - manchete: uma frase de manchete de jornal, que vai no GC (ex.: "Prefeitura reduz em 20% o aluguel dos boxes comerciais do Terminal Parque dos Ingás.").
  - fontes: os números das fontes que falam DESTA notícia, e só delas. Confira cada número: a fonte errada põe a foto de outra notícia no ar.
  Como escolher: priorize serviço público, obras e zeladoria, saúde, economia e tributos, emprego e concursos, educação, cultura e mobilidade. Caso policial só se tiver grande impacto na região. Junte numa matéria só o mesmo assunto vindo de fontes diferentes; cada matéria trata de UM assunto. Ignore sorteio, publi, aniversário, post sem fato novo e notícia de fora da região.
- abertura: a fala de abertura do apresentador: "Boa noite! Está começando mais uma edição do PFC News, a nossa revista eletrônica de informação, análise e acontecimentos da região."; um parágrafo com os assuntos de hoje; um parágrafo ligando as cidades da região; e "O PFC News está no ar!". Parágrafos separados por linha em branco.
- encerramento: a despedida: um parágrafo retomando os temas do dia, um sobre acompanhar e cobrar resultados, "Obrigado pela companhia. Continue acompanhando o PFC News, porque informação regional também é informação que transforma." e "Uma ótima semana e até a próxima edição!".
- tema: o tema do episódio em uma linha.
- cuidados: o que confirmar antes de falar no ar (versões diferentes entre fontes, informação só da prefeitura, caso em andamento). Uma ou duas frases.
- titulo_live: título da live no YouTube, até 90 caracteres, com o gancho da notícia principal, sem caixa alta inteira e sem emoji.
- descricao_yt: 3 parágrafos curtos com as notícias do dia e o convite para comentar ao vivo.
- legenda_ig: legenda de divulgação: gancho na primeira linha, data e horário (${quando}), "ao vivo no YouTube, link na bio", e 3 a 5 hashtags incluindo #PFCNews e #MogiGuaçu.
- arte: l1 até 4 palavras, l2 até 2 palavras (destaque), l3 até 2 palavras (opcional), em MAIÚSCULAS, sobre a notícia principal; topicos com as cidades ou os assuntos separados por " • "; cena com os elementos do fundo ligados à notícia principal, sem pessoas nem texto.`;
}

const SCHEMA_PLANO = {
  type: "OBJECT",
  properties: {
    materias: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { bloco: STR, titulo: STR, manchete: STR, fontes: { type: "ARRAY", items: { type: "INTEGER" } } },
        required: ["bloco", "titulo", "manchete", "fontes"],
      },
    },
    abertura: STR,
    encerramento: STR,
    tema: STR,
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
  required: ["materias", "abertura", "encerramento", "tema", "titulo_live", "descricao_yt", "legenda_ig", "arte"],
};

function promptMateria(m: Plano["materias"][number], fontes: string): string {
  return `${QUEM_SOMOS}
Escreva uma matéria do roteiro no formato que o apresentador usa, em português do Brasil.

Matéria: ${m.titulo}
Manchete (vai no GC): ${m.manchete}

Fontes desta matéria (use só as que falam dela; ignore a que tratar de outro assunto):
${fontes}

Campos:
- leitura: a notícia para o apresentador ler, de 4 a 8 parágrafos curtos separados por quebra de linha dupla (\\n\\n), só com fatos das fontes: números, datas, nomes e locais exatamente como estão nelas. Nada de opinião. Nunca invente. Reescreva com as suas palavras, sem copiar trechos.
- comentario: de 3 a 6 parágrafos curtos separados por quebra de linha dupla (\\n\\n), de análise: por que importa para quem mora na região, o outro lado, o que acompanhar ou cobrar (no estilo "Mas existe uma questão importante: ...").
- humor: uma tirada leve e curta sobre o assunto, como quem conversa com o público (ex.: "Trinta anos de contrato! É praticamente um relacionamento de longa duração."). DEIXE VAZIO em caso policial, morte, doença grave, violência, acidente com vítima ou qualquer tragédia.
- reflexao: uma pergunta para reflexão do público.
- pontos: 4 ou 5 tópicos "Rótulo: explicação curta" que ajudam a responder a pergunta, e por último uma frase de conclusão.
- servico: só quando o público precisa fazer algo (prazo, inscrição, site, endereço, horário de atendimento): o serviço ao telespectador, em até 3 frases. Vazio se não houver.`;
}

const SCHEMA_MATERIA = {
  type: "OBJECT",
  properties: { leitura: STR, comentario: STR, humor: STR, reflexao: STR, pontos: { type: "ARRAY", items: STR }, servico: STR },
  required: ["leitura", "comentario", "reflexao", "pontos"],
};

/** As fontes que falam mesmo da matéria, a mais parecida primeiro (é dela a foto). */
function fontesDaMateria(m: Materia, indices: number[], itens: ItemFonte[]) {
  const daMateria = palavras([m.titulo, m.manchete, m.leitura].join(" "));
  return Array.from(new Set(indices))
    .map((i) => itens[i])
    .filter((p): p is ItemFonte => !!p)
    .map((p) => ({ p, nota: comuns(daMateria, palavras(p.texto)) }))
    .filter((x) => x.nota >= FONTE_MIN)
    .sort((a, b) => b.nota - a.nota)
    .map(({ p }) => ({ handle: p.handle, url: p.url, data: p.data }));
}

const quemDa = (p: ItemFonte) => (p.site ? `site ${p.handle}` : `@${p.handle}`);
const diaDa = (p: ItemFonte) => new Date(p.data).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });

/** Roda `fn` em todos os itens, `n` de cada vez, na ordem. */
async function emLotes<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < xs.length; i += n) out.push(...(await Promise.all(xs.slice(i, i + n).map(fn))));
  return out;
}

/**
 * Escreve o roteiro e as notícias a partir das fontes, sem gravar nada:
 * primeiro o plano (que matérias, em que bloco, com que fontes) e depois o
 * texto de cada matéria só com as fontes dela, em paralelo. Uma saída só
 * com o programa inteiro passava de 50 mil tokens e o Gemini entrava em laço.
 */
export async function escreverRoteiro(
  quando: string,
  tema: string | null,
  dias: number,
  itens: ItemFonte[]
): Promise<{ materias: Materia[]; briefing: Briefing; tema: string }> {
  // Uma fonte por item, numerada: o modelo devolve os números das fontes de cada matéria.
  const lista = itens
    .map((p, i) => `[${i}] ${quemDa(p)} · ${diaDa(p)}${p.engajamento ? ` · ${p.engajamento}` : ""}\n${p.texto.slice(0, p.site ? 1500 : 1000).replace(/\s+\n/g, "\n")}`)
    .join("\n\n");
  const r = await pedirJson<Partial<Plano>>(promptPlano(quando, tema, dias, lista), SCHEMA_PLANO, 16_384);
  const plano = (r.materias ?? []).filter((m) => m.titulo?.trim() && m.manchete?.trim());
  if (plano.length === 0 || !r.arte?.l1) throw new Error("O Gemini não devolveu o plano do programa.");

  const textos = await emLotes(plano, PARALELO, async (m) => {
    const fontes = Array.from(new Set(m.fontes))
      .map((i) => itens[i])
      .filter((p): p is ItemFonte => !!p)
      .map((p) => `${quemDa(p)} · ${diaDa(p)}\n${p.texto.slice(0, 4000)}`)
      .join("\n\n---\n\n");
    try {
      return await pedirJson<Partial<Texto>>(promptMateria(m, fontes || "(sem fonte)"), SCHEMA_MATERIA, 8_192);
    } catch {
      return null;
    }
  });

  const bloco1 = limpo(plano[0].bloco);
  const materias: Materia[] = [
    { tipo: "abertura", bloco: bloco1, titulo: "Abertura", manchete: null, leitura: limpo(r.abertura), comentario: null, humor: null, reflexao: null, pontos: [], servico: null },
  ];
  const noticias: NonNullable<Briefing["noticias"]> = [];
  plano.forEach((m, k) => {
    const t = textos[k];
    const mat: Materia = {
      tipo: "materia",
      bloco: limpo(m.bloco),
      titulo: m.titulo.trim(),
      manchete: limpo(m.manchete),
      // Sem texto, a matéria fica no espelho com a manchete e o aviso, para a equipe decidir.
      leitura: limpo(t?.leitura) ?? "(A IA não conseguiu escrever esta matéria. Gere a pauta de novo ou escreva a partir da fonte.)",
      comentario: limpo(t?.comentario),
      humor: limpo(t?.humor),
      reflexao: limpo(t?.reflexao),
      pontos: (t?.pontos ?? []).map((x) => x.trim()).filter(Boolean),
      servico: limpo(t?.servico),
    };
    materias.push(mat);
    noticias.push({ titulo: mat.titulo, resumo: (mat.leitura ?? "").split("\n\n")[0].slice(0, 400), fontes: fontesDaMateria(mat, m.fontes ?? [], itens) });
  });
  materias.push({
    tipo: "encerramento",
    bloco: limpo(plano[plano.length - 1].bloco),
    titulo: "Encerramento",
    manchete: null,
    leitura: limpo(r.encerramento),
    comentario: null,
    humor: null,
    reflexao: null,
    pontos: [],
    servico: null,
  });

  const up = (v?: string) => (v ?? "").trim().toUpperCase();
  const briefing: Briefing = {
    resumo: materias.find((m) => m.tipo === "abertura")?.leitura ?? "",
    // A pauta curta continua para o resto do sistema (edição em texto, briefing).
    pauta: materias
      .filter((m) => m.tipo === "materia")
      .map((m) => ({ bloco: m.titulo, perguntas: [m.manchete, m.reflexao, ...m.pontos].filter((x): x is string => !!x) })),
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
  return { materias, briefing, tema: (r.tema ?? "").trim() };
}

/** Busca as notícias da semana e grava tema, roteiro e fotos no episódio. */
export async function gerarPautaNews(epId: string, dias: number, actor: string): Promise<{ usadas: number; erros: string[] }> {
  const ep = await getEpisodio(epId);
  if (!ep) throw new Error("Episódio não encontrado.");
  const { itens: todos, erros } = await coletarNoticias(dias);
  if (todos.length === 0) throw new Error(`Nenhuma notícia nos últimos ${dias} dias.${erros.length ? ` ${erros.join(" · ")}` : ""}`);
  const itens = todos.slice(0, 180);
  // "Giro de Notícias" é o nome do quadro, não um tema.
  const temaDado = ep.tema && !/giro de not/i.test(ep.tema) ? ep.tema : null;
  const { materias, briefing, tema } = await escreverRoteiro(quandoLongo(ep.inicio), temaDado, dias, itens);

  // O roteiro que o apresentador mandou fica; o que a IA gerou antes é trocado.
  const doApresentador = !!ep.roteiro && ep.roteiro.origem !== "ia";
  const roteiro: Roteiro = doApresentador ? ep.roteiro! : { arquivo: null, importado_em: new Date().toISOString(), origem: "ia", materias };
  await updateEpisodio(ep.id, {
    briefing,
    roteiro,
    tema: ep.tema || tema || null,
    ig_legenda: briefing.legenda_ig,
    ...(doApresentador ? {} : { espelho_atual: null, espelho_imagem: null }),
  });
  const fotos = await fotosDasNoticias(ep.id, blocosDoEspelho(briefing, roteiro), itens);
  const sites = itens.filter((p) => p.site).length;
  await logAgenda(
    ep.id,
    actor,
    "gerou a pauta do PFC News",
    `${itens.length - sites} posts e ${sites} notícias de sites, ${briefing.noticias?.length ?? 0} matérias, ${fotos} fotos no espelho${doApresentador ? "; manteve o roteiro do apresentador" : ""}`
  );
  if (erros.length) await logAgenda(ep.id, actor, "não conseguiu ler fontes", erros.join(" · "));
  return { usadas: briefing.noticias?.length ?? 0, erros };
}

/** Quem "enviou" as fotos que vêm das fontes: é por ele que a pauta seguinte apaga as da anterior. */
const AUTOR_FOTOS = "pauta-news";

async function baixarFoto(p: ItemFonte): Promise<{ buf: Buffer; mime: string } | null> {
  if (p.site) return baixarImagem(p.imagem!);
  const r = await fetch(p.imagem!);
  const mime = r.headers.get("content-type")?.split(";")[0] ?? "";
  return r.ok && mime.startsWith("image/") ? { buf: Buffer.from(await r.arrayBuffer()), mime } : null;
}

/**
 * A foto da fonte de cada matéria (a do site da prefeitura ou a do post)
 * vai para o bloco dela no espelho, para a equipe técnica ter a imagem na
 * hora. A URL da Meta é temporária: a foto é copiada para o Storage. Foto
 * que não baixa só fica de fora.
 */
async function fotosDasNoticias(epId: string, blocos: BlocoEspelho[], itens: ItemFonte[]): Promise<number> {
  const { data: velhas } = await db().from("agenda_materiais").delete().eq("episodio_id", epId).eq("enviado_por", AUTOR_FOTOS).select("path");
  if (velhas?.length) await db().storage.from(BUCKET).remove(velhas.map((v) => v.path as string));

  const porUrl = new Map(itens.map((p) => [p.url, p]));
  let n = 0;
  for (let bloco = 0; bloco < blocos.length; bloco++) {
    const x = blocos[bloco];
    // Até duas fotos por notícia; bloco que junta várias notícias fica com uma de cada.
    const porNoticia = x.noticias.length > 1 ? 1 : 2;
    const fontes = x.noticias.flatMap((nt) =>
      nt.fontes
        .map((f) => porUrl.get(f.url))
        .filter((p): p is ItemFonte => !!p?.imagem)
        .slice(0, porNoticia)
    );
    for (const p of fontes) {
      try {
        const img = await baixarFoto(p);
        if (!img) continue;
        // O código da fonte no nome: é por ele que a foto acha a notícia quando o espelho muda de blocos.
        const ext = img.mime === "image/png" ? "png" : img.mime === "image/webp" ? "webp" : "jpg";
        const nome = `${p.handle}-${codigoDoPost(p.url) ?? p.id}.${ext}`;
        const path = `agenda/${epId}/materiais/news-${nome}`;
        const { error } = await db().storage.from(BUCKET).upload(path, img.buf, { contentType: img.mime, upsert: true });
        if (error) continue;
        await db().from("agenda_materiais").insert({
          episodio_id: epId,
          tipo: "outro",
          path,
          nome: p.site ? nome : `@${nome}`,
          mime: img.mime,
          tamanho: img.buf.length,
          usar_na_arte: false,
          bloco,
          enviado_por: AUTOR_FOTOS,
        });
        n++;
      } catch {
        // Sem a foto, a matéria continua no espelho com o link da fonte.
      }
    }
  }
  return n;
}
