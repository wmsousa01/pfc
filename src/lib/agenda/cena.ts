import "server-only";
import sharp from "sharp";
import { detectPeople, renderWithRefs, type AspectRatio, type ImagemRef } from "@/lib/producao/gemini";
import type { QuadroId, QuadroTheme } from "@/lib/producao/quadros";
import type { Headline } from "@/lib/producao/store";
import { TZ, WEEKDAYS, brtDate } from "./store";

/**
 * Arte desenhada pelo Gemini a partir das fotos reais, no padrão dos
 * "PROMPT MASTER" que a equipe usava no ChatGPT: estúdio cinematográfico
 * azul × âmbar, apresentador à esquerda e convidado à direita, headline
 * gigante embaixo, selo AO VIVO com data e hora.
 *
 * Lições das thumbs dos cortes (ver src/lib/producao/prompt.ts): o prompt diz
 * exatamente quantas pessoas existem e quem é quem, e o logo só é citado
 * quando vai junto — senão o modelo inventa gente e desenha logo falso.
 */

export type Img = { buf: Buffer; mime: string };
/** `img` null: a pessoa não tem foto própria e aparece nos frames do episódio. */
/**
 * `marca`: o convidado é clube ou empresa e `img` é o logo dele (a foto do
 * perfil é o escudo). Vai como logotipo no lugar do convidado; chamado de
 * "fotografia", o modelo inventava uma pessoa com a camisa do time.
 */
export type PessoaCena = { nome: string; papel: string; host: boolean; img: Img | null; marca?: boolean };
export type RefCena = { legenda: string; img: Img };

export type CenaInput = {
  quadro: QuadroTheme;
  inicio: string;
  /** Chamada do dia: "HOJE" no lugar do dia da semana. */
  hoje: boolean;
  pessoas: PessoaCena[];
  logo: Img | null;
  refs: RefCena[];
  headline: Headline;
  topicos: string | null;
  sub: string | null;
  cena: string | null;
  tema: string | null;
  /** Frames do próprio episódio gravado (PFC Visita): as pessoas reais e o lugar. */
  frames: Img[];
  /** Episódio gravado estreia no YouTube, não é ao vivo. */
  gravado: boolean;
};

/** Identidade de cada quadro nas artes da equipe. */
const ESTILO: Record<QuadroId, string> = {
  "fora-da-caixa":
    "Fundo azul-marinho e preto profundo, reflexos azul elétrico e ciano, iluminação âmbar e dourada nas laterais, textos brancos e dourados, contraste elevado. Atmosfera de estúdio de podcast premium.",
  "lado-a-lado-b":
    "LADO ESQUERDO azul elétrico (navy profundo, reflexos ciano, linhas luminosas) e LADO DIREITO laranja/âmbar quente, com uma transição diagonal entre os dois universos — a identidade Lado A × Lado B. Textos brancos e laranja intenso.",
  "pfc-news":
    "Telejornal moderno: newsroom contemporânea com grandes painéis digitais, mapas e elementos gráficos ABSTRATOS (sem texto legível), linhas luminosas azuis, detalhes laranja/âmbar, reflexos realistas. Urgência, credibilidade e autoridade jornalística. Textos brancos; horário em faixa laranja/amarela.",
  "pfc-visita":
    "Luz natural quente com faixas verticais de luz verde-esmeralda e bokeh verde suave; fundo escuro, textos brancos e verdes.",
  "tateios-escolares":
    "Faixas de luz azul-celeste e bokeh ciano suave, clima mais leve e amigável; fundo escuro, textos brancos e azul-celeste.",
};

