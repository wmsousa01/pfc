import AdminHeader from "@/components/admin/AdminHeader";
import { inicioDoAcesso, requireEquipe } from "@/lib/auth";
import { rotuloPermissao } from "@/lib/permissoes";

export const dynamic = "force-dynamic";

/** Para onde vai quem é da equipe e abriu uma tela que o papel dele não libera. */
export default async function SemPermissaoPage({ searchParams }: { searchParams: { p?: string } }) {
  const role = await requireEquipe();
  const p = searchParams.p ? rotuloPermissao(searchParams.p) : null;
  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-lg mx-auto px-4 pt-16 text-center">
        <h1 className="text-xl font-bold text-white">Esta tela não está no seu acesso</h1>
        <p className="text-white/50 text-sm mt-3 leading-relaxed">
          {p ? `Ela pede “${p}”. ` : ""}Se você precisa dela no dia a dia, peça para um administrador incluir no seu papel.
        </p>
        <a href={inicioDoAcesso(role)} className="btn-primary inline-block mt-8 px-5 py-2.5 rounded-lg font-bold text-sm">
          Ir para o meu início
        </a>
      </div>
    </div>
  );
}
