import { contadoresDoMenu } from "@/lib/admin/pendencias";
import { getSessionRole } from "@/lib/auth";
import { permite } from "@/lib/permissoes";
import AdminSidebar from "./AdminSidebar";
import { NAV, type NavKey } from "./nav";

/**
 * Navegação do admin: menu lateral fixo no desktop, barra com gaveta no celular.
 * O nome ficou por compatibilidade: todas as páginas do admin já o renderizam.
 *
 * O menu mostra só o que a pessoa pode abrir. Isso é conforto, não segurança:
 * cada página e action confere a permissão de novo no servidor.
 */
export default async function AdminHeader() {
  const role = await getSessionRole();
  const permitidos: NavKey[] = [];
  for (const g of NAV)
    for (const i of g.itens) {
      const ok =
        role.kind === "admin"
          ? i.key !== "meusQuadros"
          : role.kind === "equipe" && i.perm !== "admin" && permite(role.permissoes, i.perm);
      if (ok) permitidos.push(i.key);
    }
  const contadores = await contadoresDoMenu();
  return <AdminSidebar contadores={contadores} permitidos={permitidos} />;
}
