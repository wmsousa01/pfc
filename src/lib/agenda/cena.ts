import "server-only";
import sharp from "sharp";
import { CAP, anton, fit } from "@/lib/producao/compose";
import { conferirPessoas, detectPeople, renderWithRefs, type AspectRatio, type ImagemRef } from "@/lib/producao/gemini";
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
/**
 * `img` null: a pessoa não tem foto própria e aparece nos frames do episódio.
 * `marca`: o convidado é clube, empresa ou instituição e `img` é o logo dele —
 * entra na arte como logo com o nome, nunca como uma pessoa desenhada.
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

/**
 * Onde entra o escudo do convidado que é clube ou empresa (px do tamanho
 * final). O modelo não recebe o escudo — com ele, insistia em pôr alguém com
 * a camisa do clube ou repetir o apresentador (três tentativas seguidas em
 * 09/11, todas rejeitadas pela conferência). Ele só deixa o espaço vazio e o
 * escudo real entra por cima, em `aplicarMarca`.
 */
const VAGA: Record<FormatoCena, { cx: number; cy: number; d: number; nome: boolean }> = {
  feed: { cx: 820, cy: 560, d: 380, nome: true },
  story: { cx: 810, cy: 900, d: 400, nome: true },
  thumb: { cx: 1010, cy: 250, d: 360, nome: false },
};

