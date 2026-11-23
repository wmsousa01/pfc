/**
 * Inserções dos patrocinadores na live: tipos e rótulos que o navegador
 * também usa (tela do OBS, régie e formulário das cotas).
 */

export type TipoInsercao = "logo" | "faixa" | "l" | "qr" | "vinheta";
export type Momento = "abertura" | "durante" | "encerramento" | "continuo";
export type Posicao = "superior-esquerdo" | "superior-direito" | "inferior-esquerdo" | "inferior-direito";
export type StatusInsercao = "pendente" | "no_ar" | "exibida" | "pulada" | "perdida";
export type StatusSessao = "no_ar" | "encerramento" | "encerrada";

export const TIPOS: Record<TipoInsercao, { label: string; dica: string; duracao: number }> = {
  logo: { label: "Logo no canto", dica: "A marca num canto da tela, por um tempo ou o episódio todo.", duracao: 60 },
  faixa: { label: "Faixa (lower third)", dica: "“Oferecimento” com uma frase curta, na parte de baixo.", duracao: 12 },
  l: { label: "L (vídeo encolhe)", dica: "O vídeo vai para o canto e a marca ocupa a coluna da direita e a faixa de baixo.", duracao: 20 },
  qr: { label: "Placa do QR", dica: "A placa do parceiro no canto superior esquerdo, com o QR de tracking. O texto vem do cadastro da placa.", duracao: 45 },
  vinheta: { label: "Vinheta em vídeo", dica: "Vídeo em tela cheia, com som. A duração vem do arquivo.", duracao: 8 },
};

export const MOMENTOS: Record<Momento, string> = {
  abertura: "Na abertura",
  durante: "Durante a live",
  encerramento: "No encerramento",
  continuo: "O episódio todo",
};

export const POSICOES: Record<Posicao, string> = {
  "superior-esquerdo": "Em cima, à esquerda",
  "superior-direito": "Em cima, à direita",
  "inferior-esquerdo": "Embaixo, à esquerda",
  "inferior-direito": "Embaixo, à direita",
};

export const STATUS_INSERCAO: Record<StatusInsercao, string> = {
  pendente: "Na fila",
  no_ar: "No ar",
  exibida: "Exibida",
  pulada: "Pulada",
  perdida: "Não entrou",
};

export const isTipo = (v: unknown): v is TipoInsercao => typeof v === "string" && v in TIPOS;
export const isMomento = (v: unknown): v is Momento => typeof v === "string" && v in MOMENTOS;
export const isPosicao = (v: unknown): v is Posicao => typeof v === "string" && v in POSICOES;

/** O que a tela do OBS recebe de cada inserção no ar. */
export type ItemTela = {
  id: string;
  tipo: TipoInsercao;
  momento: Momento;
  posicao: Posicao;
  texto: string | null;
  /** Letras miúdas do L. */
  legenda: string | null;
  parceiro: { nome: string; logo: string | null; cor: string; fundo: string };
  /** Vídeo da vinheta ou arte própria (imagem), com URL assinada. */
  midia: { url: string; mime: string } | null;
  /** QR em data URL (PNG), nos tipos qr e l. */
  qr: string | null;
  /** O link do QR escrito por extenso (pfctv.com.br/go/slug), nos tipos qr e l. */
  link: string | null;
};

export type EstadoTela = {
  /** null = nenhuma live do quadro no ar: a tela fica vazia. */
  sessao: { id: string; status: StatusSessao } | null;
  canto: ItemTela[];
  destaque: ItemTela | null;
  /** Inserções de QR que vêm aí: a tela já baixa as placas para entrarem sem atraso. */
  placasDaFila: string[];
};

/** Uma linha da fila, como a régie vê. */
export type ItemFila = {
  id: string;
  tipo: TipoInsercao;
  momento: Momento;
  parceiro: string;
  previsto_s: number | null;
  duracao_s: number;
  status: StatusInsercao;
  inicio_em: string | null;
  fim_em: string | null;
  disparo: "auto" | "manual" | null;
};

export type EstadoRegie = {
  quadro: { id: string; nome: string; cor: string; modalidades: string[] };
  /** Relógio do servidor, para a régie acertar o cronômetro. */
  agora: string;
  sessao: {
    id: string;
    status: StatusSessao;
    titulo: string | null;
    modalidade: string | null;
    iniciada_em: string;
    duracao_prevista_min: number;
    segurando: boolean;
  } | null;
  fila: ItemFila[];
  /** Sem live no ar: o que entraria se ela começasse agora, por modalidade ("" = sem modalidade). */
  previa: Record<string, { parceiros: number; insercoes: number }>;
  episodios: { id: string; titulo: string; inicio: string; duracao_min: number }[];
};
