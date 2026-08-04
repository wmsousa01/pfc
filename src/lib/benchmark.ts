/**
 * Comparativo de mídia local de Mogi Guaçu e região.
 *
 * Alimenta `/revendedor/comparativo`, a página que o revendedor abre na reunião
 * com o cliente. Regra dura deste arquivo:
 *
 *   NENHUM NÚMERO PODE SER ESTIMADO. Ou existe fonte conferível, ou a célula é
 *   "não divulgado".
 *
 * Os dados de YouTube são públicos e foram extraídos do bloco
 * `aboutChannelViewModel` da página /about de cada canal, conferido contra o
 * `channelId` — qualquer pessoa abre o canal e confere na hora. Os dados de
 * Instagram são contagem de seguidores do perfil público. Onde o veículo não
 * publica (audiência de rádio, views por post no Instagram), está escrito que
 * não publica. Levantamento e método em `docs/benchmark-podcasts-regiao.md`.
 *
 * Cada veículo carrega um campo `forca` OBRIGATÓRIO: o que ele genuinamente faz
 * bem. A página nomeia concorrentes da mesma cidade — um comparativo em que só
 * nós somos bons não convence ninguém que já assinou contrato com emissora
 * (docs/estrategia-social-patrocinadores.md §5).
 */

/** Data da coleta. Toda média por mês é calculada até aqui, nunca até "hoje". */
export const coletadoEm = "2026-08";
export const atualizadoEm = "04/08/2026";

/** Mês de referência da coleta, como [ano, mês]. */
const FIM: [number, number] = [2026, 8];

export type Procedencia =
  /** Painel público que dá para abrir e conferir na hora (YouTube). */
  | "publico-conferivel"
  /** Sai do nosso painel e é auditável ao vivo. */
  | "medido"
  /** O veículo publica sobre si mesmo, sem verificação de terceiro. */
  | "declarado"
  /** Fato observável em público. */
  | "observado"
  /** O veículo não publica esse dado. */
  | "nao-divulgado";

export const PROCEDENCIA_LABEL: Record<Procedencia, string> = {
  "publico-conferivel": "público no YouTube",
  medido: "medido",
  declarado: "declarado pelo veículo",
  observado: "público",
  "nao-divulgado": "não divulgado",
};

/**
 * Peso visual. Ausência é SEMPRE neutra, nunca vermelha — pintar de vermelho o
 * "não" do concorrente transforma comparativo em ataque, e o revendedor fica
 * defendendo uma briga que não é dele.
 */
export type Tom = "forte" | "neutro" | "ausente";

export type Celula = {
  valor: string;
  procedencia: Procedencia;
  tom: Tom;
  nota?: string;
};

/** Números públicos do canal de YouTube, conferidos em `coletadoEm`. */
export type DadosYouTube = {
  handle: string;
  canalId: string;
  /** Como o YouTube exibe ("1,53 mil"). Ele arredonda; não invente o exato. */
  inscritosLabel: string;
  /** Este o YouTube dá exato. */
  viewsTotais: number;
  videos: number;
  /** Mês de criação do canal, "AAAA-MM". */
  desde: string;
};

export type CriterioId =
  | "audiencia"
  | "frequencia"
  | "permanencia"
  | "relatorio"
  | "rastreio"
  | "exclusividade"
  | "formato";

export type Criterio = { id: CriterioId; label: string; porque: string };

export const criterios: Criterio[] = [
  {
    id: "audiencia",
    label: "Audiência apresentada",
    porque: "O número que o veículo mostra — e de onde ele vem.",
  },
  {
    id: "frequencia",
    label: "Frequência de publicação",
    porque: "Quantas vezes por semana sua marca tem chance de aparecer.",
  },
  {
    id: "permanencia",
    label: "O conteúdo continua no ar depois?",
    porque:
      "Anúncio que some em 30 segundos e anúncio que trabalha por meses custam parecido.",
  },
  {
    id: "relatorio",
    label: "Você recebe relatório do seu anúncio?",
    porque: "Sem relatório, no ano seguinte você renova ou corta no achismo.",
  },
  {
    id: "rastreio",
    label: "Dá para rastrear quem procurou você?",
    porque:
      "É a diferença entre saber que apareceu e saber que alguém foi atrás.",
  },
  {
    id: "exclusividade",
    label: "Seu concorrente pode anunciar junto?",
    porque: "Exclusividade por segmento protege o que você está construindo.",
  },
  {
    id: "formato",
    label: "Dá para explicar o negócio com tempo?",
    porque: "Serviço que precisa de explicação não cabe em spot de 30 segundos.",
  },
];

