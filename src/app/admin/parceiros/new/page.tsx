import AdminHeader from "@/components/admin/AdminHeader";
import PartnerForm from "@/components/admin/PartnerForm";
import { requireAcesso } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NewPartnerPage() {
  await requireAcesso("parceiros.editar");
  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin" className="text-white/40 hover:text-white text-sm">← Voltar</a>
        <h1 className="text-2xl font-bold text-white mt-3 mb-8">Novo parceiro</h1>
        <PartnerForm />
      </div>
    </div>
  );
}
