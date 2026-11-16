/**
 * Onde a marca do patrocinador aparece ("placements") e o que cada produto
 * inclui. Alimenta os mockups (PlacementMockup), a tabela comparativa dos
 * planos e o "o que inclui" do Monte seu plano.
 *
 * Planos são cumulativos: o Patrocinador tem tudo do Apoio e o Master tudo do
 * Patrocinador. A página e o QR valem para todo parceiro (/parcerias).
 */

export type PlacementId =
  | "vinheta"
  | "estudio"
  | "mencao"
  | "qr"
  | "thumb"
  | "short"
  | "story"
  | "collab"
  | "descricao"
  | "creditos"
  | "pagina"
  | "relatorio"
  | "visita";

export type Placement = { titulo: string; onde: string; descricao: string };

/** Na ordem em que aparecem nas galerias. */
export const PLACEMENTS: Record<PlacementId, Placement> = {
  vinheta: {
    titulo: "Vinheta “apresentado por”",
    onde: "Abertura e encerramento do quadro",
    descricao: "O quadro entra no ar com o nome da sua marca: “PFC Esporte Clube apresentado por…”.",
  },
  estudio: {
    titulo: "Logo no estúdio",
    onde: "Bancada e telão do cenário",
    descricao: "Sua logo fica no cenário durante o episódio inteiro, em todo enquadramento aberto.",
  },
  mencao: {
    titulo: "Menção do apresentador",
    onde: "Durante o episódio, com tarja na tela",
    descricao: "O apresentador fala da sua marca com as palavras dele, e a tarja com o seu nome aparece junto.",
  },
  qr: {
    titulo: "QR code na tela",
    onde: "Canto da tela, no momento da menção",
    descricao: "Quem assiste aponta o celular e cai na página da sua marca. Cada leitura é contada.",
  },
  thumb: {
    titulo: "Selo na thumbnail",
    onde: "Capa do episódio no YouTube",
    descricao: "O selo “apresentado por” vai na capa, que é o que aparece na busca e nas recomendações.",
  },
  short: {
    titulo: "Marca nos cortes e shorts",
    onde: "YouTube Shorts, Reels e TikTok",
    descricao: "Os vídeos curtos que saem do episódio levam a sua marca e circulam a semana inteira.",
  },
  story: {
    titulo: "Stories com link",
    onde: "Instagram do PFC",
    descricao: "Story de divulgação com figurinha de link para o seu perfil, site ou WhatsApp.",
  },
  collab: {
    titulo: "Post em collab",
    onde: "Feed do Instagram",
    descricao: "O post sai no perfil do PFC e no seu ao mesmo tempo, somando as duas audiências.",
  },
  descricao: {
    titulo: "Link na descrição",
    onde: "Descrição do vídeo no YouTube",
    descricao: "Seu link fica fixo na descrição do episódio, enquanto o vídeo existir.",
  },
  creditos: {
    titulo: "Logo nos créditos",
    onde: "Tela final do episódio",
    descricao: "Sua logo entre os apoiadores, na tela que fecha o episódio.",
  },
  pagina: {
    titulo: "Página da sua marca",
    onde: "pfctv.com.br/parceiros/sua-marca",
    descricao: "Página própria com logo, texto, endereço e botão de WhatsApp. É para lá que o QR leva.",
  },
  relatorio: {
    titulo: "Relatório de resultados",
    onde: "Enviado todo mês",
    descricao: "Views das peças, leituras do QR e cliques no WhatsApp, por período. Preto no branco.",
  },
  visita: {
    titulo: "PFC Visita",
    onde: "Episódio gravado no seu espaço",
    descricao: "A câmera vai até o seu negócio e você mostra o que faz no seu próprio ambiente.",
  },
};

export const PLACEMENT_IDS = Object.keys(PLACEMENTS) as PlacementId[];

const APOIO: PlacementId[] = ["mencao", "story", "descricao", "qr", "pagina"];
const PATROCINADOR: PlacementId[] = [...APOIO, "estudio", "short", "collab"];
const MASTER: PlacementId[] = [...PATROCINADOR, "relatorio"];

/** O que cada produto põe no ar. */
export const INCLUI: Record<string, PlacementId[]> = {
  "plano:apoio": APOIO,
  "plano:patrocinador": PATROCINADOR,
  "plano:master": MASTER,
  "cota:master": ["vinheta", "estudio", "thumb", "mencao", "short", "qr", "pagina", "relatorio"],
  "cota:apoio": ["mencao", "creditos", "descricao", "story"],
  visita: ["visita", "short", "descricao"],
};

const ordem = (ids: Iterable<PlacementId>) => {
  const set = new Set(ids);
  return PLACEMENT_IDS.filter((id) => set.has(id));
};

/** Placements de um conjunto de produtos (chaves de INCLUI), sem repetição e na ordem da galeria. */
export const placementsDe = (produtos: string[]) => ordem(produtos.flatMap((p) => INCLUI[p] ?? []));

export const tituloDos = (ids: PlacementId[]) => ids.map((id) => PLACEMENTS[id].titulo);

/**
 * Tabela "o que cada plano inclui". `true` = incluso, texto = incluso com
 * ressalva, `false` = não tem. `placement` liga a linha ao mockup.
 */
export const COMPARATIVO: {
  item: string;
  placement?: PlacementId;
  apoio: boolean | string;
  patrocinador: boolean | string;
  master: boolean | string;
}[] = [
  { item: "Menção do apresentador", placement: "mencao", apoio: "Pontual", patrocinador: "Nos episódios", master: "Todos, inclusive ao vivo" },
  { item: "Página da marca + QR na tela", placement: "qr", apoio: true, patrocinador: true, master: true },
  { item: "Link na descrição do YouTube", placement: "descricao", apoio: true, patrocinador: true, master: true },
  { item: "Stories com link", placement: "story", apoio: "Divulgação", patrocinador: "Com chamada", master: "Com chamada" },
  { item: "Logo no estúdio", placement: "estudio", apoio: false, patrocinador: true, master: "Em destaque" },
  { item: "Marca nos cortes e shorts", placement: "short", apoio: false, patrocinador: true, master: true },
  { item: "Post em collab no Instagram", placement: "collab", apoio: false, patrocinador: "Possível", master: "Possível" },
  { item: "Relatório de resultados", placement: "relatorio", apoio: false, patrocinador: false, master: true },
  { item: "Episódio temático e conteúdos especiais", apoio: false, patrocinador: false, master: true },
  { item: "Exclusividade no seu segmento", apoio: false, patrocinador: false, master: true },
  { item: "Prioridade na agenda do PFC Visita", placement: "visita", apoio: false, patrocinador: false, master: true },
];