export type Veiculo = {
  id: string;
  nome: string;
  tipo: string;
  cidade: string;
  destaque?: boolean;
  /** O que este veículo faz genuinamente bem. Obrigatório — ver topo do arquivo. */
  forca: string;
  fonte: string;
  fonteUrl?: string;
  /** Ausente quando o veículo não tem canal de YouTube relevante. */
  youtube?: DadosYouTube;
  indicadores: Record<CriterioId, Celula>;
};

const naoDivulgado = (nota?: string): Celula => ({
  valor: "Não divulgado",
  procedencia: "nao-divulgado",
  tom: "neutro",
  nota,
});
const nao = (nota?: string): Celula => ({
  valor: "Não",
  procedencia: "observado",
  tom: "ausente",
  nota,
});
const sim = (nota?: string): Celula => ({
  valor: "Sim",
  procedencia: "observado",
  tom: "forte",
  nota,
});
/** Permanência de canal de YouTube: vale para todo mundo que publica lá. */
const permaneceNoYouTube = sim("Fica publicado no canal e aparece na busca.");

export const veiculos: Veiculo[] = [
  {
    id: "fora-da-caixa",
    nome: "Fora da Caixa",
    tipo: "Podcast e vídeo",
    cidade: "Mogi Guaçu",
    destaque: true,
    forca:
      "Volume e conversa longa: dá para explicar um negócio de verdade, e cada episódio vira dezenas de cortes que continuam rodando.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@PapoForadaCaixa",
    youtube: {
      handle: "@PapoForadaCaixa",
      canalId: "UCskyIZf6RflDfhUjYZ865Jw",
      inscritosLabel: "1,53 mil",
      viewsTotais: 825187,
      videos: 2650,
      desde: "2025-02",
    },
    indicadores: {
      audiencia: {
        valor: "825.187 visualizações",
        procedencia: "publico-conferivel",
        tom: "forte",
        nota: "Total do canal desde fev/2025. Dá para abrir o canal e conferir.",
      },
      frequencia: {
        valor: "2.650 vídeos em 18 meses",
        procedencia: "publico-conferivel",
        tom: "forte",
        nota: "Cerca de 44 peças por semana entre episódios e cortes.",
      },
      permanencia: permaneceNoYouTube,
      relatorio: sim("Relatório de acessos por período, no fim do ciclo."),
      rastreio: sim(
        "QR na tela leva a uma página só da sua marca. Cada acesso é registrado."
      ),
      exclusividade: sim("No plano Master, o segmento fica bloqueado."),
      formato: sim("Episódios de 40 a 60 minutos, e o PFC Visita no seu espaço."),
    },
  },
  {
    id: "nova-onda",
    nome: "Nova Onda FM 99,3",
    tipo: "Rádio",
    cidade: "Mogi Guaçu",
    forca:
      "Presença ampla e simultânea: 30 anos de marca e sinal em mais de 40 cidades. Alcança de uma vez quem não usa rede social — coisa que nenhum canal de vídeo faz.",
    fonte: "YouTube · página do canal e material comercial do veículo",
    fonteUrl: "https://www.youtube.com/@NovaOndaFM993",
    youtube: {
      handle: "@NovaOndaFM993",
      canalId: "UCVZID7CDorrBfxSzTsqAfkg",
      inscritosLabel: "1,66 mil",
      viewsTotais: 208045,
      videos: 900,
      desde: "2020-05",
    },
    indicadores: {
      audiencia: {
        valor: "208.045 visualizações no YouTube",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "No FM o veículo declara 3 milhões de pessoas e 8 mil ouvintes por minuto — cobertura de sinal, sem auditoria de terceiro. A audiência de rádio é real e não aparece neste número.",
      },
      frequencia: {
        valor: "Grade 24h no FM · 900 vídeos desde 2020",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Número de inserções no rádio conforme o pacote contratado.",
      },
      permanencia: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "O que vai ao YouTube fica. O spot no FM existe enquanto está tocando.",
      },
      relatorio: naoDivulgado(
        "O rádio entrega comprovante de veiculação, que atesta que tocou — não quantas pessoas ouviram."
      ),
      rastreio: nao("Sem link ou QR por anunciante."),
      exclusividade: nao("Seu concorrente pode comprar a inserção seguinte."),
      formato: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "Há entrevistas e programas, mas o inventário comercial padrão é o spot de 30 segundos.",
      },
    },
  },
  {
    id: "midtv",
    nome: "MIDTV Mogi Guaçu",
    tipo: "TV local",
    cidade: "Mogi Guaçu",
    forca:
      "É televisão de verdade na cidade, com o peso institucional que só a TV tem — e a legitimidade de estar no ar desde 2015.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@midtv35.1",
    youtube: {
      handle: "@midtv35.1",
      canalId: "UCRrZBaFDr15frOzS0_8mAbA",
      inscritosLabel: "676",
      viewsTotais: 39688,
      videos: 1052,
      desde: "2015-08",
    },
    indicadores: {
      audiencia: {
        valor: "39.688 visualizações no YouTube",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde ago/2015. A audiência do sinal de TV não é divulgada e não está aqui.",
      },
      frequencia: {
        valor: "1.052 vídeos desde 2015",
        procedencia: "publico-conferivel",
        tom: "neutro",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: nao(),
      formato: sim("Entrevistas e programas de TV têm tempo de tela."),
    },
  },
  {
    id: "guacu-agora",
    nome: "Guaçu Agora",
    tipo: "Portal de notícias",
    cidade: "Mogi Guaçu",
    forca:
      "Melhor aproveitamento por peça da cidade: publica pouco e cada vídeo rende muito — 1.201 visualizações por vídeo, quase quatro vezes a nossa média.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@guacuagora139",
    youtube: {
      handle: "@guacuagora139",
      canalId: "UCZxseanJQmEx8SdVtaQ9sRQ",
      inscritosLabel: "257",
      viewsTotais: 72081,
      videos: 60,
      desde: "2020-03",
    },
    indicadores: {
      audiencia: {
        valor: "72.081 visualizações no YouTube",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde mar/2020, em apenas 60 vídeos.",
      },
      frequencia: {
        valor: "60 vídeos desde 2020",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Volume baixo no vídeo; a operação principal é o portal e o Instagram.",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: nao(),
      formato: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "Formato de reportagem curta.",
      },
    },
  },
  {
    id: "mogi-guacu-do-futuro",
    nome: "Mogi Guaçu do Futuro",
    tipo: "Canal local",
    cidade: "Mogi Guaçu",
    forca:
      "Pauta de cidade com crescimento consistente: 64 mil visualizações em dois anos e meio, feito por gente daqui.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@mogiguacudofuturo",
    youtube: {
      handle: "@mogiguacudofuturo",
      canalId: "UCmOes0gbhQfhzcaK53eYS_g",
      inscritosLabel: "411",
      viewsTotais: 64776,
      videos: 178,
      desde: "2024-02",
    },
    indicadores: {
      audiencia: {
        valor: "64.776 visualizações no YouTube",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde fev/2024.",
      },
      frequencia: {
        valor: "178 vídeos em 30 meses",
        procedencia: "publico-conferivel",
        tom: "neutro",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: nao(),
      formato: sim("Faz conteúdo longo sobre a cidade."),
    },
  },
  {
    id: "desnichados",
    nome: "Desnichados Podcast",
    tipo: "Podcast",
    cidade: "Mogi Guaçu",
    forca:
      "É o outro podcast de Mogi Guaçu que sustenta constância de verdade: 297 episódios desde 2024, sem nicho fixo e com público próprio.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@desnichados",
    youtube: {
      handle: "@desnichados",
      canalId: "UCKxaMWhWOV0g5l2fw1Wlt4A",
      inscritosLabel: "325",
      viewsTotais: 52676,
      videos: 297,
      desde: "2024-01",
    },
    indicadores: {
      audiencia: {
        valor: "52.676 visualizações no YouTube",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde jan/2024.",
      },
      frequencia: {
        valor: "297 vídeos em 31 meses",
        procedencia: "publico-conferivel",
        tom: "neutro",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: naoDivulgado("Não há tabela comercial pública."),
      formato: sim("Conversa longa, mesmo formato de podcast."),
    },
  },
  {
    id: "mogidica",
    nome: "@mogidica",
    tipo: "Página de dicas no Instagram",
    cidade: "Mogi Guaçu e Mogi Mirim",
    forca:
      "A maior audiência local de comércio no Instagram, com apresentadores de cara e nome. Em alcance de feed, ninguém da cidade chega perto.",
    fonte: "Perfil público no Instagram",
    fonteUrl: "https://www.instagram.com/mogidica/",
    indicadores: {
      audiencia: {
        valor: "34 mil seguidores",
        procedencia: "observado",
        tom: "neutro",
        nota: "Seguidor é quem assinou o perfil, não quem viu seu post. As visualizações por publicação não são divulgadas — e o Instagram não tem página pública de estatísticas como o YouTube.",
      },
      frequencia: {
        valor: "Alta, no feed e nos stories",
        procedencia: "observado",
        tom: "neutro",
        nota: "541 publicações no feed até a conferência.",
      },
      permanencia: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "O post fica no perfil, mas a entrega se concentra nas primeiras horas. Story some em 24h.",
      },
      relatorio: naoDivulgado(
        "Não há relatório padrão entregue ao anunciante."
      ),
      rastreio: nao("Sem QR ou página rastreada por anunciante."),
      exclusividade: nao("Sem bloqueio por segmento."),
      formato: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "Formato curto — ótimo para mostrar, apertado para explicar.",
      },
    },
  },
  {
    id: "mogiguacu-noticias",
    nome: "@mogiguacu.noticias",
    tipo: "Notícia local no Instagram",
    cidade: "Mogi Guaçu",
    forca:
      "Volume e velocidade: é onde a cidade vê o que aconteceu hoje. Bom para recado urgente e utilidade pública.",
    fonte: "Perfil público no Instagram",
    fonteUrl: "https://www.instagram.com/mogiguacu.noticias/",
    indicadores: {
      audiencia: {
        valor: "18 mil seguidores",
        procedencia: "observado",
        tom: "neutro",
        nota: "Visualizações por publicação não divulgadas.",
      },
      frequencia: {
        valor: "Muito alta",
        procedencia: "observado",
        tom: "neutro",
        nota: "1.879 publicações até a conferência.",
      },
      permanencia: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "O volume de posts empurra o conteúdo antigo para baixo rapidamente.",
      },
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: nao(),
      formato: nao("Formato de nota curta."),
    },
  },
];