const PRESERVAR = `PRESERVAÇÃO ABSOLUTA DAS PESSOAS (prioridade máxima, acima de qualquer estilo)
Trate cada fotografia como um recorte colado na arte, não como inspiração: os rostos são os da foto, não um redesenho.
- Rosto, olhos, nariz, boca, formato da cabeça, linha do cabelo, barba, rugas, marcas e textura de pele exatamente como na foto. Nada de pele lisa, olhos maiores, queixo afinado ou rosto rejuvenescido.
- A luz do rosto continua a da foto original: o color grading e a luz de recorte do cenário tocam só o contorno da silhueta e o fundo, nunca remodelam o rosto.
- Mesmo ângulo de cabeça e mesma expressão da foto; não vire o rosto para encaixar na composição — ajuste a composição à pessoa.
- Não reconstruir nem "melhorar" rostos (sem AI face enhancement); não alterar expressão, idade, cabelo, barba, óculos, tatuagens, tom de pele, roupas ou acessórios.
- Não deformar mãos, braços ou proporções; não criar pessoas parecidas: são estas pessoas.
- Não adicionar nenhuma outra pessoa, nem ao fundo, nem silhueta reconhecível. Não repetir a mesma pessoa.`;

const PROIBIDO = `PROIBIDO
- Texto além do listado em TEXTOS OBRIGATÓRIOS; manchetes falsas, marcas d'água, nomes de patrocinadores.
- Repetir um texto: cada item de TEXTOS OBRIGATÓRIOS aparece uma única vez na arte.
- Logotipos inventados ou redesenhados.
- Erros de ortografia: confira cada acento, cedilha e ponto de interrogação.
- Visual genérico de IA, HDR exagerado, pele plastificada, aparência de ilustração.`;

/** "QUINTA" / "29/10" / "19H30" */
function partesData(iso: string) {
  const d = new Date(iso);
  const wd = WEEKDAYS[new Date(`${brtDate(d)}T12:00:00-03:00`).getUTCDay()];
  const dia = d.toLocaleDateString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
  const [hh, mm] = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).split(":");
  return { wd, dia, hora: `${hh}H${mm === "00" ? "" : mm}` };
}

/** "SEGUNDA-FEIRA" (sábado e domingo não têm "-feira"). */
export function diaCompleto(iso: string): string {
  const { wd } = partesData(iso);
  return (wd === "sábado" || wd === "domingo" ? wd : `${wd}-feira`).toUpperCase();
}

export function chamada(iso: string, hoje: boolean): { dia: string; hora: string } {
  const p = partesData(iso);
  return { dia: `${hoje ? "HOJE" : p.wd.toUpperCase()} • ${p.dia}`, hora: `ÀS ${p.hora}` };
}

type FormatoCena = "feed" | "story" | "thumb";

const FORMATO: Record<FormatoCena, { aspect: AspectRatio; w: number; h: number; texto: string }> = {
  feed: { aspect: "4:5", w: 1080, h: 1350, texto: "Instagram Feed vertical 4:5. Margens de segurança de 60 px; tipografia grande e legível no celular." },
  story: {
    aspect: "9:16",
    w: 1080,
    h: 1920,
    texto:
      "Story/Reels/TikTok vertical 9:16. Os 14% de cima e os 18% de baixo ficam cobertos pela interface do app: nenhum texto, logo ou rosto nessas faixas — nelas o mesmo cenário continua, sem emenda nem faixa de outra cor.",
  },
  thumb: { aspect: "16:9", w: 1280, h: 720, texto: "Thumbnail do YouTube horizontal 16:9, alto CTR, margem de segurança de 60 px, legível em tela pequena." },
};

function quadroNome(t: QuadroTheme) {
  return t.name === "Fora da Caixa" ? "PFC — PAPO FORA DA CAIXA" : `${t.name.toUpperCase()} — PFC | PAPO FORA DA CAIXA`;
}