function vagaTexto(f: FormatoCena, nome: string): string {
  const { w, h } = FORMATO[f];
  const v = VAGA[f];
  const pct = (n: number, t: number) => Math.round((n / t) * 100);
  const fim = v.cy + v.d / 2 + (v.nome ? 110 : 0);
  return `ESPAÇO RESERVADO PARA O ESCUDO DE ${nome.toUpperCase()}: a região de ${pct(v.cx - v.d / 2, w)}% a ${pct(v.cx + v.d / 2, w)}% da largura e de ${pct(v.cy - v.d / 2, h)}% a ${pct(fim, h)}% da altura fica VAZIA — só o cenário desfocado e escuro, sem pessoa, sem objeto, sem texto, sem logotipo. O escudo e o nome do convidado serão aplicados ali depois, por cima.`;
}

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
  const pessoas = c.pessoas.filter((p) => !p.marca);
  const hosts = pessoas.filter((p) => p.host);
  const convidados = pessoas.filter((p) => !p.host);
  const solo = pessoas.length === 1;
  const n = pessoas.length;

  const framesI = c.frames.slice(0, 3).map((fr) => add("FRAME DO EPISÓDIO GRAVADO — as pessoas reais e o lugar.", fr));
  const nosFrames = framesI.length ? `IMAGEM ${framesI.join(", ")}` : null;

  // Posições: apresentador(es) à esquerda, convidado(s) à direita. Sozinho, à direita com o texto à esquerda.
  const descPessoas = pessoas.map((p) => {
    const lado = solo ? "à DIREITA, grande, da cintura ou do peito para cima" : p.host ? "à ESQUERDA" : "à DIREITA, em primeiro plano, com presença dominante";
    if (!p.img) return `- ${p.nome} — ${p.papel}: sem foto própria; é ${p.host ? "o apresentador" : "o convidado (o dono ou responsável pelo lugar)"} que aparece nos frames do episódio (${nosFrames}). Recorte dele dos frames. Posicionar ${lado}.`;
    const i = add(`FOTOGRAFIA de ${p.nome} (${p.host ? "apresentador" : "convidado"}).`, p.img);
    return `- IMAGEM ${i}: ${p.nome} — ${p.papel}. Posicionar ${lado}.`;
  });
  // O escudo não vai para o modelo (ver VAGA): ele só reserva o espaço.
  const descMarcas = marcas.slice(0, 1).map(
    (m) =>
      `- ${m.nome} — ${m.papel}: é um clube/empresa, NÃO uma pessoa. ${vagaTexto(f, m.nome)} NÃO desenhar nenhuma pessoa para representar ${m.nome} — nem jogador, nem torcedor, nem alguém com o uniforme ou as cores dele. Ninguém da arte veste uniforme de time nem leva escudo na roupa: cada pessoa usa exatamente a roupa da própria fotografia.`
  );
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
    if (!solo || convidados.length || marcas.length)
      // O nome do clube/empresa entra junto com o escudo, em aplicarMarca.
      for (const p of pessoas) textos.push(`IDENTIFICAÇÃO: "${p.nome.toUpperCase()}" e, menor, "${p.papel.toUpperCase()}"`);
    if (c.topicos) textos.push(`TÓPICOS (linha abaixo da headline): "${c.topicos.toUpperCase()}"`);
    if (c.sub) textos.push(`FRASE DE APOIO (menor, abaixo dos tópicos): "${c.sub.toUpperCase()}"`);
  }
  if (!c.logo) textos.push(`NOME DO PROGRAMA em texto simples no topo: "${c.quadro.name.toUpperCase()}" (sem desenhar símbolo nem logotipo)`);

  const composicao =
    f === "thumb"
      ? // No padrão das thumbs que a equipe usa de referência (A×B, GOC, Empreendedorismo Feminino).
        `COMPOSIÇÃO 16:9 — THUMB DE ALTO CTR, LEGÍVEL EM MINIATURA
- ${
          marcas.length
            ? `${solo ? `${pessoas[0].nome} grande à ESQUERDA, UMA única vez, até no máximo 55% da largura` : "As pessoas à esquerda, até no máximo 55% da largura"}. À DIREITA fica o espaço reservado do escudo (ver PESSOAS): sem pessoa, não repetir ${solo ? pessoas[0].nome : "ninguém"}.`
            : solo && !hosts.length
              ? "A pessoa ENORME do lado DIREITO, rosto ocupando quase metade da altura, olhando para a câmera; a headline alinhada à esquerda, no lado oposto."
              : n >= 3
                ? `As ${n} pessoas lado a lado numa fileira, ombro a ombro, cabeças grandes e na mesma altura, ocupando os ~55% de cima.`
                : "Apresentador à ESQUERDA e convidado à DIREITA, cada um ocupando quase um terço da largura, enquadrados do peito para cima, cabeças grandes perto do topo, os dois quase se encostando no centro."
        }
- ${solo ? "Rosto" : "Rostos"} com pelo menos 30% da altura da imagem, ${solo ? "nítido" : "nítidos"}, contraste alto e luz de recorte no contorno${solo ? "" : " (azul de um lado, âmbar do outro)"}. Os ombros podem passar por trás da headline.
- Fundo temático, não um estúdio genérico: ${solo ? "um universo ligado ao tema" : "atrás de cada pessoa um universo ligado ao tema ou ao que ela representa (ex.: servidores e fibra óptica de um lado, cosmos do outro)"}, desfocado e fundido no centro. Nos cantos inferiores, silhuetas escuras de elementos do tema, sem chamar atenção.
${c.logo ? "- Logotipo oficial pequeno-médio no topo, centralizado entre as cabeças, sem tocar nos rostos.\n" : ""}- Headline ocupando os ~40% de baixo, centralizada e quase de borda a borda (90% da largura), em ${h.l3 ? "três" : "duas"} linhas: ${h.l3 ? "a primeira menor, a do meio a MAIOR e na cor de destaque com brilho, a terceira grande" : "a primeira menor, a segunda a MAIOR e na cor de destaque com brilho"}; letras grossas, sombra forte, legível num celular.
- Faixa fina de luz na base da imagem. Nada de cartela, moldura ou caixa atrás da headline.
- SEM nomes, SEM data, SEM horário, SEM tópicos nesta versão.`
      : marcas.length
        ? `COMPOSIÇÃO
- ${solo ? `${pessoas[0].nome} à ESQUERDA, UMA única vez, até no máximo 55% da largura, com a identificação dele embaixo` : "As pessoas à esquerda, até no máximo 55% da largura, cada uma com a identificação embaixo"}.
- À DIREITA, o espaço reservado do escudo (ver PESSOAS), vazio. Nesse lado NÃO há pessoa nenhuma.
${c.logo ? "- Logotipo oficial no topo, centralizado.\n" : ""}- Selo ${c.gravado ? "ESTREIA" : "AO VIVO"}, data, horário e "NO YOUTUBE" no alto, centralizados, logo abaixo do logotipo do programa e ACIMA do espaço reservado, sem cobrir o rosto.
- Headline gigante na metade de baixo, ocupando 55% a 90% da largura; tópicos logo abaixo.`
        : solo
        ? `COMPOSIÇÃO
- A pessoa domina o lado DIREITO; a headline e a chamada dominam o lado ESQUERDO.
${c.logo ? "- Logotipo oficial no canto superior esquerdo.\n" : ""}- "${hora.replace("ÀS ", "")}" e o dia com enorme destaque: a pessoa precisa entender em menos de 2 segundos o programa, o dia e o horário.`
        : `COMPOSIÇÃO
- ${hosts.length ? "Apresentador à esquerda, convidado à direita" : "As pessoas lado a lado"}, enquadramento cinematográfico de meio corpo, rostos grandes na metade de cima.
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
${descMarcas.length ? `\nCONVIDADO SEM PESSOA (${n} ${n === 1 ? "pessoa" : "pessoas"} acima é o total — esta parte não conta como pessoa):\n${descMarcas.join("\n")}\n` : ""}${nosFrames ? `
FRAMES DO EPISÓDIO (${nosFrames}): imagens reais do episódio gravado. O cenário parte do lugar real que eles mostram (fachada, salão, produtos), com o tratamento cinematográfico abaixo. As pessoas dos frames são as mesmas das fotografias: os rostos vêm das fotografias, sem misturar nem inventar.
` : ""}${PRESERVAR}
${logoI ? `\nLOGOTIPO: IMAGEM ${logoI}. Preservar símbolo, tipografia, cores e proporções; não redesenhar nem criar outra versão (as letras mantêm a cor original da imagem, sem escurecer, dourar ou metalizar). Nenhum texto a mais junto do logotipo (nada de slogan ou nome do programa embaixo). Aparece UMA vez só, no lugar indicado — não estampar em bola, camisa, troféu ou outro objeto. Só integrar com luz e sombra suaves.` : "\nNão há logotipo enviado: não desenhe nenhum símbolo ou logo."}
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
${marcas.length ? `✓ ${marcas.map((m) => m.nome).join(" e ")} aparece só como logotipo — se houver uma pessoa a mais representando o convidado, apague e coloque o logotipo no lugar.\n` : ""}✓ Ortografia perfeita.`;

  return { prompt, refs };
}

