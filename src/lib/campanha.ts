import { quadros, quadroSponsorship, type Quadro } from "@/lib/config";

/**
 * Campanha comercial de fim de ano (decidida em 16/11/2026). Tudo que muda
 * de preço ou de comissão por causa dela sai daqui, para a campanha acabar
 * sozinha no prazo sem ninguém precisar lembrar de tirar banner.
 */
export const CAMPANHA = {
  id: "fim-de-ano-2026",
  nome: "Patrocinador fundador",
  /** Último instante para fechar (assinar e pagar o 1º mês), horário de Brasília. */
  ate: "2026-12-20T23:59:59-03:00",
  prazoLabel: "20 de dezembro",
  fundador: {
    /** Meses com o preço da cota master travado, sem reajuste. */
    precoTravadoMeses: 12,
    bonus: "um PFC Visita de brinde no 4º mês, com a 4ª mensalidade paga",
  },
  apresentador: {
    /** Bônus sobre a comissão quando o patrocínio é para o quadro que ele apresenta. */
    bonusPercent: 20,
    /** Desconto quando o apresentador patrocina com a própria empresa, enquanto apresentar. */
    descontoPercent: 25,
  },
} as const;

export function campanhaAtiva(agora: Date = new Date()): boolean {
  return agora.getTime() <= new Date(CAMPANHA.ate).getTime();
}

/** Dias que faltam (inteiros, arredondado para cima); 0 no último dia. */
export function diasParaAcabar(agora: Date = new Date()): number {
  return Math.max(0, Math.ceil((new Date(CAMPANHA.ate).getTime() - agora.getTime()) / 86_400_000) - 1);
}

/** Quadros que entram na oferta de fundador: os novos com cota ainda livre. */
export const quadrosFundador = (): Quadro[] =>
  quadros.filter((q) => q.isNew && q.cota && q.cota.status !== "vendida");

export const ehQuadroFundador = (slug: string) => quadrosFundador().some((q) => q.slug === slug);

/** Frase única da oferta, para banner, resumo e chat. */
export const ofertaFundador = () =>
  `Fechando até ${CAMPANHA.prazoLabel}: R$ ${quadroSponsorship.master.monthlyPrice.toLocaleString("pt-BR")}/mês travado por ${CAMPANHA.fundador.precoTravadoMeses} meses e ${CAMPANHA.fundador.bonus}.`;
