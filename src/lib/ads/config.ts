/**
 * PFCTV Ads, fase 1: "Oferta da semana" self-serve (docs/pfctv-ads.md).
 *
 * Regra que sustenta o produto: o self-serve NUNCA entrega o que o patrocínio
 * entrega (menção do apresentador, logo no estúdio, presença no episódio).
 * Por isso a oferta vira um story e uma vitrine em /ofertas, e só. Avulso
 * semana a semana sai mais caro por mês (R$ 388) que o Apoio (R$ 297): quem
 * anuncia sempre descobre sozinho que assinar compensa.
 */

export const OFERTA = {
  nome: "Oferta da semana",
  precoCents: 9700,
  /** Vagas por semana: protege o alcance do perfil e cria escassez. */
  vagasPorSemana: 10,
  /** Quantas semanas à frente dá para comprar. */
  semanasAVenda: 4,
  /** Quanto tempo a vaga fica presa esperando o pagamento. */
  reservaMin: 60,
  /** Pix gerado e ainda não pago segura a vaga por mais este tempo. */
  reservaPixHoras: 24,
  limites: { titulo: 60, descricao: 220 },
} as const;

export const OFERTA_PRECO_LABEL = "R$ 97";

/** O que entra e o que não entra (aparece na página e no aceite). */
export const REGRAS_OFERTA = [
  "Um story com a sua oferta no Instagram do PFC, na semana escolhida, com QR e link rastreado para o seu WhatsApp.",
  "A oferta fica na vitrine pfctv.com.br/ofertas durante a semana inteira.",
  "Você recebe o número de cliques no link da oferta.",
  "Não inclui menção do apresentador, logo no estúdio nem presença nos episódios. Isso é patrocínio.",
  "Toda oferta passa por aprovação. Não publicamos promessa enganosa, apostas, bebida alcoólica, produto de saúde sem registro, política ou conteúdo ofensivo.",
  "Se a oferta for recusada, devolvemos 100% do valor pelo Mercado Pago.",
] as const;

export type OfertaStatus =
  | "reservada"
  | "paga"
  | "aprovada"
  | "publicando"
  | "publicada"
  | "erro"
  | "recusada"
  | "cancelada";

export const STATUS_OFERTA: Record<OfertaStatus, { label: string; cls: string }> = {
  reservada: { label: "Aguardando pagamento", cls: "bg-white/5 border-white/15 text-white/55" },
  paga: { label: "Paga · aprovar", cls: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
  aprovada: { label: "Aprovada · na fila", cls: "bg-sky-500/10 border-sky-500/30 text-sky-300" },
  publicando: { label: "Publicando", cls: "bg-sky-500/10 border-sky-500/30 text-sky-300" },
  publicada: { label: "No ar", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" },
  erro: { label: "Erro ao publicar", cls: "bg-red-500/10 border-red-500/30 text-red-300" },
  recusada: { label: "Recusada · reembolsada", cls: "bg-white/5 border-white/10 text-white/35" },
  cancelada: { label: "Cancelada", cls: "bg-white/5 border-white/10 text-white/35" },
};

/* ------------------------------------------------------------- semanas */

const DIA = 86_400_000;
const BRT = 3 * 3_600_000;

/** Segunda-feira (YYYY-MM-DD, Brasília) da semana de `t`. */
export function segundaDaSemana(t: number): string {
  const local = new Date(t - BRT);
  const dow = (local.getUTCDay() + 6) % 7; // 0 = segunda
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - dow * DIA)
    .toISOString()
    .slice(0, 10);
}

/** As semanas à venda: sempre a partir da próxima segunda (dá tempo de aprovar). */
export function semanasAVenda(now = Date.now()): string[] {
  const proxima = Date.parse(`${segundaDaSemana(now)}T12:00:00Z`) + 7 * DIA;
  return Array.from({ length: OFERTA.semanasAVenda }, (_, i) =>
    new Date(proxima + i * 7 * DIA).toISOString().slice(0, 10),
  );
}

/** "24 a 30 de nov" */
export function rotuloSemana(segunda: string): string {
  const ini = new Date(`${segunda}T12:00:00Z`);
  const fim = new Date(ini.getTime() + 6 * DIA);
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
  return ini.getUTCMonth() === fim.getUTCMonth()
    ? `${ini.getUTCDate()} a ${fim.getUTCDate()} de ${mes(fim)}`
    : `${ini.getUTCDate()} de ${mes(ini)} a ${fim.getUTCDate()} de ${mes(fim)}`;
}

/**
 * Horário do story de cada oferta aprovada: espalha as vagas de segunda a
 * sábado, ao meio-dia, e depois às 15h e 18h. A posição é a ordem de
 * aprovação dentro da semana.
 */
export function horarioDoStory(segunda: string, posicao: number): number {
  const dia = posicao % 6;
  const hora = [12, 15, 18][Math.floor(posicao / 6) % 3];
  return Date.parse(`${segunda}T00:00:00-03:00`) + dia * DIA + hora * 3_600_000;
}

/** Código curto do link rastreado, sem letras que confundem (0/O, 1/l/I). */
export function novoCodigo(): string {
  const abc = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => abc[b % abc.length]).join("");
}