/**
 * O escudo real do clube/empresa como um selo redondo (o perfil do Instagram
 * vem quadrado, com fundo), aro branco e brilho na cor do quadro, no espaço
 * que o modelo deixou vazio. No feed e no story, o nome e o papel embaixo.
 */
async function aplicarMarca(arte: Buffer, f: FormatoCena, m: PessoaCena, t: QuadroTheme): Promise<Buffer> {
  const { w, h } = FORMATO[f];
  const { cx, cy, d, nome } = VAGA[f];
  const aro = Math.round(d * 0.03);
  const dentro = d - 2 * aro;
  const circulo = (s: number) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);
  const escudo = await sharp(m.img!.buf)
    .rotate()
    .resize(dentro, dentro, { fit: "cover" })
    .composite([{ input: circulo(dentro), blend: "dest-in" }])
    .png()
    .toBuffer();

  const font = anton();
  let texto = "";
  if (nome) {
    const n = m.nome.toUpperCase();
    const p = m.papel.toUpperCase();
    const fn = fit(n, d + 160, 62);
    const fp = fit(p, d + 160, 34);
    const y1 = cy + d / 2 + 34 + fn.size * CAP;
    const y2 = y1 + 14 + fp.size * CAP;
    texto = `<path d="${font.getPath(n, cx - fn.width / 2, y1, fn.size).toPathData(2)}" fill="#fff" filter="url(#sombra)"/>
<path d="${font.getPath(p, cx - fp.width / 2, y2, fp.size).toPathData(2)}" fill="${t.accent[1]}" filter="url(#sombra)"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs>
  <filter id="brilho" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${Math.round(d * 0.07)}"/></filter>
  <filter id="sombra" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000" flood-opacity="0.8"/></filter>
</defs>
<circle cx="${cx}" cy="${cy}" r="${d / 2 + aro * 2}" fill="${t.glow}" opacity="0.55" filter="url(#brilho)"/>
<circle cx="${cx}" cy="${cy + 8}" r="${d / 2}" fill="#000" opacity="0.6" filter="url(#brilho)"/>
<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="#fff"/>
${texto}
</svg>`;
  const flat = await sharp(arte)
    .composite([
      { input: Buffer.from(svg), left: 0, top: 0 },
      { input: escudo, left: Math.round(cx - dentro / 2), top: Math.round(cy - dentro / 2) },
    ])
    .png()
    .toBuffer();
  return jpegFinal(flat, w, h);
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
  // Conferência só com quem tem foto (quem vem dos frames sem recorte não dá para comparar).
  const comFoto = c.pessoas.filter((p) => !p.marca && p.img);
  const conferir = comFoto.length === c.pessoas.filter((p) => !p.marca).length;
  const marcas = c.pessoas.filter((p) => p.marca).map((p) => p.nome);
  const proibido = marcas.length ? `alguém vestindo o uniforme ou a camisa de ${marcas.join(" ou ")}, ou com o escudo dele na roupa` : null;
  const um = async (f: FormatoCena) => {
    const { prompt, refs } = montar(c, f);
    let img = await renderWithRefs(prompt, refs, FORMATO[f].aspect);
    if (conferir) {
      const fotos = comFoto.map((p) => ({ nome: p.nome, data: p.img!.buf, mime: p.img!.mime }));
      // Até duas novas tentativas; cabe no maxDuration de 300 s da página.
      for (let tentativa = 1; tentativa <= 2; tentativa++) {
        const r = await conferirPessoas(img, fotos, proibido);
        if (r.ok) break;
        console.warn(`[agenda/arte] ${f} rejeitada (tentativa ${tentativa}): ${r.motivo}`);
        const extra = `\n\nATENÇÃO — a tentativa anterior foi rejeitada por: ${r.motivo || "pessoa a mais ou repetida"}. Corrija isso: só ${fotos.map((p) => p.nome).join(" e ")}, uma vez cada${marcas.length ? `, e ${marcas.join(" e ")} só como escudo` : ""}.`;
        // Se a nova tentativa falhar, fica a anterior: melhor uma arte para revisar do que nenhuma.
        const nova = await renderWithRefs(prompt + extra, refs, FORMATO[f].aspect).catch((e) => {
          console.warn(`[agenda/arte] ${f}: nova tentativa falhou: ${e instanceof Error ? e.message : e}`);
          return null;
        });
        if (!nova) break;
        img = nova;
      }
    }
    const final = await jpegFinal(img, FORMATO[f].w, FORMATO[f].h);
    const marca = c.pessoas.find((p) => p.marca && p.img);
    return marca ? aplicarMarca(final, f, marca, c.quadro) : final;
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
            ? `IMAGEM ${add(`LOGOTIPO de ${pe.nome} (convidado — instituição, NÃO é uma pessoa) — card ${idx + 1}.`, pe.img)} (logotipo de ${pe.nome}: usar como logo, sem desenhar pessoa para representá-lo)`
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
