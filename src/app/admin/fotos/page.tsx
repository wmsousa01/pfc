import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader } from "@/components/admin/Espaco";
import EditorFotos from "@/components/admin/fotos/EditorFotos";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function FotosPage() {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader area="Fotos" titulo="Correção de fotos" />
        <EditorFotos />
      </div>
    </div>
  );
}
