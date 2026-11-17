/**
 * Configuração central do Fora da Caixa.
 * Marca-mãe: "Fora da Caixa" (ecossistema). "Papo Fora da Caixa" é um dos quadros.
 */

export const site = {
  brand: "Fora da Caixa",
  brandShort: "PFC",
  tagline: "As melhores ideias não cabem em quatro paredes.",
  location: "Mogi Guaçu · SP",
  description:
    "O ecossistema de conteúdo regional de Mogi Guaçu: lives semanais, quadros especializados e Shorts diários. Assista, ouça e conecte sua marca à conversa da cidade.",
  /**
   * Host canônico. É `www`: o apex responde 308 para ele, e cada hop a mais
   * é uma chance a mais de falhar num QR impresso lido com conexão ruim.
   * Sai de NEXT_PUBLIC_SITE_URL para não haver dois lugares dizendo o domínio.
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.pfctv.com.br").replace(
    /\/$/,
    ""
  ),
};

/** Canal do YouTube (channel_id resolvido a partir de @PapoForadaCaixa). */
export const youtube = {
  handle: "@PapoForadaCaixa",
  channelId: process.env.YOUTUBE_CHANNEL_ID ?? "UCskyIZf6RflDfhUjYZ865Jw",
  channelUrl: "https://www.youtube.com/@PapoForadaCaixa",
};

/** Tamanho mínimo de senha. Vale para o admin, o revendedor e a recuperação. */
export const MIN_PASSWORD_LENGTH = 8;

export const whatsappNumber = "5519989331908";

export function whatsapp(message: string): string {
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const social = {
  youtube: "https://www.youtube.com/@PapoForadaCaixa",
  instagram: "https://www.instagram.com/papoforadacaixapdc",
  instagramHandle: "@papoforadacaixapdc",
  whatsapp: whatsapp("Vim pelo site do Fora da Caixa e quero saber mais"),
};

/**
 * Números do canal — RESERVA. O site lê os números ao vivo do YouTube via
 * `getChannelStats()` (lib/channel-stats.ts, renova de hora em hora); estes
 * valores só aparecem quando a leitura falha (canal desconectado em
 * /admin/producao/config, sem o escopo do Analytics ou API fora do ar).
 *
 * `subscribers`, `totalVideos` e `totalViews` foram reconferidos em 04/08/2026
 * direto na página pública do canal (bloco aboutChannelViewModel) — os valores
 * do Media Kit de Junho/2026 estavam defasados para menos. Os demais saem do
 * YouTube Studio e não têm equivalente público: só dá para atualizá-los de
 * dentro do Studio.
 */
export const channelStats = {
  subscribers: "1,53 mil",
  totalVideos: "2.650",
  totalViews: "825.187",
  views12m: "806 mil",
  watchHoursYear: "4.474",
  likes12m: "11.319",
  weeklyContent: "~44",
  bestMonth: "158 mil",
  bestMonthLabel: "Fevereiro/2026",
  activeSince: "Abril/2025",
};

/**
 * Situação da cota master de um quadro na vitrine de /parcerias.
 * "negociacao" segura a cota sem dizer quem é; "vendida" mostra o nome em `sponsor`.
 */
export type CotaStatus = "disponivel" | "negociacao" | "vendida";

/**
 * Logo do quadro, o mesmo enviado em /admin/producao/config (sem logo próprio,
 * vale o do PFC). Use sempre isto para mostrar logo de quadro no site.
 */
export const quadroLogo = (slugOuId: string) => `/api/quadros/${slugOuId}/logo`;

/** Os quadros do ecossistema. */
export type Quadro = {
  slug: string;
  name: string;
  emoji: string;
  format: string;
  host: string;
  description: string;
  episodes: string[];
  sponsorProfile: string;
  accent: string; // classe tailwind de cor de destaque
  /** Selo de "novo" na vitrine. */
  isNew?: boolean;
  /** Patrocínio por quadro. Sem isto, o quadro não entra na vitrine de cotas. */
  cota?: { status: CotaStatus; sponsor?: string };
  /**
   * Cotas de apoio por modalidade (quadro com host em rodízio): a marca apoia
   * só os episódios daquela modalidade. Sem exclusividade entre modalidades.
   */
  modalidades?: { nome: string; status: CotaStatus; sponsor?: string }[];
};

export const quadros: Quadro[] = [
  {
    slug: "papo-fora-da-caixa",
    name: "Papo Fora da Caixa",
    emoji: "🎙️",
    format: "Comportamento, marketing e pessoas",
    host: "Willian Marinho",
    description:
      "O quadro fundador do canal. Conversas abertas sobre marketing, comportamento humano, tendências e propósito — com convidados de universos completamente diferentes do apresentador.",
    episodes: [
      "Especialistas em posicionamento digital",
      "Debates sobre comportamento e lifestyle",
      "Marketing para negócios locais",
    ],
    sponsorProfile:
      "Agências de marketing, negócios locais, consultorias, coworkings, eventos corporativos.",
    accent: "gold",
    cota: { status: "disponivel" },
  },
  {
    slug: "lado-a-lado-b",
    name: "Lado A Lado B",
    emoji: "🎵",
    format: "Empreendedorismo, cultura e histórias de vida",
    host: "Willian Marinho e convidados",
    description:
      "O programa que mostra os dois lados de uma história — o lado A público e o lado B dos bastidores. Empreendedores, artistas e personalidades regionais compartilham suas trajetórias.",
    episodes: [
      "Ronaldinho: Último Moleque de Rua?",
      "O Mundo por Trás das Raves",
      "Histórias de empreendedores locais",
    ],
    sponsorProfile:
      "Bancos, fintechs, contabilidade, imobiliárias, RH, bares e restaurantes, eventos.",
    accent: "emerald",
    cota: { status: "disponivel" },
  },
  {
    slug: "tateios-escolares",
    name: "Tateios Escolares",
    emoji: "🎓",
    format: "Educação, saúde e juventude",
    host: "Especialistas em educação, psicologia e saúde",
    description:
      "Debates sobre educação, comportamento de jovens, saúde mental e a relação entre escola, família e sociedade. Pauta com convidados especialistas.",
    episodes: [
      "Adolescência: Entre Casa e Escola",
      "Geração Mimizenta: Você Concorda?",
      "Saúde Mental nas Escolas",
    ],
    sponsorProfile:
      "Escolas, faculdades, clínicas de psicologia, planos de saúde, farmácias, cursos, papelarias.",
    accent: "sky",
  },
  {
    slug: "pfc-news",
    name: "PFC News",
    emoji: "📰",
    format: "Jornalismo, mídia e atualidades",
    host: "Convidados jornalistas e comunicadores",
    description:
      "Análise de fatos e notícias com jornalistas e profissionais de comunicação da região. Conteúdo informativo com credibilidade local.",
    episodes: [
      "O Jornalismo Acabou?",
      "Viciado em Notícias? Virei Repórter!",
      "Celular no Show? Liberdade ou Desrespeito?",
    ],
    sponsorProfile:
      "Comunicação, faculdades, cursos livres, tecnologia, advocacia, planos de saúde.",
    accent: "rose",
    cota: { status: "disponivel" },
  },
  {
    slug: "pfc-visita",
    name: "PFC Visita",
    emoji: "🚗",
    format: "Externo — o estúdio vai até o convidado",
    host: "Willian Marinho",
    description:
      "O diferencial do ecossistema PFC. A câmera sai do estúdio e visita empresas, estabelecimentos e personalidades de Mogi Guaçu e região — colocando o negócio do parceiro em destaque no próprio ambiente.",
    episodes: [
      "Visitas a empresas e estabelecimentos locais",
      "Perfis de empreendedores no seu próprio espaço",
    ],
    sponsorProfile:
      "Qualquer negócio local: restaurantes, lojas, clínicas, academias, indústrias, comércios.",
    accent: "violet",
  },
  {
    slug: "pfc-esporte-clube",
    name: "PFC Esporte Clube",
    emoji: "⚽",
    format: "Esporte e treino, com um especialista diferente no comando",
    // TODO: confirmar o dia de gravação com a produção.
    host: "Rodízio de especialistas: futebol, crossfit, Hyrox e outras modalidades",
    description:
      "O quadro do esporte de Mogi Guaçu e região, com host rotativo: a cada episódio quem conduz é um especialista da modalidade — do futebol ao crossfit e ao Hyrox. Treino, competição, bastidores e as histórias de quem vive o esporte na cidade.",
    episodes: [
      "Futebol: dos campos da cidade às categorias de base",
      "Crossfit e Hyrox: treino, competição e rotina de atleta",
      "Especialistas e atletas locais de cada modalidade",
    ],
    sponsorProfile:
      "Academias e boxes de crossfit, lojas de artigos esportivos, suplementos, nutrição esportiva, fisioterapia e ortopedia, bares e restaurantes.",
    accent: "forest",
    isNew: true,
    cota: { status: "negociacao" },
    modalidades: [
      { nome: "Futebol", status: "disponivel" },
      { nome: "Crossfit e Hyrox", status: "disponivel" },
    ],
  },
];

/**
 * Patrocínio por quadro: a marca "apresenta" um quadro específico em vez de
 * aparecer no canal inteiro. Cota master é exclusiva (1 por quadro); as de
 * apoio são menores e sem exclusividade. Contrato mínimo de 3 meses em todas.
 *
 * Por que a cota master de UM quadro (R$ 997) custa mais que o Patrocinador do
 * canal todo (R$ 797): os preços seguem ~R$ 60 por episódio × episódios no mês
 * × fator de exclusividade (docs/precificacao.md). O Patrocinador é um logo
 * entre vários em ~13 episódios (fator 1); a cota master dá o nome do quadro à
 * marca em ~4 episódios (fator 4). Apoio de quadro: 4 eps × 60 → R$ 397 com
 * a story por episódio; apoio de modalidade: ~2 eps/mês × 60 × 2 → R$ 247.
 *
 * Exclusividade: o segmento de um cliente do Plano Master fica bloqueado nas
 * cotas (master, apoio e modalidade) de todos os quadros enquanto o contrato
 * durar — um concorrente dele não entra pela porta do quadro.
 */
export const quadroSponsorship = {
  /** Contratação mínima, vale para todas as cotas. */
  minMonths: 3,
  master: {
    name: "Cota Master do quadro",
    monthlyPrice: 997,
    features: [
      "“{quadro} apresentado por {marca}” na abertura e no encerramento",
      "Logo na vinheta, no cenário e na thumb dos episódios",
      "Menção do apresentador em todos os episódios do quadro",
      "Marca nos cortes e shorts do quadro",
      "QR code na tela + página exclusiva com tracking",
      "Exclusividade: nenhuma outra marca como master do quadro",
      "Relatório mensal de alcance e acessos ao QR",
    ],
  },
  apoio: {
    name: "Cota de Apoio",
    monthlyPrice: 397,
    /** Apoio de uma modalidade só (quadros com `modalidades`). */
    modalidadePrice: 247,
    features: [
      "Menção do apresentador nos episódios do quadro",
      "Logo nos créditos finais",
      "Link na descrição dos episódios",
      "Story de divulgação a cada episódio",
    ],
    /** Texto da variação por modalidade, nos quadros que têm `modalidades`. */
    modalidade:
      "No PFC Esporte Clube dá para apoiar só uma modalidade: um box de crossfit, por exemplo, aparece só nos episódios de crossfit e Hyrox.",
  },
};

/** Formatos de parceria disponíveis (Media Kit). */
export const partnershipFormats = [
  {
    title: "Menção durante a live",
    description:
      "Citação do patrocinador ao vivo, com audiência em tempo real.",
    emoji: "🎙️",
  },
  {
    title: "Convidado especialista",
    description:
      "O patrocinador participa como convidado em um quadro temático.",
    emoji: "🪑",
  },
  {
    title: "PFC Visita",
    description: "Episódio gravado no espaço do patrocinador.",
    emoji: "🚗",
  },
  {
    title: "Patrocínio de quadro",
    description:
      "Sua marca apresenta um quadro inteiro — cota master exclusiva ou cota de apoio.",
    emoji: "🏆",
  },
  {
    title: "Vinheta / abertura",
    description: "Inserção de marca na abertura do quadro ou episódio.",
    emoji: "🎬",
  },
  {
    title: "Clips patrocinados",
    description: "Shorts derivados do episódio com menção à marca.",
    emoji: "📱",
  },
  {
    title: "QR Code na tela + landing",
    description:
      "QR exibido durante o episódio leva a uma página exclusiva da marca — com tracking de acessos.",
    emoji: "📲",
  },
];
