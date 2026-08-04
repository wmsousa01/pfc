/**
 * Comparativo de mídia local de Mogi Guaçu e região.
 *
 * Este arquivo alimenta a página `/revendedor/comparativo`, que o revendedor
 * mostra ao cliente. Por isso ele tem uma regra dura:
 *
 *   NENHUM NÚMERO AQUI PODE SER ESTIMADO. Ou existe fonte, ou a célula é
 *   "não divulgado".
 *
 * Nenhum veículo local publica views ou audiência auditada — os números de
 * rádio são de mídia kit próprio (cobertura de sinal, não audiência medida) e
 * os podcasts regionais não divulgam nada. Inventar número aqui destruiria a
 * credibilidade justamente na reunião em que ela mais vale. O levantamento e o
 * checklist do que ainda falta coletar estão em
 * `docs/benchmark-podcasts-regiao.md`.
 *
 * Cada veículo carrega um campo `forca` OBRIGATÓRIO: o que ele genuinamente faz
 * bem. Isso não é gentileza — a página nomeia concorrentes da mesma cidade, e
 * um comparativo em que só nós somos bons não convence ninguém que já assinou
 * contrato com emissora (docs/estrategia-social-patrocinadores.md §5).
 */

import { channelStats } from "./config";

/** Data da última conferência das fontes públicas. */
export const atualizadoEm = "04/08/2026";

/**
 * De onde vem o número da célula. Governa o selo exibido ao lado do valor.
 * A distinção entre `medido` e `declarado` é o argumento central da página.
 */
export type Procedencia =
  /** Sai de painel próprio e é auditável (ex.: YouTube Studio). */
  | "medido"
  /** O veículo publica, sem verificação de terceiro. */
  | "declarado"
  /** Fato observável em público (ex.: seguidores no perfil). */
  | "observado"
  /** O veículo não publica esse dado. */
  | "nao-divulgado";

export const PROCEDENCIA_LABEL: Record<Procedencia, string> = {
  medido: "medido",
  declarado: "declarado pelo veículo",
  observado: "público",
  "nao-divulgado": "não divulgado",
};

/**
 * Peso visual da célula. Ausência é SEMPRE neutra, nunca vermelha — pintar de
 * vermelho o "não" do concorrente transforma comparativo em ataque, e o
 * revendedor fica tendo que defender uma briga que não é dele.
 */
export type Tom = "forte" | "neutro" | "ausente";

export type Celula = {
  valor: string;
  procedencia: Procedencia;
  tom: Tom;
  nota?: string;
};

export type CriterioId =
  | "audiencia"
  | "frequencia"
  | "permanencia"
  | "relatorio"
  | "rastreio"
  | "exclusividade"
  | "formato";

export type Criterio = {
  id: CriterioId;
  label: string;
  /** Por que esse critério importa — vira a linha de apoio na tela. */
  porque: string;
};

export const criterios: Criterio[] = [
  {
    id: "audiencia",
    label: "Audiência apresentada",
    porque:
      "O número que o veículo mostra — e, mais importante, de onde ele vem.",
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
    porque:
      "Serviço que precisa de explicação não cabe em spot de 30 segundos.",
  },
];

export type Veiculo = {
  id: string;
  nome: string;
  tipo: string;
  cidade: string;
  /** Destaca a coluna do PFC. Exatamente um veículo deve ter isto. */
  destaque?: boolean;
  /** O que este veículo faz genuinamente bem. Obrigatório — ver topo do arquivo. */
  forca: string;
  fonte: string;
  fonteUrl?: string;
  indicadores: Record<CriterioId, Celula>;
};

const naoDivulgado = (nota?: string): Celula => ({
  valor: "Não divulgado",
  procedencia: "nao-divulgado",
  tom: "neutro",
  nota,
});

/** Ausência de recurso: neutra, com o motivo estrutural quando houver. */
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