/**
 * Referências da região, fora de Mogi Guaçu. Não disputam a mesma verba, mas
 * dão a régua do que é possível no interior — e o Itapira News mostra que
 * audiência local de verdade existe em escala bem maior que a nossa.
 */
export const referenciasRegionais: Veiculo[] = [
  {
    id: "itapira-news",
    nome: "Itapira News TV",
    tipo: "Portal de notícias em vídeo",
    cidade: "Itapira",
    forca:
      "O teto da região: 2,6 milhões de visualizações e a melhor média por vídeo do levantamento (2.264). Prova que audiência local em escala é possível.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@ItapiraNewsTV",
    youtube: {
      handle: "@ItapiraNewsTV",
      canalId: "UCwvPV5VusQv8Ar0USlB6SAw",
      inscritosLabel: "8,99 mil",
      viewsTotais: 2649221,
      videos: 1170,
      desde: "2014-10",
    },
    indicadores: {
      audiencia: {
        valor: "2.649.221 visualizações",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde out/2014.",
      },
      frequencia: {
        valor: "1.170 vídeos desde 2014",
        procedencia: "publico-conferivel",
        tom: "neutro",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: naoDivulgado(),
      formato: sim("Reportagem e entrevista."),
    },
  },
  {
    id: "arraste-uma-cadeira",
    nome: "Arraste Uma Cadeira",
    tipo: "Podcast",
    cidade: "São João da Boa Vista",
    forca:
      "Podcast regional em ritmo constante desde 2024, com 178 episódios publicados.",
    fonte: "YouTube · página do canal",
    fonteUrl: "https://www.youtube.com/@ArrasteUmaCadeira",
    youtube: {
      handle: "@ArrasteUmaCadeira",
      canalId: "UCWURFVkx3YPdcyQGGOHoq9g",
      inscritosLabel: "482",
      viewsTotais: 24504,
      videos: 178,
      desde: "2024-06",
    },
    indicadores: {
      audiencia: {
        valor: "24.504 visualizações",
        procedencia: "publico-conferivel",
        tom: "neutro",
        nota: "Total desde jun/2024.",
      },
      frequencia: {
        valor: "178 vídeos em 26 meses",
        procedencia: "publico-conferivel",
        tom: "neutro",
      },
      permanencia: permaneceNoYouTube,
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: naoDivulgado(),
      formato: sim("Conversa longa."),
    },
  },
];

/** Meses entre a criação do canal e a data da coleta. */
export function mesesAtivo(y: DadosYouTube): number {
  const [a, m] = y.desde.split("-").map(Number);
  return Math.max(1, (FIM[0] - a) * 12 + (FIM[1] - m));
}

/**
 * Média de visualizações por mês de existência do canal.
 *
 * Normaliza a idade: sem isso um canal de 2014 parece maior só por ser velho.
 * O denominador vai até `coletadoEm`, nunca até "hoje" — senão a média cairia
 * sozinha com o tempo, sem ninguém ter mexido nos dados.
 */
export function viewsPorMes(y: DadosYouTube): number {
  return Math.round(y.viewsTotais / mesesAtivo(y));
}

export function viewsPorVideo(y: DadosYouTube): number {
  return Math.round(y.viewsTotais / y.videos);
}

export const nf = new Intl.NumberFormat("pt-BR");

/** Veículo em destaque primeiro; o resto mantém a ordem declarada. */
export const veiculosOrdenados = [
  ...veiculos.filter((v) => v.destaque),
  ...veiculos.filter((v) => !v.destaque),
];

/** Todos os canais com YouTube, do maior para o menor em views/mês. */
export const rankingYouTube = [...veiculos, ...referenciasRegionais]
  .filter((v): v is Veiculo & { youtube: DadosYouTube } => !!v.youtube)
  .sort((a, b) => viewsPorMes(b.youtube) - viewsPorMes(a.youtube));
