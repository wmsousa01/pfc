import type { EpisodioStatus } from "@/lib/agenda/store";

export const STATUS_EP: Record<EpisodioStatus, { label: string; cls: string }> = {
  solicitado: { label: "Pedido", cls: "bg-gold-500/15 border-gold-500/40 text-gold-400" },
  confirmado: { label: "Confirmado", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  realizado: { label: "Gravado", cls: "bg-sky-500/10 border-sky-500/30 text-sky-400" },
  cancelado: { label: "Cancelado", cls: "bg-white/5 border-white/10 text-white/30" },
};