/** Monta o prompt e a lista de imagens na ordem em que o prompt cita. */
function montar(c: CenaInput, f: FormatoCena): { prompt: string; refs: ImagemRef[] } {
  const refs: ImagemRef[] = [];
  const add = (legenda: string, img: Img) => {
    refs.push({ legenda, data: img.buf, mime: img.mime });
    return refs.length;
  };

  const marcas = c.pessoas.filter((p) => p.marca);
  const hosts = c.pessoas.filter((p) => p.host);
  const convidados = c.pessoas.filter((p) => !p.host);
  const solo = c.pessoas.length === 1;
  // O logo do convidado ocupa o lugar dele na composição, mas não conta como pessoa.
  const n = c.pessoas.length - marcas.length;
  const marcaTxt = marcas.map((m) => m.nome).join(" e ");

  const framesI = c.frames.slice(0, 3).map((fr) => add("FRAME DO EPISÓDIO GRAVADO — as pessoas reais e o lugar.", fr));
  const nosFrames = framesI.length ? `IMAGEM ${framesI.join(", ")}` : null;

  // Posições: apresentador(es) à esquerda, convidado(s) à direita. Sozinho, à direita com o texto à esquerda.
  const descPessoas = c.pessoas.map((p) => {
    const lado = solo ? "à DIREITA, grande, da cintura ou do peito para cima" : p.host ? "à ESQUERDA" : "à DIREITA, em primeiro plano, com presença dominante";
    if (p.marca) {
      const i = add(`LOGOTIPO de ${p.nome} (convidado: clube/empresa — NÃO é uma pessoa).`, p.img!);
      return `- IMAGEM ${i}: logotipo de ${p.nome} — ${p.papel}. ${p.nome} é um clube/empresa, NÃO uma pessoa: o logotipo, grande e fiel à imagem, ocupa o lugar do convidado ${lado}. Não desenhar nenhuma pessoa para representá-lo, nem ninguém com o uniforme ou o escudo dele.`;
    }
    if (!p.img) return `- ${p.nome} — ${p.papel}: sem foto própria; é ${p.host ? "o apresentador" : "o convidado (o dono ou responsável pelo lugar)"} que aparece nos frames do episódio (${nosFrames}). Recorte dele dos frames. Posicionar ${lado}.`;
    const i = add(`FOTOGRAFIA de ${p.nome} (${p.host ? "apresentador" : "convidado"}).`, p.img);
    return `- IMAGEM ${i}: ${p.nome} — ${p.papel}. Posicionar ${lado}.`;
  });
  const logoI = c.logo ? add(`LOGOTIPO OFICIAL do ${c.quadro.name}. Usar exatamente como está.`, c.logo) : null;
  const refsI = c.refs.map((r) => `- IMAGEM ${add(r.legenda, r.img)}: ${r.legenda}`);

  const { dia, hora } = chamada(c.inicio, c.hoje);
  const h = c.headline;
  const headline = [h.l1, h.l2, h.l3].filter(Boolean).join(" / ");

  const textos: string[] = [];
  if (f === "thumb") {
    textos.push(`HEADLINE em ${h.l3 ? "três" : "duas"} linhas: ${[h.l1, h.l2, h.l3].filter(Boolean).map((l) => `"${l}"`).join(" / ")}`);
  } else {
    textos.push(`HEADLINE: ${[h.l1, h.l2, h.l3].filter(Boolean).map((l) => `"${l}"`).join(" / ")}`);
    textos.push(c.gravado ? `SELO VERMELHO LUMINOSO: "▶ ESTREIA"` : `SELO VERMELHO LUMINOSO: "● AO VIVO"`);
    textos.push(`DATA: "${dia}"`);
    textos.push(`HORÁRIO: "${hora}"`);
    textos.push(`"NO YOUTUBE" com o ícone vermelho oficial do YouTube`);
    if (!solo || convidados.length)
      for (const p of c.pessoas)
        textos.push(`IDENTIFICAÇÃO${p.marca ? " (embaixo do logotipo, não de uma pessoa)" : ""}: "${p.nome.toUpperCase()}" e, menor, "${p.papel.toUpperCase()}"`);
    if (c.topicos) textos.push(`TÓPICOS (linha abaixo da headline): "${c.topicos.toUpperCase()}"`);
    if (c.sub) textos.push(`FRASE DE APOIO (menor, abaixo dos tópicos): "${c.sub.toUpperCase()}"`);
  }
  if (!c.logo) textos.push(`NOME DO PROGRAMA em texto simples no topo: "${c.quadro.name.toUpperCase()}" (sem desenhar símbolo nem logotipo)`);

  const composicao =
    f === "thumb"
      ? `COMPOSIÇÃO 16:9
- Região superior (~60%): ${marcas.length ? `o apresentador à esquerda e o logotipo de ${marcaTxt} grande à direita, no lugar do convidado (sem pessoa desse lado)` : solo ? "a pessoa grande à direita" : "as pessoas lado a lado, rostos grandes, nítidos e expressivos"}; fundo de estúdio desfocado.
${c.logo ? "- Logotipo oficial na região superior central, entre as pessoas.\n" : ""}- Região inferior (~40%): a headline gigante, tipografia pesada, condensada e tridimensional, ocupando quase toda a largura útil.
- SEM nomes, SEM data, SEM horário, SEM tópicos nesta versão.`
      : solo
        ? `COMPOSIÇÃO
- A pessoa domina o lado DIREITO; a headline e a chamada dominam o lado ESQUERDO.
${c.logo ? "- Logotipo oficial no canto superior esquerdo.\n" : ""}- "${hora.replace("ÀS ", "")}" e o dia com enorme destaque: a pessoa precisa entender em menos de 2 segundos o programa, o dia e o horário.`
        : `COMPOSIÇÃO
- ${hosts.length ? "Apresentador à esquerda, convidado à direita" : "As pessoas lado a lado"}, enquadramento cinematográfico de meio corpo, rostos grandes na metade de cima.${marcas.length ? ` O convidado é o logotipo de ${marcaTxt}, grande, sem nenhuma pessoa desse lado.` : ""}
${c.logo ? "- Logotipo oficial no topo, centralizado.\n" : ""}- Selo ${c.gravado ? "ESTREIA" : "AO VIVO"}, data, horário e "NO YOUTUBE" na região central, entre as pessoas, sem cobrir rostos.
- Identificação de cada pessoa ao lado dela, discreta, sem disputar com a headline.
- Headline gigante na metade de baixo, ocupando 55% a 90% da largura, sem cobrir rostos; tópicos logo abaixo.`;

  const prompt = `ARTE PROMOCIONAL CINEMATOGRÁFICA PREMIUM — ${quadroNome(c.quadro)}
${f === "thumb" ? `Thumbnail ${c.gravado ? "do episódio" : "da live"} no YouTube` : c.gravado ? "Divulgação da estreia do episódio gravado no YouTube" : "Divulgação do episódio ao vivo no YouTube"}${c.tema ? `, tema: ${c.tema}` : ""}.

FORMATO
${FORMATO[f].texto}
A arte ocupa a tela inteira, de borda a borda: sem faixas vazias, molduras ou barras.

PESSOAS — exatamente ${n} ${n === 1 ? "pessoa" : "pessoas"} na arte, nem mais nem menos:
${descPessoas.join("\n")}
${nosFrames ? `
FRAMES DO EPISÓDIO (${nosFrames}): imagens reais do episódio gravado. O cenário parte do lugar real que eles mostram (fachada, salão, produtos), com o tratamento cinematográfico abaixo. As pessoas dos frames são as mesmas das fotografias: os rostos vêm das fotografias, sem misturar nem inventar.
` : ""}${PRESERVAR}
${logoI ? `\nLOGOTIPO: IMAGEM ${logoI}. Preservar símbolo, tipografia, cores e proporções; não redesenhar nem criar outra versão. Só integrar com luz e sombra suaves.` : "\nNão há logotipo enviado: não desenhe nenhum símbolo ou logo."}
${refsI.length ? `\nREFERÊNCIAS DO EPISÓDIO (use como elementos do cenário, sem copiar textos delas):\n${refsI.join("\n")}` : ""}

IDENTIDADE VISUAL
${ESTILO[c.quadro.id]}
Color grading cinematográfico no cenário: pretos densos, sombras navy, profundidade de campo. Nas pessoas, só um leve recorte de luz âmbar no contorno; pele com a textura e o tom da fotografia.

CENÁRIO
${c.cena ? `${c.cena}\n` : ""}Elementos do tema no segundo plano, desfocados, sem competir com rostos e headline. Telas e documentos só com grafismos abstratos, sem texto legível.

${composicao}

TEXTOS OBRIGATÓRIOS — escrever exatamente assim, em maiúsculas, e nada além disso:
${textos.map((t) => `- ${t}`).join("\n")}
Headline: tipografia sans-serif condensada extrabold, acabamento metálico; ${c.quadro.id === "lado-a-lado-b" ? "primeira linha branco quente, linha de destaque laranja intenso" : c.quadro.id === "pfc-news" ? "branco com destaque amarelo/laranja" : "primeira linha branco metálico, linha de destaque dourado/âmbar"}, sombra profunda e leve profundidade 3D. Headline completa: ${headline}.

${PROIBIDO}

REVISÃO ANTES DE ENTREGAR
${f === "thumb" ? "" : `✓ "${dia}" e "${hora}" exatamente assim — não troque o dia da semana nem a data.\n`}✓ ${n} ${n === 1 ? "pessoa" : "pessoas"}, os rostos idênticos às fotografias: quem conhece a pessoa a reconhece na hora, sem cara de IA.
✓ Ortografia perfeita.`;

  return { prompt, refs };
}

