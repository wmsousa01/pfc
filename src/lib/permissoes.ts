/**
 * Níveis de acesso da equipe. Admin (app_admins) abre tudo; o resto da equipe
 * abre só as áreas da própria lista. O papel é um ponto de partida: ao escolher,
 * as áreas dele vêm marcadas, e o admin pode ajustar caso a caso.
 *
 * Só entram aqui as áreas que leem o banco com service-role. As comerciais
 * (parceiros, pedidos, produtos, revendedores, entregas) dependem da RLS de
 * is_admin() e continuam só de admin até ganharem o mesmo tratamento.
 */

export type Area = "pendencias" | "agenda" | "producao" | "marketing" | "campanhas" | "materiais";

/** Aprovar ou pedir ajuste nos materiais (sem isto, o membro só envia e vê os próprios). */
export const APROVAR_MATERIAIS = "materiais.aprovar";

export const AREAS: { key: Area; label: string; descricao: string }[] = [
  { key: "materiais", label: "Materiais", descricao: "Enviar materiais editados e acompanhar a revisão" },
  { key: "agenda", label: "Agenda", descricao: "Convidados, episódios, arte e espelho" },
  { key: "producao", label: "Produção", descricao: "Thumbs e cortes do YouTube" },
  { key: "marketing", label: "Marketing", descricao: "Publicação orgânica" },
  { key: "campanhas", label: "Campanhas", descricao: "Anúncios pagos e criativos" },
  { key: "pendencias", label: "Pendências", descricao: "Resumo do que pede ação" },
];

export const PERMISSOES_EXTRAS = [
  { key: APROVAR_MATERIAIS, label: "Aprovar materiais", descricao: "Ver os envios de todos e aprovar ou pedir ajuste" },
];

export type Papel = "editor" | "producao" | "marketing" | "personalizado";

export const PAPEIS: Record<Papel, { label: string; descricao: string; areas: string[] }> = {
  editor: {
    label: "Editor",
    descricao: "Envia os materiais editados e vê só os próprios envios.",
    areas: ["materiais"],
  },
  producao: {
    label: "Produção",
    descricao: "Toca o conteúdo: agenda, produção, publicação e aprovação dos materiais.",
    areas: ["pendencias", "agenda", "producao", "marketing", "materiais", APROVAR_MATERIAIS],
  },
  marketing: {
    label: "Marketing",
    descricao: "Publicação, campanhas e os materiais de anúncio.",
    areas: ["marketing", "campanhas", "materiais"],
  },
  personalizado: {
    label: "Personalizado",
    descricao: "Áreas escolhidas uma a uma.",
    areas: [],
  },
};

export const isPapel = (v: string): v is Papel => v in PAPEIS;

const VALIDAS = new Set<string>([...AREAS.map((a) => a.key), ...PERMISSOES_EXTRAS.map((p) => p.key)]);

/** Limpa a lista vinda do formulário: só o que existe, sem repetir. */
export function areasValidas(lista: string[]): string[] {
  return Array.from(new Set(lista.filter((a) => VALIDAS.has(a))));
}
