import AdminHeader from "@/components/admin/AdminHeader";
import PasswordCard from "@/components/auth/PasswordCard";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminPasswordPage() {
  const { email } = await requireAdmin();

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white">Minha conta</h1>
        <p className="text-white/45 text-sm mt-1">
          Logado como <span className="text-gold-500">{email ?? "—"}</span>
        </p>

        <div className="mt-8">
          <PasswordCard />
        </div>
      </div>
    </div>
  );
}