/** Redimensiona para o tamanho final e comprime: Instagram só publica JPEG; a thumb do YouTube aceita até 2 MB. */
export async function jpegFinal(img: Buffer, w: number, h: number): Promise<Buffer> {
  const flat = await sharp(img).resize(w, h, { fit: "cover", position: "attention" }).png().toBuffer();
  for (const quality of [90, 82, 72]) {
    const out = await sharp(flat).jpeg({ quality, mozjpeg: true }).toBuffer();
    if (out.length < 2_000_000) return out;
  }
  throw new Error("Arte acima de 2 MB mesmo comprimida.");
}

/** Caixa 0–1000 com folga de 12% para cada lado (e mais em cima, para não cortar o cabelo). */
async function recortar(frame: Img, box: [number, number, number, number]): Promise<Img> {
  const { width = 1920, height = 1080 } = await sharp(frame.buf).metadata();
  const [y0, x0, y1, x1] = box.map((v) => v / 1000);
  const fw = x1 - x0;
  const fh = y1 - y0;
  const left = Math.max(0, Math.floor((x0 - fw * 0.12) * width));
  const top = Math.max(0, Math.floor((y0 - fh * 0.15) * height));
  const right = Math.min(width, Math.ceil((x1 + fw * 0.12) * width));
  const bottom = Math.min(height, Math.ceil((y1 + fh * 0.05) * height));
  const buf = await sharp(frame.buf).extract({ left, top, width: right - left, height: bottom - top }).jpeg({ quality: 92 }).toBuffer();
  return { buf, mime: "image/jpeg" };
}

