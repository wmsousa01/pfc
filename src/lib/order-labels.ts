import type { OrderStatus, PaymentStatus } from "./types";

/** Rótulos e cores dos status — compartilhados pelo admin e pelo revendedor. */

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  "novo",
  "confirmado",
  "producao",
  "pronto",
  "entregue",
  "cancelado",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  producao: "Produção",
  pronto: "Pronto",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  novo: "bg-gold-500/15 border-gold-500/40 text-gold-400",
  confirmado: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  producao: "bg-violet-500/10 border-violet-500/30 text-violet-400",
  pronto: "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
  entregue: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  cancelado: "bg-white/5 border-white/10 text-white/40",
};

export const PAYMENT_STATUS_FLOW: PaymentStatus[] = [
  "pendente",
  "pago",
  "estornado",
];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  estornado: "Estornado",
};

export const PAYMENT_STATUS_STYLE: Record<PaymentStatus, string> = {
  pendente: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  pago: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  estornado: "bg-red-500/10 border-red-500/30 text-red-400",
};

export const DELIVERY_LABEL: Record<string, string> = {
  retirada: "Retirada",
  entrega: "Entrega",
  combinar: "A combinar",
};
