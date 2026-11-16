/** Categorias, tipos e status dos materiais. Sem server-only: o formulário de envio usa. */

export type Categoria = "quadro" | "visita" | "anuncio" | "vinheta";

export const TIPOS: Record<string, string> = {
  episodio: "Episódio completo",
  corte: "Corte",
  short: "Short / Reels",
  thumb: "Thumb",
  bruto: "Material bruto",
  video_anuncio: "Vídeo do anúncio",
  peca: "Peça estática",
  abertura: "Abertura",
  encerramento: "Encerramento",
  transicao: "Transição",
  lettering: "Lettering / GC",
  trilha: "Trilha / efeito sonoro",
  outro: "Outro",
};

export const CATEGORIAS: Record<Categoria, { label: string; pasta: string; descricao: string; tipos: string[] }> = {
  quadro: {
    label: "Quadros",
    pasta: "Quadros",
    descricao: "Episódios, cortes e shorts dos quadros do podcast",
    tipos: ["episodio", "corte", "short", "thumb", "bruto", "outro"],
  },
  visita: {
    label: "PFC Visita",
    pasta: "PFC Visita",
    descricao: "Gravações nos negócios visitados",
    tipos: ["episodio", "corte", "short", "thumb", "bruto", "outro"],
  },
  anuncio: {
    label: "Anúncios",
    pasta: "Anúncios",
    descricao: "Vídeos e peças de anúncio de clientes e campanhas",
    tipos: ["video_anuncio", "peca", "short", "bruto", "outro"],
  },
  vinheta: {
    label: "Vinhetas",
    pasta: "Vinhetas",
    descricao: "Aberturas, encerramentos, transições e trilhas",
    tipos: ["abertura", "encerramento", "transicao", "lettering", "trilha", "outro"],
  },
};

export const isCategoria = (v: string): v is Categoria => v in CATEGORIAS;

export type StatusMaterial = "enviando" | "recebido" | "ajuste" | "aprovado" | "substituido" | "arquivado";

export const STATUS_MATERIAL: Record<StatusMaterial, { label: string; cls: string }> = {
  enviando: { label: "Enviando", cls: "bg-white/5 border-white/10 text-white/40" },
  recebido: { label: "Para revisar", cls: "bg-gold-500/15 border-gold-500/40 text-gold-400" },
  ajuste: { label: "Ajuste pedido", cls: "bg-red-500/10 border-red-500/30 text-red-300" },
  aprovado: { label: "Aprovado", cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" },
  substituido: { label: "Versão antiga", cls: "bg-white/5 border-white/10 text-white/35" },
  arquivado: { label: "Arquivado", cls: "bg-white/5 border-white/10 text-white/30" },
};

export type Material = {
  id: string;
  categoria: Categoria;
  quadro: string | null;
  episodio_id: string | null;
  referencia: string | null;
  tipo: string;
  titulo: string;
  nota: string | null;
  versao: number;
  substitui_id: string | null;
  status: StatusMaterial;
  drive_pasta_id: string | null;
  drive_file_id: string | null;
  nome_arquivo: string;
  mime: string | null;
  tamanho: number | null;
  enviado_por: string | null;
  enviado_por_nome: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
  comentario: string | null;
  created_at: string;
  updated_at: string;
};

export function tamanhoLegivel(b: number | null): string {
  if (!b) return "—";
  if (b >= 1024 ** 3) return `${(b / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (b >= 1024 ** 2) return `${Math.round(b / 1024 ** 2)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
}