/**
 * Quem não tem foto própria ganha um recorte dos frames: o Gemini localiza
 * cada pessoa (e qual é o apresentador) e cada uma vira uma foto separada.
 * Com o frame inteiro o modelo de imagem trocava os rostos (teste de 02/11
 * com o episódio da pizzaria); com uma foto por pessoa, preserva.
 */
export async function fotosDosFrames(pessoas: PessoaCena[], frames: Img[]): Promise<PessoaCena[]> {
  const out = pessoas.map((p) => ({ ...p }));
  const faltam = () => out.filter((p) => !p.img);
  const hostsComFoto = out.filter((p) => p.host && p.img).map((p) => p.img!.buf);
  for (const frame of frames) {
    if (faltam().length === 0) break;
    const achadas = await detectPeople(frame.buf, hostsComFoto).catch(() => []);
    // As maiores primeiro: quem está mais perto da câmera é quem conversa.
    const ordem = achadas.sort((a, b) => (b.box[2] - b.box[0]) * (b.box[3] - b.box[1]) - (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]));
    const livres = [...ordem];
    for (const p of faltam()) {
      // Sem foto do apresentador não dá para saber quem é quem: vai na ordem.
      const i = livres.findIndex((a) => !hostsComFoto.length || a.apresentador === p.host);
      if (i < 0) continue;
      p.img = await recortar(frame, livres[i].box);
      livres.splice(i, 1);
    }
  }
  return out;
}