export const veiculos: Veiculo[] = [
  {
    id: "fora-da-caixa",
    nome: "Fora da Caixa",
    tipo: "Podcast e vídeo",
    cidade: "Mogi Guaçu",
    destaque: true,
    forca:
      "Conversa longa e conteúdo que fica no ar — dá para explicar um negócio de verdade, e a peça continua sendo vista meses depois.",
    fonte: "YouTube Studio · media kit Jun/2026",
    fonteUrl: "https://www.youtube.com/@PapoForadaCaixa",
    indicadores: {
      audiencia: {
        valor: `${channelStats.views12m} de views em 12 meses`,
        procedencia: "medido",
        tom: "forte",
        nota: `${channelStats.watchHoursYear} horas assistidas · melhor mês ${channelStats.bestMonth} (${channelStats.bestMonthLabel})`,
      },
      frequencia: {
        valor: `${channelStats.weeklyContent} peças por semana`,
        procedencia: "medido",
        tom: "forte",
        nota: `${channelStats.totalVideos} conteúdos publicados desde ${channelStats.activeSince}`,
      },
      permanencia: sim(
        "Episódio e cortes ficam no YouTube e continuam aparecendo na busca."
      ),
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
      "Presença ampla e simultânea: 30 anos de marca e sinal em mais de 40 cidades. Alcança de uma vez quem não usa rede social.",
    fonte: "Material comercial do próprio veículo",
    fonteUrl: "https://novaondafm.com.br/comercial/",
    indicadores: {
      audiencia: {
        valor: "3 milhões de pessoas · 8 mil ouvintes por minuto",
        procedencia: "declarado",
        tom: "neutro",
        nota: "Cobertura de sinal em 40+ cidades. Cobertura e audiência são coisas diferentes — não há auditoria de terceiro no rádio local.",
      },
      frequencia: {
        valor: "Grade contínua, 24h",
        procedencia: "observado",
        tom: "neutro",
        nota: "Número de inserções conforme o pacote contratado.",
      },
      permanencia: nao("Natureza do meio: o spot existe enquanto está tocando."),
      relatorio: naoDivulgado(
        "O rádio entrega comprovante de veiculação, que atesta que tocou — não quantas pessoas ouviram."
      ),
      rastreio: nao("Sem link ou QR, não há como registrar a procura."),
      exclusividade: nao("Seu concorrente pode comprar a inserção seguinte."),
      formato: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "Existem entrevistas e programas, mas o inventário comercial padrão é o spot de 30 segundos.",
      },
    },
  },
  {
    id: "mogidica",
    nome: "@mogidica",
    tipo: "Página de dicas no Instagram",
    cidade: "Mogi Guaçu e Mogi Mirim",
    forca:
      "Audiência local grande e engajada, com apresentadores de cara e nome. É a maior vitrine de comércio da cidade no Instagram.",
    fonte: "Perfil público, conferido em 04/08/2026",
    fonteUrl: "https://www.instagram.com/mogidica/",
    indicadores: {
      audiencia: {
        valor: "34 mil seguidores",
        procedencia: "observado",
        tom: "neutro",
        nota: "Seguidor é quem assinou o perfil, não quem viu o seu post. As visualizações por publicação não são divulgadas.",
      },
      frequencia: {
        valor: "Alta, no feed e nos stories",
        procedencia: "observado",
        tom: "neutro",
        nota: "541 publicações no feed até a data da conferência.",
      },
      permanencia: {
        valor: "Parcial",
        procedencia: "observado",
        tom: "neutro",
        nota: "O post fica no perfil, mas a entrega se concentra nas primeiras horas. Story some em 24h.",
      },
      relatorio: naoDivulgado(
        "O perfil tem as métricas internas do Instagram; não há relatório padrão entregue ao anunciante."
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
    fonte: "Perfil público, conferido em 04/08/2026",
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
        nota: "1.879 publicações até a data da conferência.",
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
  {
    id: "voce-pod22",
    nome: "Você Pod22",
    tipo: "Podcast",
    cidade: "Mogi Mirim",
    forca:
      "Autoridade dentro do nicho de saúde, com médicos especialistas e respaldo institucional.",
    fonte: "Associação Paulista de Medicina · Regional Mogi Mirim",
    fonteUrl:
      "https://www.apm.org.br/podcast-voce-pod22-de-mogi-mirim-chega-ao-11-episodio/",
    indicadores: {
      audiencia: naoDivulgado(),
      frequencia: {
        valor: "Episódios pontuais",
        procedencia: "observado",
        tom: "neutro",
      },
      permanencia: sim("Fica publicado nas plataformas."),
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: {
        valor: "Não se aplica",
        procedencia: "observado",
        tom: "neutro",
        nota: "Projeto institucional da APM com o Hospital 22 de Outubro — não comercializa cota de patrocínio aberta.",
      },
      formato: sim("Entrevista longa com especialista."),
    },
  },
  {
    id: "mogi-mirim-que-queremos",
    nome: "A Mogi Mirim que queremos",
    tipo: "Podcast",
    cidade: "Mogi Mirim",
    forca:
      "Pauta pública com jornalistas da região — credibilidade editorial em temas de cidade.",
    fonte: "Jornal A Comarca",
    fonteUrl:
      "https://podcasts.apple.com/us/podcast/a-mogi-mirim-que-queremos/id1537265163",
    indicadores: {
      audiencia: naoDivulgado(),
      frequencia: {
        valor: "Episódios pontuais",
        procedencia: "observado",
        tom: "neutro",
      },
      permanencia: sim("Fica publicado nas plataformas."),
      relatorio: naoDivulgado(),
      rastreio: nao(),
      exclusividade: {
        valor: "Não se aplica",
        procedencia: "observado",
        tom: "neutro",
        nota: "Mesa de debate editorial do jornal — não comercializa cota de patrocínio aberta.",
      },
      formato: sim("Mesa de debate longa."),
    },
  },
];

/** Veículo em destaque primeiro; o resto mantém a ordem declarada. */
export const veiculosOrdenados = [
  ...veiculos.filter((v) => v.destaque),
  ...veiculos.filter((v) => !v.destaque),
];
