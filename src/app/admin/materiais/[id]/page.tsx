import { notFound } from "next/navigation";
import AdminHeader from "@/components/admin/AdminHeader";
import EnvioMaterial from "@/components/admin/EnvioMaterial";
import ProducaoForm from "@/components/admin/ProducaoForm";
import { EspacoHeader, selo } from "@/components/admin/Espaco";
import { requireAcesso } from "@/lib/auth";
import { TZ } from "@/lib/agenda/store";
import { linkDrive, linkPasta } from "@/lib/materiais/drive";
import {
  STATUS_MATERIAL,
  TIPOS,
  eventosDe,
  getMaterial,
  podeAprovar,
  podeVer,
  tamanhoLegivel,
  versoesDe,
} from "@/lib/materiais/store";
import { arquivarAction, revisarAction } from "../actions";
import { origemDo } from "../shared";

export const dynamic = "force-dynamic";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

const inputCls =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/50";

export default async function MaterialPage({ params }: { params: { id: string } }) {
  const acesso = await requireAcesso("materiais.ver");
  const m = await getMaterial(params.id);
  if (!m || m.status === "enviando" || !podeVer(acesso, m)) notFound();

  const revisor = podeAprovar(acesso);
  const [versoes, eventos] = await Promise.all([versoesDe(m), eventosDe(m.id)]);
  const atual = versoes[versoes.length - 1];
  const meu = m.enviado_por === acesso.userId;
  const emRevisao = m.status === "recebido" || m.status === "ajuste" || m.status === "aprovado";
  const podeNovaVersao = (meu || revisor) && (m.status === "ajuste" || m.status === "recebido");

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <a href="/admin/materiais" className="text-white/45 hover:text-white text-xs">
          ← Materiais
        </a>
        <EspacoHeader
          area="Materiais"
          titulo={m.titulo}
          extra={
            <>
              <span className={`${selo} ${STATUS_MATERIAL[m.status].cls}`}>{STATUS_MATERIAL[m.status].label}</span>
              {m.versao > 1 && <span className="text-white/50 text-xs">v{m.versao}</span>}
            </>
          }
        />

        {m.status === "substituido" && atual.id !== m.id && (
          <p className="mt-3 text-sm text-white/60">
            Esta é uma versão antiga.{" "}
            <a href={`/admin/materiais/${atual.id}`} className="text-gold-400 underline">
              Ver a versão atual (v{atual.versao})
            </a>
          </p>
        )}

        <div className="grid gap-4 lg:grid-cols-[1fr_320px] mt-5">
          <div className="space-y-4">
            <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-white/40">Origem</dt>
                <dd className="text-white">{origemDo(m)}</dd>
                <dt className="text-white/40">Tipo</dt>
                <dd className="text-white">{TIPOS[m.tipo] ?? m.tipo}</dd>
                <dt className="text-white/40">Arquivo</dt>
                <dd className="text-white break-all">
                  {m.nome_arquivo} <span className="text-white/40">· {tamanhoLegivel(m.tamanho)}</span>
                </dd>
                <dt className="text-white/40">Enviado por</dt>
                <dd className="text-white">
                  {m.enviado_por_nome ?? "—"} <span className="text-white/40">· {quando(m.created_at)}</span>
                </dd>
                {m.episodio_id && revisor && (
                  <>
                    <dt className="text-white/40">Episódio</dt>
                    <dd>
                      <a href={`/admin/agenda/${m.episodio_id}`} className="text-gold-400 hover:text-gold-300">
                        Abrir na agenda
                      </a>
                    </dd>
                  </>
                )}
              </dl>
              {m.nota && (
                <p className="text-white/70 text-sm border-l-2 border-[#2a2a2a] pl-3">
                  <span className="text-white/40 text-xs block">Recado do editor</span>
                  {m.nota}
                </p>
              )}
              {m.comentario && (
                <p
                  className={`text-sm border-l-2 pl-3 ${m.status === "ajuste" ? "border-red-500/50 text-red-200" : "border-emerald-500/40 text-white/75"}`}
                >
                  <span className="text-white/40 text-xs block">
                    {m.status === "ajuste" ? "Ajuste pedido" : "Comentário da revisão"} por {m.revisado_por}
                    {m.revisado_em ? ` · ${quando(m.revisado_em)}` : ""}
                  </span>
                  {m.comentario}
                </p>
              )}
              {m.drive_file_id && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <a
                    href={linkDrive(m.drive_file_id)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary px-3 py-1.5 rounded-lg text-sm font-bold"
                  >
                    Abrir no Drive ↗
                  </a>
                  {revisor && m.drive_pasta_id && (
                    <a
                      href={linkPasta(m.drive_pasta_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm border border-[#2a2a2a] text-white/70 hover:text-white rounded-lg px-3 py-1.5"
                    >
                      Pasta ↗
                    </a>
                  )}
                </div>
              )}
            </section>

            {revisor && emRevisao && (
              <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
                <h2 className="text-white font-semibold text-sm">Revisão</h2>
                <ProducaoForm action={revisarAction} label="Aprovar" pending="Salvando..." okMessage="Aprovado." className="space-y-2">
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="decisao" value="aprovado" />
                  <textarea name="comentario" rows={2} placeholder="Comentário (opcional)" className={inputCls} />
                </ProducaoForm>
                <ProducaoForm
                  action={revisarAction}
                  label="Pedir ajuste"
                  pending="Salvando..."
                  okMessage="Ajuste pedido. O editor vê no painel dele."
                  className="space-y-2 pt-2 border-t border-[#1f1f1f]"
                  buttonClassName="px-4 py-2 rounded-lg text-sm font-bold border border-red-500/40 text-red-300 hover:text-red-200"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <input type="hidden" name="decisao" value="ajuste" />
                  <textarea
                    name="comentario"
                    rows={3}
                    required
                    placeholder="O que precisa mudar? Ex.: 02:14 cortar a fala repetida; legenda com erro no nome"
                    className={inputCls}
                  />
                </ProducaoForm>
              </section>
            )}

            {podeNovaVersao && (
              <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
                <h2 className="text-white font-semibold text-sm mb-3">Enviar nova versão (v{m.versao + 1})</h2>
                <EnvioMaterial quadros={[]} episodios={[]} substitui={{ id: m.id, titulo: m.titulo }} />
              </section>
            )}
          </div>

          <aside className="space-y-4">
            {versoes.length > 1 && (
              <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
                <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Versões</h2>
                <ol className="space-y-1.5">
                  {versoes
                    .slice()
                    .reverse()
                    .map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
                        <a
                          href={`/admin/materiais/${v.id}`}
                          className={v.id === m.id ? "text-gold-400 font-semibold" : "text-white/70 hover:text-white"}
                        >
                          v{v.versao} · {quando(v.created_at)}
                        </a>
                        <span className={`${selo} ${STATUS_MATERIAL[v.status].cls}`}>{STATUS_MATERIAL[v.status].label}</span>
                      </li>
                    ))}
                </ol>
              </section>
            )}

            <section className="bg-[#111] border border-[#1f1f1f] rounded-xl p-4">
              <h2 className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-2">Histórico</h2>
              {eventos.length === 0 ? (
                <p className="text-white/35 text-sm">Sem registros.</p>
              ) : (
                <ul className="space-y-2">
                  {eventos.map((e) => (
                    <li key={e.id} className="text-sm">
                      <span className="text-white">{e.actor}</span> <span className="text-white/60">{e.action}</span>
                      <span className="text-white/35 text-xs"> · {quando(e.created_at)}</span>
                      {e.detail && <p className="text-white/45 text-xs break-words">{e.detail}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {revisor && m.status !== "arquivado" && m.status !== "substituido" && (
              <ProducaoForm
                action={arquivarAction}
                label="Arquivar"
                pending="Arquivando..."
                buttonClassName="text-xs text-white/40 hover:text-white/70"
              >
                <input type="hidden" name="id" value={m.id} />
              </ProducaoForm>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