/**
 * Os três formatos, todos direto das fotos e em paralelo. Recompor a partir
 * do feed gerado (como a thumb fazia) copiava rostos que a IA já tinha
 * alterado e alterava de novo; no story, ainda encaixava o 4:5 com faixas
 * vazias em cima e embaixo.
 */
export async function gerarCenas(c: CenaInput): Promise<{ feed: Buffer; story: Buffer; thumb: Buffer }> {
  if (!c.pessoas.some((p) => p.img && !p.marca) && c.frames.length === 0) {
    throw new Error("Sem foto de ninguém: suba a foto do apresentador ou do convidado, ou tire frames do vídeo.");
  }
  if (c.frames.length && c.pessoas.some((p) => !p.img)) c = { ...c, pessoas: await fotosDosFrames(c.pessoas, c.frames) };
  const um = async (f: FormatoCena) => {
    const { prompt, refs } = montar(c, f);
    const img = await renderWithRefs(prompt, refs, FORMATO[f].aspect);
    return jpegFinal(img, FORMATO[f].w, FORMATO[f].h);
  };
  const [feed, story, thumb] = await Promise.all([um("feed"), um("story"), um("thumb")]);
  return { feed, story, thumb };
}

// ---- Agenda da semana ----

export type CardSemana = {
  quadro: QuadroTheme;
  inicio: string;
  /** Arte aprovada do episódio (feed): a melhor referência de pessoas, logo e cenário. */
  arte: Img | null;
  /** Sem arte aprovada, as fotos e o logo vão direto. */
  pessoas: PessoaCena[];
  gravado: boolean;
  logo: Img | null;
  convidados: { nome: string; papel: string }[];
  apresentadores: string[];
  headline: Headline;
  topicos: string | null;
};

