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
  url: "https://foradacaixa.com.br",
};

/** Canal do YouTube (channel_id resolvido a partir de @PapoForadaCaixa). */
export const youtube = {
  handle: "@PapoForadaCaixa",
  channelId: process.env.YOUTUBE_CHANNEL_ID ?? "UCskyIZf6RflDfhUjYZ865Jw",
  channelUrl: "https://www.youtube.com/@PapoForadaCaixa",
};

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

/** Números do canal — Media Kit Junho/2026. Atualize aqui quando mudar. */
export const channelStats = {
  subscribers: "1.370",
  totalVideos: "2.340",
  totalViews: "+799 mil",
  views12m: "806 mil",
  watchHoursYear: "4.474",
  likes12m: "11.319",
  weeklyContent: "~44",
  bestMonth: "158 mil",
  bestMonthLabel: "Fevereiro/2026",
  activeSince: "Abril/2025",
};

/** Os 5 quadros do ecossistema. */
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
];

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
