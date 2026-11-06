/** Menu do admin: grupos, itens e ícones (traço, viewBox 24). */

export type NavKey =
  | "pendencias"
  | "agenda"
  | "producao"
  | "marketing"
  | "campanhas"
  | "parceiros"
  | "entregas"
  | "pedidos"
  | "revendedores"
  | "produtos";

export type NavItem = { key: NavKey; href: string; label: string; icon: string };
export type NavGrupo = { label: string; itens: NavItem[] };

export const ICONES = {
  pendencias:
    "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
  agenda: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
  producao: "M4 4h16v16H4zM8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4",
  marketing: "M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8",
  campanhas: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  parceiros:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  entregas: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  pedidos: "M6 2l-2 4v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6l-2-4zM4 6h16M16 10a4 4 0 0 1-8 0",
  revendedores:
    "M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4",
  produtos: "M21 16V8l-9-5-9 5v8l9 5 9-5zM3.3 7L12 12l8.7-5M12 22V12",
  site: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
  conta: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  sair: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
  mic: "M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v3",
  busca: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35",
  menu: "M3 6h18M3 12h18M3 18h18",
  fechar: "M18 6L6 18M6 6l12 12",
  recolher: "M11 17l-5-5 5-5M18 17l-5-5 5-5",
  expandir: "M13 17l5-5-5-5M6 17l5-5-5-5",
  mais: "M5 12h.01M12 12h.01M19 12h.01",
} as const;

export const NAV: NavGrupo[] = [
  {
    label: "Para você",
    itens: [{ key: "pendencias", href: "/admin/pendencias", label: "Pendências", icon: ICONES.pendencias }],
  },
  {
    label: "Conteúdo",
    itens: [
      { key: "agenda", href: "/admin/agenda", label: "Agenda", icon: ICONES.agenda },
      { key: "producao", href: "/admin/producao", label: "Produção", icon: ICONES.producao },
      { key: "marketing", href: "/admin/marketing", label: "Marketing", icon: ICONES.marketing },
      { key: "campanhas", href: "/admin/campanhas", label: "Campanhas", icon: ICONES.campanhas },
    ],
  },
  {
    label: "Comercial",
    itens: [
      { key: "parceiros", href: "/admin", label: "Parceiros", icon: ICONES.parceiros },
      { key: "entregas", href: "/admin/entregas", label: "Entregas", icon: ICONES.entregas },
      { key: "pedidos", href: "/admin/pedidos", label: "Pedidos", icon: ICONES.pedidos },
      { key: "revendedores", href: "/admin/revendedores", label: "Revendedores", icon: ICONES.revendedores },
      { key: "produtos", href: "/admin/produtos", label: "Produtos", icon: ICONES.produtos },
    ],
  },
];

/** Item do menu da rota atual. Parceiros mora em /admin e /admin/parceiros. */
export function itemAtivo(pathname: string): NavKey | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/parceiros")) return "parceiros";
  for (const g of NAV)
    for (const i of g.itens) if (i.href !== "/admin" && (pathname === i.href || pathname.startsWith(`${i.href}/`))) return i.key;
  return null;
}

/** Grupo do menu de uma área, para a trilha do cabeçalho ("Conteúdo / Marketing"). */
export function grupoDaArea(area: string): string {
  return NAV.find((g) => g.itens.some((i) => i.label === area))?.label ?? "Admin";
}

/** O que pede ação em cada área, para os números do menu. */
export type Contadores = Partial<Record<NavKey, { n: number; alerta?: boolean }>>;
