import AdminHeader from "@/components/admin/AdminHeader";
import ResellerForm from "@/components/admin/ResellerForm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewResellerPage() {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin/revendedores" className="text-white/40 hover:text-white text-sm">
          ← Voltar
        </a>
        <h1 className="text-2xl font-bold text-white mt-3 mb-8">Novo revendedor</h1>
        <ResellerForm />
      </div>
    </div>
  );
}
