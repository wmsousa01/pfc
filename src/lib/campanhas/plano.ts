import type { Formato } from "./store";

/**
 * Pauta de criativos do plano "Campanhas e calendário — nov/2026 a jan/2027"
 * (doc da equipe: https://claude.ai/artifact/SHvH2TxvRMgaHjewYfrzM8). Cada
 * criativo da biblioteca é marcado com o código da peça (mkt_criativos.peca),
 * e a página de criativos mostra o que falta. Mudou o plano, muda aqui.
 */
export type Fonte = "estudio" | "gerador" | "contenta";

export type Peca = {
  codigo: string;
  /** Chave do modelo em modelos.ts: a estratégia que nasce dele recebe a peça. */
  campanha: "sem-enrolacao" | "piloto-30" | "pfc-visita";
  titulo: string;
  tipo: "video" | "imagem";
  formatos: Formato[];
  fonte: Fonte;
  /** Data em que a peça precisa estar na biblioteca (YYYY-MM-DD). */
  prazo: string;
  nota?: string;
  /** Texto exato da peça estática, para preencher o gerador. */
  estatico?: { headline: string; apoio: string; chamada: string; instrucao: string };
};

export const PLANO_URL = "https://claude.ai/artifact/SHvH2TxvRMgaHjewYfrzM8";

export const CAMPANHAS_DO_PLANO: Record<Peca["campanha"], { codigo: string; resumo: string }> = {
  "sem-enrolacao": { codigo: "C1", resumo: "Topo · ThruPlay · R$ 7/dia · a partir de 10/11" },
  "piloto-30": { codigo: "C2", resumo: "Fundo · tráfego para /parcerias · R$ 7/dia · 10/11 a 20/12, volta em 05/01" },
  "pfc-visita": { codigo: "C3", resumo: "Fundo · tráfego para /pfc-visita · R$ 6/dia · 17/11 a 13/12" },
};

export const FONTES: Record<Fonte, string> = {
  estudio: "Diária de estúdio",
  gerador: "Gerador (abaixo)",
  contenta: "Corte do Contenta",
};

export const PECAS: Peca[] = [
  { codigo: "C1-V2", campanha: "sem-enrolacao", titulo: "Vídeo 2 · Números (25s), ganchos A, B e C", tipo: "video", formatos: ["9:16", "4:5"], fonte: "estudio", prazo: "2026-11-09" },
  { codigo: "C1-SE1", campanha: "sem-enrolacao", titulo: "Série #1 · “Anúncio ou doação?”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-11-09" },
  { codigo: "C1-SE2", campanha: "sem-enrolacao", titulo: "Série #2 · “O problema nunca foi o meio”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-11-16", nota: "Sai também como carrossel no orgânico" },
  { codigo: "C1-SE3", campanha: "sem-enrolacao", titulo: "Série #3 · “3 perguntas antes de pagar”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-11-23" },
  { codigo: "C1-SE4", campanha: "sem-enrolacao", titulo: "Série #4 · “Tem anúncio que acaba e anúncio que fica”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-11-30", nota: "Falta roteiro" },
  { codigo: "C1-SE5", campanha: "sem-enrolacao", titulo: "Série #5 · “Que quadradinho é esse na tela?”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-12-07", nota: "Falta roteiro" },
  { codigo: "C1-SE6", campanha: "sem-enrolacao", titulo: "Série #6 · “O que a Contenta AI recebeu em 30 dias”", tipo: "video", formatos: ["9:16"], fonte: "estudio", prazo: "2026-12-14", nota: "Falta roteiro e o número real do case" },
  { codigo: "C2-V3", campanha: "piloto-30", titulo: "Vídeo 3 · Patrocínio (30s), ganchos A, B e C", tipo: "video", formatos: ["9:16", "4:5"], fonte: "estudio", prazo: "2026-11-09" },
  {
    codigo: "C2-E1",
    campanha: "piloto-30",
    titulo: "Estático · “Quanta gente viu o seu último anúncio?”",
    tipo: "imagem",
    formatos: ["4:5"],
    fonte: "gerador",
    prazo: "2026-11-09",
    nota: "Referência: foto do estúdio",
    estatico: {
      headline: "QUANTA GENTE VIU O SEU ÚLTIMO ANÚNCIO?",
      apoio: "Aqui você recebe o número: QR e relatório de quem veio.",
      chamada: "PEÇA O MEDIA KIT",
      instrucao: "Estúdio do podcast ao fundo, com a bancada e os microfones. Clima de conversa, sem pessoas posando.",
    },
  },
  {
    codigo: "C2-E2",
    campanha: "piloto-30",
    titulo: "Estático · “Você vê quem veio.”",
    tipo: "imagem",
    formatos: ["9:16"],
    fonte: "gerador",
    prazo: "2026-11-09",
    nota: "Referência: foto do apresentador segurando o QR",
    estatico: {
      headline: "VOCÊ VÊ QUEM VEIO.",
      apoio: "Menção no programa, QR na tela e relatório no fim do mês.",
      chamada: "QUERO O PILOTO",
      instrucao: "Apresentador segurando o QR impresso em primeiro plano, estúdio desfocado atrás. O QR não precisa ser legível.",
    },
  },
  {
    codigo: "C2-E3",
    campanha: "piloto-30",
    titulo: "Estático de janeiro · “Onde sua loja vai aparecer em 2027?”",
    tipo: "imagem",
    formatos: ["4:5"],
    fonte: "gerador",
    prazo: "2026-12-29",
    estatico: {
      headline: "ONDE SUA LOJA VAI APARECER EM 2027?",
      apoio: "Mídia local com número: quem viu e quem chamou.",
      chamada: "PEÇA O MEDIA KIT",
      instrucao: "Clima de começo de ano, sem fogos nem taça. Estúdio do podcast com luz dourada.",
    },
  },
  { codigo: "C3-V4", campanha: "pfc-visita", titulo: "Vídeo 4 · PFC Visita (35s), ganchos A, B e C", tipo: "video", formatos: ["9:16", "4:5"], fonte: "estudio", prazo: "2026-11-16", nota: "B-roll só de quem autorizou anúncio pago" },
  { codigo: "C3-CV", campanha: "pfc-visita", titulo: "Corte real de um Visita (Geladeiras e Cia ou TFY), 20 a 40s", tipo: "video", formatos: ["9:16"], fonte: "contenta", prazo: "2026-11-16", nota: "Com autorização por escrito do dono" },
  {
    codigo: "C3-E1",
    campanha: "pfc-visita",
    titulo: "Estático · “E se o próximo episódio fosse sobre o seu negócio?”",
    tipo: "imagem",
    formatos: ["4:5"],
    fonte: "gerador",
    prazo: "2026-11-16",
    nota: "Referência: foto real de um Visita",
    estatico: {
      headline: "E SE O PRÓXIMO EPISÓDIO FOSSE SOBRE O SEU NEGÓCIO?",
      apoio: "O PFC Visita grava a história da sua empresa, no seu espaço.",
      chamada: "CHAMA NO WHATSAPP",
      instrucao: "Use a foto de referência do Visita como cena principal: câmera e equipe gravando dentro do negócio.",
    },
  },
];

export const pecaPorCodigo = (codigo: string | null | undefined): Peca | undefined => PECAS.find((p) => p.codigo === codigo);
