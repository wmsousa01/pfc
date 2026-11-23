/** Posts estáticos do Instagram: o que a tela manda para o servidor desenhar. */

export type FormatoPost = "4:5" | "1:1" | "9:16";

export const TAMANHOS: Record<FormatoPost, { w: number; h: number; label: string }> = {
  "4:5": { w: 1080, h: 1350, label: "Feed 4:5" },
  "1:1": { w: 1080, h: 1080, label: "Quadrado" },
  "9:16": { w: 1080, h: 1920, label: "Stories" },
};

export type PeriodoNumeros = "semana" | "28d" | "mes";

export const PERIODOS: { id: PeriodoNumeros; label: string }[] = [
  { id: "semana", label: "Semana passada" },
  { id: "28d", label: "Últimos 28 dias" },
  { id: "mes", label: "Mês passado" },
];

export type NumerosPost = {
  /** "Novembro", "10 a 16/11"... */
  periodo: string;
  views: number;
  viewsVar: number | null;
  horas: number;
  horasVar: number | null;
  novosInscritos: number;
  inscritosTotal: number | null;
  shortsPct: number | null;
  top: { titulo: string; views: number }[];
};

export type SlidesNumeros = { capa: boolean; views: boolean; horas: boolean; inscritos: boolean; top: boolean; fechamento: boolean };

/**
 * Foto já tratada no navegador (faixas + acabamento do quadro) e enviada ao
 * armazenamento. O pedido leva só o caminho: foto em base64 estouraria o
 * limite de 4,5 MB da Vercel num carrossel.
 */
export type FotoPost = string | null;

export const PASTA_FOTOS = "posts/fotos/";
export const PASTA_ARTES = "posts/artes/";
export const caminhoFotoValido = (v: unknown): v is string =>
  typeof v === "string" && /^posts\/fotos\/[0-9a-f-]{36}\.jpg$/.test(v);

export type PedidoPost =
  | { tipo: "numeros"; quadro: string; numeros: NumerosPost; slides: SlidesNumeros; chamada: string; fotoCapa: FotoPost }
  | {
      tipo: "cartaz";
      quadro: string;
      formato: FormatoPost;
      chapeu: string;
      titulo: string;
      mensagem: string;
      assinatura: string;
      foto: FotoPost;
    }
  | {
      tipo: "texto";
      quadro: string;
      titulo: string;
      subtitulo: string;
      itens: { titulo: string; texto: string; foto?: FotoPost }[];
      chamada: string;
      fotoCapa: FotoPost;
    };

/** Arte gerada e guardada: o caminho serve para publicar; a URL assinada, para ver e baixar. */
export type SlideGerado = { path: string; url: string };

/** Perfil do Instagram onde o post pode ir. */
export type PerfilInstagram = { id: number; nome: string; principal: boolean };

export type Modelo = { id: string; grupo: "Datas" | "Avisos"; nome: string; chapeu: string; titulo: string; mensagem: string };

/** Pontos de partida do cartaz: a equipe troca o texto à vontade. */
export const MODELOS_CARTAZ: Modelo[] = [
  { id: "natal", grupo: "Datas", nome: "Natal", chapeu: "25 de dezembro", titulo: "Feliz Natal", mensagem: "Obrigado por estar com a gente em cada episódio. Que o seu Natal seja cheio de boas conversas." },
  { id: "ano-novo", grupo: "Datas", nome: "Ano-Novo", chapeu: "Feliz ano novo", titulo: "Que venha um ano fora da caixa", mensagem: "Obrigado por cada play, comentário e compartilhamento. Tem muita conversa boa pela frente." },
  { id: "maes", grupo: "Datas", nome: "Dia das Mães", chapeu: "Dia das Mães", titulo: "Para quem ensinou a primeira conversa", mensagem: "Nossa homenagem a todas as mães de Mogi Guaçu e região." },
  { id: "pais", grupo: "Datas", nome: "Dia dos Pais", chapeu: "Dia dos Pais", titulo: "Feliz Dia dos Pais", mensagem: "Nossa homenagem a todos os pais que inspiram a gente todos os dias." },
  { id: "mulher", grupo: "Datas", nome: "Dia da Mulher", chapeu: "8 de março", titulo: "Dia Internacional da Mulher", mensagem: "Às mulheres que fazem a nossa cidade acontecer, todo o nosso respeito." },
  { id: "criancas", grupo: "Datas", nome: "Dia das Crianças", chapeu: "12 de outubro", titulo: "Feliz Dia das Crianças", mensagem: "Que a curiosidade de criança nunca saia da gente." },
  { id: "professores", grupo: "Datas", nome: "Dia dos Professores", chapeu: "15 de outubro", titulo: "Obrigado, professores", mensagem: "Toda boa conversa começou com alguém que ensinou a perguntar." },
  { id: "pascoa", grupo: "Datas", nome: "Páscoa", chapeu: "Feliz Páscoa", titulo: "Uma Páscoa de recomeços", mensagem: "Desejamos a você e à sua família uma Páscoa de paz." },
  { id: "aniversario", grupo: "Datas", nome: "Aniversário do canal", chapeu: "Aniversário", titulo: "Mais um ano de Fora da Caixa", mensagem: "Obrigado a cada convidado, parceiro e a você que assiste." },
  { id: "live", grupo: "Avisos", nome: "Hoje tem live", chapeu: "Hoje, às 19h", titulo: "Hoje tem live", mensagem: "Ative o lembrete no YouTube e chama a gente nos comentários." },
  { id: "convidado", grupo: "Avisos", nome: "Convidado", chapeu: "Convidado da semana", titulo: "Nome do convidado", mensagem: "O que ele vai contar no episódio, em uma frase." },
  { id: "episodio", grupo: "Avisos", nome: "Episódio novo", chapeu: "Episódio novo", titulo: "Já está no ar", mensagem: "Assista completo no YouTube. Link na bio." },
  { id: "livre", grupo: "Avisos", nome: "Em branco", chapeu: "", titulo: "Seu título aqui", mensagem: "" },
];

export const SLIDES_PADRAO: SlidesNumeros = { capa: true, views: true, horas: true, inscritos: true, top: true, fechamento: true };

export const LIMITE_ITENS = 8;
