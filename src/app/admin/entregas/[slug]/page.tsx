import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { getClientAccounts } from "@/lib/client-area";
import { chatAwaitingReply, getClientDeliveries } from "@/lib/jira";
import { ClientSection } from "../shared";

export const dynamic = "force-dynamic";

/** Página de um cliente: entregas, conversa e acesso ao portal. */
export default async function ClienteEntregasPage({ params }: { params: { slug: string } }) {
  await requireAdmin();
  const account = (await getClientAccounts()).find((a) => a.slug === params.slug);
  if (!account) notFound();

  const [deliveries, awaiting] = await Promise.all([
    account.jiraEpic ? getClientDeliveries(account.jiraEpic, { fresh: true }) : null,
    account.jiraChat ? chatAwaitingReply(account.jiraChat) : false,
  ]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin/entregas" className="text-white/40 hover:text-white text-sm">
          ← Todos os clientes
        </a>
        <div className="mt-4">
          <ClientSection account={account} deliveries={deliveries} awaiting={awaiting} />
        </div>
      </div>
    </div>
  );
}
