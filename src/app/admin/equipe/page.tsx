import AdminHeader from "@/components/admin/AdminHeader";
import MembroForm from "@/components/admin/MembroForm";
import PapelForm from "@/components/admin/PapelForm";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { EspacoHeader, selo } from "@/components/admin/Espaco";
import { requireAdmin } from "@/lib/auth";
import { listarAdmins, listarCadastrosApresentador, listarEquipe, listarPapeis } from "@/lib/equipe";
import { resumoPermissoes, rotuloPermissao } from "@/lib/permissoes";
import { apagarPapelAction, ativoAction, salvarMembroAction, salvarPapelAction } from "./actions";

export const dynamic = "force-dynamic";

const caixa = "bg-[#111] border border-[#1f1f1f] rounded-xl p-4 sm:p-5";

export default async function EquipePage({
  searchParams,
}: {
  searchParams: { aba?: string; editar?: string; papel?: string };
}) {
  await requireAdmin();
  const aba = searchParams.aba === "papeis" ? "papeis" : "pessoas";
  const [membros, papeis, admins, cadastros] = await Promise.all([
    listarEquipe(),
    listarPapeis(),
    listarAdmins(),
    listarCadastrosApresentador(),
  ]);
  const nomePapel = new Map(papeis.map((p) => [p.chave, p.nome]));
  const nomeCadastro = new Map(cadastros.map((c) => [c.id, c.nome]));

  const abas = [
    { href: "/admin/equipe", label: "Pessoas", ativa: aba === "pessoas", count: membros.filter((m) => m.ativo).length },
    { href: "/admin/equipe?aba=papeis", label: "Papéis", ativa: aba === "papeis", count: papeis.length },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader area="Equipe e acessos" titulo="Equipe e acessos" abas={abas} />

        {aba === "pessoas" ? (
          <Pessoas
            membros={membros}
            papeis={papeis}
            cadastros={cadastros}
            admins={admins}
            editar={searchParams.editar}
            nomePapel={nomePapel}
            nomeCadastro={nomeCadastro}
          />
        ) : (
          <Papeis papeis={papeis} editar={searchParams.papel} />
        )}
      </div>
    </div>
  );
}

function Pessoas({
  membros,
  papeis,
  cadastros,
  admins,
  editar,
  nomePapel,
  nomeCadastro,
}: {
  membros: Awaited<ReturnType<typeof listarEquipe>>;
  papeis: Awaited<ReturnType<typeof listarPapeis>>;
  cadastros: Awaited<ReturnType<typeof listarCadastrosApresentador>>;
  admins: string[];
  editar?: string;
  nomePapel: Map<string, string>;
  nomeCadastro: Map<string, string>;
}) {
  const editando = membros.find((m) => m.user_id === editar);
  return (
    <>
      <p className="text-white/35 text-xs mt-3 max-w-3xl">
        Cada pessoa entra pelo login do admin (/admin/login) e só vê o que os papéis dela liberam. Quem tem mais de um papel
        soma os acessos. Ligar contas (Meta, Google, YouTube) e mexer nesta tela continuam só com administradores.
      </p>

      <section className={`${caixa} mt-5`}>
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
          papeis={papeis}
          cadastros={cadastros}
          membro={editando}
        />
      </section>

      <section className="mt-6">
        <h2 className="text-white font-semibold mb-3">Pessoas</h2>
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
                    {!m.ativo && <span className="text-white/40 font-normal"> · desativado</span>}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {m.papeis.map((p) => (
                      <span key={p} className={`${selo} bg-gold-500/10 border-gold-500/30 text-gold-400`}>
                        {nomePapel.get(p) ?? p}
                      </span>
                    ))}
                    {resumoPermissoes(m.permissoes_extras).map((p) => (
                      <span key={p} className={`${selo} bg-white/5 border-white/10 text-white/60`} title="Permissão avulsa">
                        + {rotuloPermissao(p)}
                      </span>
                    ))}
                    {m.apresentador_id && (
                      <span className={`${selo} bg-white/5 border-white/10 text-white/60`}>
                        Apresentador: {nomeCadastro.get(m.apresentador_id) ?? "cadastro arquivado"}
                      </span>
                    )}
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
    </>
  );
}

function Papeis({ papeis, editar }: { papeis: Awaited<ReturnType<typeof listarPapeis>>; editar?: string }) {
  const editando = papeis.find((p) => p.chave === editar);
  return (
    <>
      <p className="text-white/35 text-xs mt-3 max-w-3xl">
        Papel é um pacote de permissões. Mudar um papel muda o acesso de todo mundo que o tem. Para uma exceção de uma
        pessoa só, use as permissões avulsas no cadastro dela.
      </p>

      <section className={`${caixa} mt-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">{editando ? `Editar papel ${editando.nome}` : "Novo papel"}</h2>
          {editando && (
            <a href="/admin/equipe?aba=papeis" className="text-xs text-white/50 hover:text-white">
              Cancelar
            </a>
          )}
        </div>
        <PapelForm key={editando?.chave ?? "novo"} action={salvarPapelAction} papel={editando} />
      </section>

      <section className="mt-6">
        <h2 className="text-white font-semibold mb-3">Papéis</h2>
        <ul className="space-y-2">
          {papeis.map((p) => (
            <li key={p.chave} className="bg-[#111] border border-[#1f1f1f] rounded-xl p-3 flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium">
                  {p.nome}{" "}
                  <span className="text-white/40 font-normal">
                    · {p.membros} {p.membros === 1 ? "pessoa" : "pessoas"}
                  </span>
                </p>
                {p.descricao && <p className="text-white/45 text-xs mt-0.5">{p.descricao}</p>}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {resumoPermissoes(p.permissoes).map((x) => (
                    <span key={x} className={`${selo} bg-white/5 border-white/10 text-white/60`}>
                      {rotuloPermissao(x)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <a href={`/admin/equipe?aba=papeis&papel=${p.chave}`} className="text-xs text-gold-400 hover:text-gold-300">
                  Editar
                </a>
                {p.membros === 0 && (
                  <ProducaoForm action={apagarPapelAction} label="Apagar" pending="..." buttonClassName="text-xs text-white/50 hover:text-red-300">
                    <input type="hidden" name="chave" value={p.chave} />
                  </ProducaoForm>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-white/30 text-[11px] mt-2">Só dá para apagar papel que ninguém tem. Tire o papel das pessoas antes.</p>
      </section>
    </>
  );
}
