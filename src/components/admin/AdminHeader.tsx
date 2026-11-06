import { contadoresDoMenu } from "@/lib/admin/pendencias";
import AdminSidebar from "./AdminSidebar";

/**
 * Navegação do admin: menu lateral fixo no desktop, barra com gaveta no celular.
 * O nome ficou por compatibilidade: todas as páginas do admin já o renderizam.
 */
export default async function AdminHeader() {
  const contadores = await contadoresDoMenu();
  return <AdminSidebar contadores={contadores} />;
}
