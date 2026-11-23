import AdminHeader from "@/components/admin/AdminHeader";
import EnvioMaterial from "@/components/admin/EnvioMaterial";
import { Coluna, EspacoHeader, Quadro, cartao, diaLabel, diaKey, selo } from "@/components/admin/Espaco";
import { requireAcesso } from "@/lib/auth";
import { driveAccount, linkPasta, raizId } from "@/lib/materiais/drive";
import {
  CATEGORIAS,
  STATUS_MATERIAL,
  TIPOS,
  episodiosRecentes,
  isCategoria,
  listarMateriais,
  podeAprovar,
  tamanhoLegivel,
  type Categoria,
  type Material,
} from "@/lib/materiais/store";
import { QUADROS } from "@/lib/producao/quadros";
import { desconectarDriveAction } from "./actions";
import { origemDo } from "./shared";

export const dynamic = "force-dynamic";

type View = "quadro" | "enviar" | "acervo" | "config";

const QUADROS_OPCOES = Object.values(QUADROS)
  .filter((q) => q.id !== "pfc-visita")
  .map((q) => ({ value: q.id, label: q.name }));

function Card({ m, mostrarQuem }: { m: Material; mostrarQuem: boolean }) {
  return (
    <a href={`/admin/materiais/${m.id}`} className={`${cartao} ${m.status === "ajuste" ? "border-red-500/25" : ""}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] text-white/45">
        <span className="truncate">{origemDo(m)}</span>
        {m.versao > 1 && <span className="shrink-0 text-white/60">v{m.versao}</span>}
      </div>
      <p className="text-white text-[13px] font-medium leading-snug line-clamp-2 mt-1">{m.titulo}</p>
      <p className="text-white/40 text-[11px] mt-1">
        {TIPOS[m.tipo] ?? m.tipo} · {tamanhoLegivel(m.tamanho)}
        {mostrarQuem && m.enviado_por_nome ? ` · ${m.enviado_por_nome}` : ""}
      </p>
      {m.status === "ajuste" && m.comentario && (
        <p className="text-red-300/80 text-[11px] mt-1.5 line-clamp-2">“{m.comentario}”</p>
      )}
    </a>
  );
}

export default async function MateriaisPage({
  searchParams,
}: {
  searchParams: { view?: string; cat?: string; q?: string; status?: string; ok?: string; erro?: string };
}) {
  const acesso = await requireAcesso("materiais.ver");
  const revisor = podeAprovar(acesso);
  const views: View[] = ["quadro", "enviar", "acervo", ...(acesso.kind === "admin" ? (["config"] as View[]) : [])];
  const view: View = views.includes(searchParams.view as View) ? (searchParams.view as View) : "quadro";

  const [conta, raiz] = await Promise.all([driveAccount(), raizId()]);
  const conectado = !!conta;

  const ativos = await listarMateriais(acesso, { status: ["recebido", "ajuste", "aprovado"], limite: 200 });
  const paraRevisar = ativos.filter((m) => m.status === "recebido");
  const ajustes = ativos.filter((m) => m.status === "ajuste");
  const aprovados = ativos.filter((m) => m.status === "aprovado").slice(0, 40);

  const cat = searchParams.cat && isCategoria(searchParams.cat) ? (searchParams.cat as Categoria) : undefined;
  const acervo =
    view === "acervo"
      ? await listarMateriais(acesso, {
          categoria: cat,
          busca: searchParams.q,
          status: searchParams.status === "todos" ? undefined : ["recebido", "ajuste", "aprovado"],
        })
      : [];
  const episodios = view === "enviar" ? await episodiosRecentes() : [];

  const href = (v: View) => `/admin/materiais?view=${v}`;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Materiais"
          titulo={revisor ? "Materiais dos editores" : "Meus materiais"}
          extra={
            conectado && raiz && revisor ? (
              <a href={linkPasta(raiz)} target="_blank" rel="noreferrer" className="text-xs text-gold-400 hover:text-gold-300">
                Abrir pasta no Drive ↗
              </a>
            ) : !conectado ? (
              <span className={`${selo} bg-red-500/10 border-red-500/30 text-red-300`}>Drive não conectado</span>
            ) : null
          }
          acoes={
            view !== "enviar" && (
              <a href={href("enviar")} className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold">
                Enviar material
              </a>
            )
          }
          abas={[
            {
              href: href("quadro"),
              label: "Quadro",
              ativa: view === "quadro",
              count: (revisor ? paraRevisar.length : ajustes.length) || undefined,
              alerta: !revisor && ajustes.length > 0,
            },
            { href: href("enviar"), label: "Enviar", ativa: view === "enviar" },
            { href: href("acervo"), label: "Acervo", ativa: view === "acervo" },
            ...(acesso.kind === "admin" ? [{ href: href("config"), label: "Configurar", ativa: view === "config", alerta: !conectado }] : []),
          ]}
        />

        {view === "quadro" && (
          <>
            <p className="text-white/35 text-xs mt-4 max-w-3xl">
              {revisor
                ? "Os editores enviam por aqui e o arquivo cai organizado no Drive (Categoria / Quadro / Episódio). Aprove ou peça ajuste: o editor vê o retorno e manda a nova versão no mesmo material."
                : "O que você enviou e o retorno da revisão. Quando pedirem ajuste, abra o material e mande a nova versão por lá."}
            </p>
            <Quadro
              cols={3}
              colunas={[
                { titulo: "Para revisar", count: paraRevisar.length },
                { titulo: "Ajuste pedido", count: ajustes.length },
                { titulo: "Aprovados", count: aprovados.length },
              ]}
            >
              <Coluna titulo="Para revisar" count={paraRevisar.length} vazio="Nada esperando revisão.">
                {paraRevisar.map((m) => (
                  <Card key={m.id} m={m} mostrarQuem={revisor} />
                ))}
              </Coluna>
              <Coluna titulo="Ajuste pedido" count={ajustes.length} alerta={!revisor && ajustes.length > 0} vazio="Nenhum ajuste pendente.">
                {ajustes.map((m) => (
                  <Card key={m.id} m={m} mostrarQuem={revisor} />
                ))}
              </Coluna>
              <Coluna titulo="Aprovados" count={aprovados.length} vazio="Nada aprovado ainda.">
                {aprovados.map((m) => (
                  <Card key={m.id} m={m} mostrarQuem={revisor} />
                ))}
              </Coluna>
            </Quadro>
          </>
        )}

        {view === "enviar" && (
          <section className="mt-6 max-w-3xl">
            {conectado ? (
              <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 sm:p-5">
                <EnvioMaterial
                  quadros={QUADROS_OPCOES}
                  episodios={episodios.map((e) => ({ id: e.id, quadro: e.quadro, label: e.label }))}
                />
              </div>
            ) : (
              <p className="text-white/60 text-sm">
                O Drive da produção ainda não foi conectado. {acesso.kind === "admin" ? "Conecte em Configurar." : "Avise a produção."}
              </p>
            )}
          </section>
        )}

        {view === "acervo" && (
          <section className="mt-4">
            <form className="flex flex-wrap items-center gap-2 mb-4">
              <input type="hidden" name="view" value="acervo" />
              <select name="cat" defaultValue={cat ?? ""} className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white">
                <option value="">Todas as categorias</option>
                {(Object.keys(CATEGORIAS) as Categoria[]).map((c) => (
                  <option key={c} value={c}>{CATEGORIAS[c].label}</option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={searchParams.status ?? ""}
                className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Versões atuais</option>
                <option value="todos">Com antigas e arquivados</option>
              </select>
              <input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Título, cliente, negócio, editor"
                className="flex-1 min-w-[12rem] bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white"
              />
              <button className="text-sm border border-[#2a2a2a] text-white/70 hover:text-white rounded-lg px-3 py-2">Filtrar</button>
            </form>

            {acervo.length === 0 ? (
              <p className="text-white/40 text-sm">Nenhum material encontrado.</p>
            ) : (
              <div className="overflow-x-auto border border-[#1f1f1f] rounded-xl">
                <table className="w-full text-sm">
                  <thead className="text-white/40 text-xs text-left">
                    <tr className="border-b border-[#1f1f1f]">
                      <th className="px-3 py-2 font-medium">Material</th>
                      <th className="px-3 py-2 font-medium hidden md:table-cell">Origem</th>
                      <th className="px-3 py-2 font-medium hidden sm:table-cell">Tipo</th>
                      {revisor && <th className="px-3 py-2 font-medium hidden lg:table-cell">Editor</th>}
                      <th className="px-3 py-2 font-medium hidden sm:table-cell">Enviado</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acervo.map((m) => (
                      <tr key={m.id} className="border-b border-[#161616] last:border-0 hover:bg-white/[0.02]">
                        <td className="px-3 py-2">
                          <a href={`/admin/materiais/${m.id}`} className="text-white hover:text-gold-400">
                            {m.titulo}
                          </a>
                          {m.versao > 1 && <span className="text-white/40 text-xs"> · v{m.versao}</span>}
                        </td>
                        <td className="px-3 py-2 text-white/55 hidden md:table-cell">{origemDo(m)}</td>
                        <td className="px-3 py-2 text-white/55 hidden sm:table-cell">{TIPOS[m.tipo] ?? m.tipo}</td>
                        {revisor && <td className="px-3 py-2 text-white/55 hidden lg:table-cell">{m.enviado_por_nome}</td>}
                        <td className="px-3 py-2 text-white/45 hidden sm:table-cell whitespace-nowrap">{diaLabel(diaKey(m.created_at))}</td>
                        <td className="px-3 py-2">
                          <span className={`${selo} ${STATUS_MATERIAL[m.status].cls}`}>{STATUS_MATERIAL[m.status].label}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {view === "config" && acesso.kind === "admin" && (
          <section className="mt-6 max-w-2xl space-y-4">
            {searchParams.ok && <p className="text-emerald-400 text-sm">Drive conectado: {searchParams.ok}</p>}
            {searchParams.erro && <p className="text-red-400 text-sm break-words">{searchParams.erro}</p>}
            <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 sm:p-5 space-y-3">
              <h2 className="text-white font-semibold">Drive da produção</h2>
              {conectado ? (
                <>
                  <p className="text-white/60 text-sm">
                    Conectado como <span className="text-gold-400">{conta}</span>.
                    {raiz && (
                      <>
                        {" "}
                        Os materiais caem em{" "}
                        <a href={linkPasta(raiz)} target="_blank" rel="noreferrer" className="text-gold-400 underline">
                          PFC · Materiais dos editores
                        </a>
                        .
                      </>
                    )}
                  </p>
                  <p className="text-white/40 text-xs">
                    Compartilhe essa pasta no Drive com quem revisa, para os links “Abrir no Drive” funcionarem. Pode mover a pasta
                    para onde quiser; só não apague (o app perde acesso e cria outra).
                  </p>
                  <div className="flex gap-2">
                    <a href="/api/materiais/drive" className="text-sm border border-[#2a2a2a] text-white/70 hover:text-white rounded-lg px-3 py-1.5">
                      Reconectar
                    </a>
                    <form action={desconectarDriveAction}>
                      <button className="text-sm border border-red-500/30 text-red-300 hover:text-red-200 rounded-lg px-3 py-1.5">
                        Desconectar
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-white/60 text-sm">
                    Conecte a conta Google dona do Drive da produção. O app só ganha acesso ao que ele mesmo criar (permissão
                    “drive.file”): cria a pasta <em>PFC · Materiais dos editores</em> e organiza tudo dentro dela.
                  </p>
                  <a href="/api/materiais/drive" className="btn-primary inline-block px-4 py-2 rounded-lg text-sm font-bold">
                    Conectar Google Drive
                  </a>
                </>
              )}
            </div>
            <div className="text-white/40 text-xs space-y-1">
              <p>Estrutura das pastas:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li>Quadros / Fora da Caixa / 2026-11-04 · Nome do convidado</li>
                <li>PFC Visita / Nome do negócio (ou o episódio da agenda)</li>
                <li>Anúncios / Cliente ou campanha</li>
                <li>Vinhetas / Pacote (opcional)</li>
              </ul>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
