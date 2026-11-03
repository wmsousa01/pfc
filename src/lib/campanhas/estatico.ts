import "server-only";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { IMAGE_MODEL, renderWithRefs, type ImagemRef } from "@/lib/producao/gemini";
import { LOGO_PATH, download, upload } from "@/lib/producao/store";
import { CAMPANHAS_DIR, CTAS, addCriativo, bytesDe, getCriativo, type Criativo, type Estrategia, type Formato } from "./store";

export type PedidoEstatico = {
  formato: Formato;
  headline: string;
  apoio: string;
  /** Texto do botão desenhado na peça (não é o botão da Meta). */
  chamada: string;
  /** Imagens da biblioteca usadas como referência (fotos reais, peça anterior). */
  refs: string[];
  instrucao: string;
  comLogo: boolean;
  /** Peça do plano que esta geração cumpre (plano.ts). */
  peca: string | null;
};

/** Tamanho final de cada formato, no padrão da Meta. */
const TAMANHO: Record<Formato, [number, number]> = {
  "9:16": [1080, 1920],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

async function refDe(c: Criativo): Promise<ImagemRef | null> {
  // De vídeo, a miniatura pública (Contenta/Drive) serve de referência.
  const raw =
    c.tipo === "imagem"
      ? (await bytesDe(c, 30 * 1024 * 1024)).buf
      : c.thumb_url
        ? Buffer.from(await (await fetch(c.thumb_url, { cache: "no-store" })).arrayBuffer())
        : null;
  if (!raw) return null;
  try {
    const data = await sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toBuffer();
    return { legenda: `foto/peça de referência "${c.nome}" — pessoas e lugar REAIS, mantenha rostos idênticos`, data, mime: "image/jpeg" };
  } catch {
    return null;
  }
}

function prompt(p: PedidoEstatico, e: Estrategia | null, refs: ImagemRef[], logo: boolean): string {
  const vertical = p.formato === "9:16";
  return `Crie um ANÚNCIO ESTÁTICO pronto para Meta Ads (Instagram/Facebook), proporção ${p.formato}, para o "Fora da Caixa" — podcast e mídia local de Mogi Guaçu (SP).
${e ? `Campanha: ${e.nome}. Público: ${e.publico}. Oferta: ${e.oferta}. Mensagem-chave: ${e.mensagem}.` : ""}

TEXTO DA PEÇA (escreva EXATAMENTE assim, com acentos e cedilha corretos, nada além disso):
- Headline grande: "${p.headline}"
${p.apoio ? `- Linha de apoio menor: "${p.apoio}"` : ""}
${p.chamada ? `- Botão/etiqueta de ação: "${p.chamada}"` : ""}

Identidade: fundo escuro (preto e azul-marinho profundo), destaque em dourado #FFD700, tipografia condensada pesada e legível no celular, alto contraste, visual de estúdio de podcast premium e cinematográfico.
Composição: no máximo 3 blocos de texto; texto ocupando menos de 25% da área; ${
    vertical ? "deixe livres os 14% de cima e os 20% de baixo (a interface do Stories/Reels cobre essas faixas)" : "margem de segurança de 5% em volta"
  }.
${refs.length ? `Use as imagens de referência: as PESSOAS e LUGARES são reais — mantenha rostos, roupas e traços idênticos, não invente pessoas novas e não duplique ninguém.` : "Sem imagens de referência: use um cenário de estúdio de podcast, sem rostos reconhecíveis."}
${logo ? `A última imagem é o LOGO oficial: aplique-o pequeno num canto, sem redesenhar.` : "Não desenhe nenhum logo nem marca."}
Proibido: textos extras, marcas d'água, logos inventados, mãos deformadas, letras tortas.
${p.instrucao ? `Pedido da equipe: ${p.instrucao}` : ""}`;
}

/** Gera a peça, grava no Storage e devolve o criativo novo da biblioteca. */
export async function gerarEstatico(p: PedidoEstatico, e: Estrategia | null, actor: string): Promise<Criativo> {
  if (!p.headline.trim()) throw new Error("Escreva a headline da peça.");
  const refs: ImagemRef[] = [];
  for (const id of p.refs.slice(0, 3)) {
    const c = await getCriativo(id);
    const r = c ? await refDe(c).catch(() => null) : null;
    if (r) refs.push(r);
  }
  const logo = p.comLogo ? await download(LOGO_PATH) : null;
  if (logo) refs.push({ legenda: "logo oficial do Fora da Caixa", data: await sharp(logo).png().toBuffer(), mime: "image/png" });

  const aspect = p.formato;
  const raw = await renderWithRefs(prompt(p, e, refs, !!logo), refs, aspect, "2K");
  const [w, h] = TAMANHO[p.formato];
  const jpg = await sharp(raw).resize(w, h, { fit: "cover" }).jpeg({ quality: 92 }).toBuffer();

  const path = `${CAMPANHAS_DIR}/gerados/${randomUUID()}.jpg`;
  await upload(path, jpg, "image/jpeg");
  return addCriativo({
    nome: p.headline.slice(0, 80),
    tipo: "imagem",
    origem: "gerado",
    ref: path,
    thumb_url: null,
    mime: "image/jpeg",
    tamanho: jpg.length,
    duracao_s: null,
    formato: p.formato,
    ...(p.peca ? { peca: p.peca } : {}),
    gerado_com: { ...p, estrategia: e?.nome ?? null, cta: e ? CTAS[e.cta] : null, modelo: IMAGE_MODEL },
    created_by: actor,
  });
}