/** Agenda da semana 3:4 (1080×1440): cabeçalho, um card por episódio, rodapé AO VIVO NO YOUTUBE. */
export async function gerarCenaSemana(cards: CardSemana[], logoPfc: Img | null, primeiroHoje: boolean): Promise<Buffer> {
  if (cards.length === 0) throw new Error("Nenhum episódio confirmado nesta semana.");
  const refs: ImagemRef[] = [];
  const add = (legenda: string, img: Img) => {
    refs.push({ legenda, data: img.buf, mime: img.mime });
    return refs.length;
  };
  const logoI = logoPfc ? add("LOGOTIPO OFICIAL PFC — PAPO FORA DA CAIXA.", logoPfc) : null;

  const linhasRevisao: string[] = [];
  const blocos = cards.map((k, idx) => {
    const p = partesData(k.inicio);
    const diaSemana = diaCompleto(k.inicio);
    const hojeAqui = primeiroHoje && idx === 0;
    const horario = `ÀS ${p.hora}`;
    const quem = k.convidados.length ? k.convidados.map((c) => c.nome).join(" E ") : null;
    linhasRevisao.push(`${p.dia} — ${diaSemana} — ${p.hora} — ${k.quadro.name.toUpperCase()}${quem ? ` COM ${quem.toUpperCase()}` : ""}`);

    const imgs: string[] = [];
    if (k.arte) imgs.push(`IMAGEM ${add(`ARTE ORIGINAL do episódio ${k.quadro.name} de ${p.dia} — referência de pessoas, logotipo e cenário.`, k.arte)} (arte original do episódio: use as pessoas, o logotipo e o clima dela)`);
    else {
      for (const pe of k.pessoas.filter((x): x is PessoaCena & { img: Img } => !!x.img)) imgs.push(
          pe.marca
            ? `IMAGEM ${add(`LOGOTIPO de ${pe.nome} (convidado — clube/empresa, NÃO é uma pessoa) — card ${idx + 1}.`, pe.img)} (logotipo de ${pe.nome}, sem desenhar pessoa para representá-lo)`
            : `IMAGEM ${add(`FOTOGRAFIA de ${pe.nome} (${pe.host ? "apresentador" : "convidado"}) — card ${idx + 1}.`, pe.img)} (${pe.nome}, ${pe.papel})`
        );
      if (k.logo) imgs.push(`IMAGEM ${add(`LOGOTIPO OFICIAL do ${k.quadro.name}.`, k.logo)} (logotipo do ${k.quadro.name})`);
    }
    const h = [k.headline.l1, k.headline.l2, k.headline.l3].filter(Boolean).join(" ");
    return `CARD ${idx + 1} — ${k.quadro.name.toUpperCase()}
Referências: ${imgs.join("; ") || "nenhuma"}
Participantes: ${[...k.apresentadores.map((a) => `${a} (apresentador, à esquerda)`), ...k.convidados.map((c) => `${c.nome} — ${c.papel} (convidado, à direita)`)].join("; ")}
Textos obrigatórios:
- DATA (enorme, branco e dourado): "${p.dia}"
- DIA: "${diaSemana}"
- HORÁRIO: "${[hojeAqui && "HOJE", k.gravado && "ESTREIA", horario].filter(Boolean).join(" ")}"
- PROGRAMA: logotipo ou nome "${k.quadro.name.toUpperCase()}"
${quem ? `- CONVIDADO: "${quem.toUpperCase()}"${k.convidados[0]?.papel ? ` e, menor, "${k.convidados.map((c) => c.papel.toUpperCase()).join(" | ")}"` : ""}\n` : ""}- HEADLINE: "${h}"
${k.topicos ? `- TÓPICOS (pequeno): "${k.topicos.toUpperCase()}"\n` : ""}Estilo do card: ${ESTILO[k.quadro.id]}`;
  });

  const prompt = `ARTE DA AGENDA DA SEMANA — PFC | PAPO FORA DA CAIXA
Cinematic premium 4K, Instagram feed vertical 3:4 (1080 × 1440), margens de segurança de 60 px, tipografia grande e legível no celular.

OBJETIVO
Uma única arte com a programação da semana: ${cards.length} ${cards.length === 1 ? "card horizontal" : "cards horizontais empilhados verticalmente"}, na ordem cronológica abaixo, com bordas luminosas e separação equilibrada. Use as imagens fornecidas como referência de participantes, logotipos e identidade de cada programa.

CABEÇALHO
${logoI ? `Logotipo oficial (IMAGEM ${logoI}) no topo, centralizado, sem redesenhar.` : 'Sem logotipo enviado: escreva "PFC — PAPO FORA DA CAIXA" em texto, sem desenhar símbolo.'}
Título "AGENDA DA SEMANA" em tipografia condensada extrabold, metálico branco e dourado.

IDENTIDADE GERAL
Fundo azul-marinho e preto profundo, reflexos azul elétrico e ciano, iluminação âmbar e laranja, textos brancos e dourados, contraste elevado, atmosfera de estúdio audiovisual. Cada card mantém a identidade do próprio programa. Dentro de cada card, as pessoas de um lado e a data grande num box à direita.

${blocos.join("\n\n")}

RODAPÉ
Uma única faixa centralizada: "▶ AO VIVO NO YOUTUBE", com o ícone vermelho oficial do YouTube.

HIERARQUIA
1. AGENDA DA SEMANA  2. As datas  3. Dias e horários  4. Programas e convidados  5. Headlines  6. Tópicos  7. AO VIVO NO YOUTUBE

${PRESERVAR}
- Cada pessoa aparece só no próprio card.

${PROIBIDO}

REVISÃO OBRIGATÓRIA — as datas e os dias da semana abaixo estão CORRETOS e devem ser reproduzidos exatamente, nesta ordem:
${linhasRevisao.map((l) => `✓ ${l}`).join("\n")}
Não alterar, inverter ou inventar datas, dias da semana ou horários.`;

  const img = await renderWithRefs(prompt, refs, "3:4");
  return jpegFinal(img, 1080, 1440);
}
