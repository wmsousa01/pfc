import { getSessionRole, type Acesso } from "@/lib/auth";
import { contadoresDoMenu } from "@/lib/admin/pendencias";
import { contadorMateriais } from "@/lib/materiais/store";
import AdminSidebar from "./AdminSidebar";
import { navPara, type Contadores, type NavKey } from "./nav";

/**
 * Navegação do admin: menu lateral fixo no desktop, barra com gaveta no celular.
 * O nome ficou por compatibilidade: todas as páginas do admin já o renderizam.
 *
 * Admin vê o menu inteiro; membro da equipe, só as áreas liberadas para ele (e
 * só os números delas).
 */
export default async function AdminHeader() {
  const role = await getSessionRole();
  const admin = role.kind === "admin";
  const membro = role.kind === "equipe" ? role : null;
  const acesso: Acesso | null = admin
    ? { userId: role.userId, email: role.email, nome: null, admin: true, areas: [] }
    : membro
      ? { userId: membro.userId, email: membro.email, nome: membro.nome, admin: false, areas: membro.areas }
      : null;

  const permitidas: NavKey[] | "todas" = admin ? "todas" : ((membro?.areas ?? []) as NavKey[]);
  const [base, materiais] = await Promise.all([
    contadoresDoMenu(),
    acesso && (admin || membro?.areas.includes("materiais")) ? contadorMateriais(acesso) : Promise.resolve(undefined),
  ]);

  const todos: Contadores = { ...base, ...(materiais ? { materiais } : {}) };
  const contadores: Contadores =
    permitidas === "todas"
      ? todos
      : Object.fromEntries(Object.entries(todos).filter(([k]) => permitidas.includes(k as NavKey)));

  return <AdminSidebar grupos={navPara(permitidas)} contadores={contadores} />;
}
