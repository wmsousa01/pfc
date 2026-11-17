/**
 * Jornada de contratação pelo site: plano → prazo → pagamento adiantado.
 *
 * Decidido em 17/11/2026: o cliente paga o período inteiro na hora (sem
 * cobrança recorrente), e só Apoio e Patrocinador são vendidos sem conversa.
 * O Master depende de conferir a exclusividade por segmento, então só abre
 * pelo link que o comercial manda ao lead (`?lead=`).
 *
 * Preços saem de lib/planos (tabela) e lib/payment (regra do cartão). Módulo
 * puro: usado pela página, pela action e pelo admin.
 */
import { plans, planById, REGRAS_PRECO, type Plan } from "./planos";
import { MAX_NO_INTEREST } from "./payment";

export type Periodo = "trimestral" | "semestral" | "anual";
export type Metodo = "pix" | "cartao";

/**
 * Liga a jornada pública (botões "Contratar agora" e o passo a passo em
 * /parcerias). Desligada, a página volta ao WhatsApp e /contratar só abre
 * pelo link do admin. Só ligar com MP_ACCESS_TOKEN de produção na Vercel.
 */
export const checkoutAtivo = process.env.NEXT_PUBLIC_CHECKOUT_ATIVO === "1";

/** Planos que o público compra sem falar com o comercial. */
export const SELF_SERVE = ["apoio", "patrocinador"] as const;

export const isSelfServe = (planId: string) =>
  checkoutAtivo && (SELF_SERVE as readonly string[]).includes(planId);

export type OpcaoPagamento = {
  periodo: Periodo;
  metodo: Metodo;
  meses: number;
  valor: number;
  /** "Trimestral", "Anual no Pix"… */
  titulo: string;
  /** Linha curta para o card. */
  detalhe: string;
  /** Texto que entra na cláusula de pagamento dos termos. */
  pagamento: string;
  /** Equivalente mensal, só para comparação (nunca promessa de parcela). */
  porMes: number;
  vantagem: boolean;
};

const PERIODO_MESES: Record<Periodo, number> = { trimestral: 3, semestral: 6, anual: 12 };

export const PERIODO_NOME: Record<Periodo, string> = {
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** As opções de prazo e pagamento de um plano, na ordem em que aparecem. */
export function opcoesDoPlano(plan: Plan): OpcaoPagamento[] {
  const out: OpcaoPagamento[] = [];
  for (const periodo of ["trimestral", "semestral"] as const) {
    const meses = PERIODO_MESES[periodo];
    const valor = plan.monthlyPrice * meses;
    for (const metodo of ["pix", "cartao"] as const) {
      out.push({
        periodo,
        metodo,
        meses,
        valor,
        titulo: `${PERIODO_NOME[periodo]} · ${metodo === "pix" ? "Pix ou boleto" : "Cartão"}`,
        detalhe:
          metodo === "pix"
            ? `${meses} mensalidades à vista`
            : `${meses} mensalidades em até ${MAX_NO_INTEREST}x sem juros`,
        pagamento:
          metodo === "pix"
            ? "à vista, no Pix ou boleto (Mercado Pago)"
            : `no cartão em até ${MAX_NO_INTEREST}x sem juros (Mercado Pago); acima de ${MAX_NO_INTEREST}x, com juros do Mercado Pago pagos pelo cliente`,
        porMes: plan.monthlyPrice,
        vantagem: meses >= REGRAS_PRECO.vantagemMeses,
      });
    }
  }
  out.push({
    periodo: "anual",
    metodo: "pix",
    meses: 12,
    valor: plan.yearlyPrice,
    titulo: "Anual · Pix ou boleto",
    detalhe: `${REGRAS_PRECO.anualPixOff}% off, à vista`,
    pagamento: `à vista, no Pix ou boleto (Mercado Pago), com ${REGRAS_PRECO.anualPixOff}% de desconto sobre 12 mensalidades`,
    porMes: plan.yearlyPrice / 12,
    vantagem: true,
  });
  out.push({
    periodo: "anual",
    metodo: "cartao",
    meses: 12,
    valor: plan.yearlyCardPrice,
    titulo: "Anual · Cartão",
    detalhe: `${REGRAS_PRECO.anualCartaoOff}% off, em até ${MAX_NO_INTEREST}x sem juros`,
    pagamento: `no cartão em até ${MAX_NO_INTEREST}x sem juros (Mercado Pago), com ${REGRAS_PRECO.anualCartaoOff}% de desconto sobre 12 mensalidades; acima de ${MAX_NO_INTEREST}x, com juros do Mercado Pago pagos pelo cliente`,
    porMes: plan.yearlyCardPrice / 12,
    vantagem: true,
  });
  return out;
}

export function opcao(planId: string, periodo: string, metodo: string): OpcaoPagamento | null {
  const plan = planById(planId);
  if (!plan) return null;
  return opcoesDoPlano(plan).find((o) => o.periodo === periodo && o.metodo === metodo) ?? null;
}

/** O que o plano entrega, como cláusula dos termos. */
export function entregasDoPlano(plan: Plan, meses: number): string[] {
  const base = [
    ...plan.features,
    "Página da marca no site do PFC com QR code no episódio e contagem de acessos",
  ];
  return meses >= REGRAS_PRECO.vantagemMeses ? [...base, REGRAS_PRECO.vantagem] : base;
}

export const resumoValor = (o: OpcaoPagamento) => `${brl(o.valor)} (${o.meses} meses)`;

export { plans, brl as brlReais };

/** Passos da jornada, para a barra de progresso das páginas. */
export const PASSOS = ["Plano", "Seus dados", "Termos", "Pagamento", "Onboarding"] as const;

export const STATUS_CHECKOUT: Record<string, { label: string; cor: string }> = {
  aberto: { label: "Preenchendo", cor: "bg-white/5 border-white/10 text-white/50" },
  aguardando: { label: "No pagamento", cor: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  processando: { label: "Processando", cor: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  pago: { label: "Pago", cor: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  recusado: { label: "Recusado", cor: "bg-red-500/10 border-red-500/30 text-red-400" },
  divergente: { label: "Valor divergente", cor: "bg-red-500/10 border-red-500/30 text-red-400" },
  erro: { label: "Erro ao ativar", cor: "bg-red-500/10 border-red-500/30 text-red-400" },
};
