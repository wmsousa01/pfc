import AdminHeader from "@/components/admin/AdminHeader";
import MembroForm from "@/components/admin/MembroForm";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { EspacoHeader, selo } from "@/components/admin/Espaco";
import { requireAdmin } from "@/lib/auth";
import { listarAdmins, listarEquipe } from "@/lib/equipe";
import { AREAS, APROVAR_MATERIAIS, PAPEIS, isPapel } from "@/lib/permissoes";
import { ativoAction, salvarMembroAction } from "./actions";

export const dynamic = "force-dynamic";

const rotuloArea = (k: string) =>
  k === APROVAR_MATERIAIS ? "Aprova materiais" : (AREAS.find((a) => a.key === k)?.label ?? k);

export default async function EquipePage({ searchParams }: { searchParams: { editar?: string } }) {
  await requireAdmin();
  const [membros, admins] = await Promise.all([listarEquipe(), listarAdmins()]);
  const editando = membros.find((m) => m.user_id === searchParams.editar);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader area="Equipe" titulo="Equipe e acessos" />
        <p className="text-white/35 text-xs mt-2 max-w-3xl">
          Cada pessoa entra pelo mesmo login do admin (/admin/login) e só vê as áreas liberadas. Editores enviam materiais e
          veem só os próprios envios; quem tem “Aprovar materiais” revisa os de todos.
        </p>

        <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 sm:p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">{editando ? `Editar ${editando.nome}` : "Novo acesso"}</h2>
            {editando && (
              <a href="/admin/equipe" className="text-xs text-white/50 hover:text-white">
                Cancelar
              </a>
            )}
          </div>
          <MembroForm
            key={editando?.user_id ?? "novo"}
            action={salvarMembroAction}
            membro={
              editando
                ? { ...editando, papel: isPapel(editando.papel) ? editando.papel : "personalizado" }
                : undefined
            }
          />
        </section>

        <section className="mt-6">
          <h2 className="text-white font-semibold mb-3">Membros</h2>
          {membros.length === 0 ? (
            <p className="text-white/40 text-sm">Ninguém cadastrado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {membros.map((m) => (
                <li
                  key={m.user_id}
                  className={`bg-[#111] border border-[#1f1f1f] rounded-xl p-3 flex flex-wrap items-center gap-3 ${m.ativo ? "" : "opacity-50"}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium">
                      {m.nome} <span className="text-white/40 font-normal">· {m.email}</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className={`${selo} bg-gold-500/10 border-gold-500/30 text-gold-400`}>
                        {isPapel(m.papel) ? PAPEIS[m.papel].label : m.papel}
                      </span>
                      {m.areas.map((a) => (
                        <span key={a} className={`${selo} bg-white/5 border-white/10 text-white/60`}>
                          {rotuloArea(a)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <a href={`/admin/equipe?editar=${m.user_id}`} className="text-xs text-gold-400 hover:text-gold-300">
                      Editar
                    </a>
                    <ProducaoForm
                      action={ativoAction}
                      label={m.ativo ? "Desativar" : "Reativar"}
                      pending="..."
                      buttonClassName="text-xs text-white/50 hover:text-white"
                    >
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <input type="hidden" name="ativo" value={m.ativo ? "0" : "1"} />
                    </ProducaoForm>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6">
          <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Administradores (acesso total)</h2>
          <p className="text-white/55 text-sm">{admins.join(" · ") || "—"}</p>
          <p className="text-white/30 text-[11px] mt-1">Administradores são definidos na tabela app_admins do Supabase.</p>
        </section>
      </div>
    </div>
  );
}
