import AdminHeader from "@/components/admin/AdminHeader";
import { EspacoHeader } from "@/components/admin/Espaco";
import { ICONES } from "@/components/admin/nav";
import ProducaoForm from "@/components/admin/ProducaoForm";
import CopiarLink from "@/components/arquivos/CopiarLink";
import EnvioGrande from "@/components/arquivos/EnvioGrande";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/agenda/store";
import { arquivosDa, linkValido, linksDa, tamanhoLegivel, type Pasta } from "@/lib/arquivos/store";
import { site } from "@/lib/config";
import {
  apagarArquivoAction,
  apagarPastaAction,
  cancelarAdminAction,
  concluirAdminAction,
  criarLinkAction,
  criarPastaAction,
  desativarLinkAction,
  iniciarAdminAction,
  linkDownloadAction,
  moverArquivoAction,
  renomearArquivoAction,
  renomearPastaAction,
  retomarAdminAction,
  urlsAdminAction,
} from "./actions";

export const dynamic = "force-dynamic";

const card = "bg-[#111] border border-[#222] rounded-2xl p-5";
const btn2 = "text-xs border border-[#2a2a2a] hover:border-gold-500/50 text-white/70 hover:text-white rounded-lg px-3 py-1.5";
const input = "bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/25";
const link = "text-white/45 hover:text-white";

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function ArquivosPage({ searchParams }: { searchParams: { pasta?: string } }) {
  await requireAdmin();

  // As pastas são poucas: uma consulta só serve para a trilha, as subpastas e o "mover para".
  const { data: rows } = await db().from("arquivos_pastas").select("*").order("nome");
  const pastas = (rows ?? []) as Pasta[];
  const porId = new Map(pastas.map((p) => [p.id, p]));
  const atual = searchParams.pasta ? porId.get(searchParams.pasta) ?? null : null;
  const trilha: Pasta[] = [];
  for (let p = atual; p && trilha.length < 30; p = p.parent_id ? porId.get(p.parent_id) ?? null : null) trilha.unshift(p);
  const rotulo = (p: Pasta): string => {
    const partes: string[] = [];
    for (let x: Pasta | null = p; x && partes.length < 30; x = x.parent_id ? porId.get(x.parent_id) ?? null : null) partes.unshift(x.nome);
    return partes.join(" / ");
  };
  const filhas = pastas.filter((p) => p.parent_id === (atual?.id ?? null));

  const [arquivos, links] = atual ? await Promise.all([arquivosDa(atual.id), linksDa(atual.id)]) : [[], []];
  const prontos = arquivos.filter((a) => a.status === "pronto");
  const pendentes = arquivos.filter((a) => a.status === "enviando");
  const destinos = pastas.filter((p) => p.id !== atual?.id).map((p) => ({ id: p.id, label: rotulo(p) })).sort((a, b) => a.label.localeCompare(b.label));
  const totalBytes = prontos.reduce((n, a) => n + a.tamanho, 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        <EspacoHeader
          area="Arquivos"
          titulo={atual?.nome ?? "Arquivos"}
          extra={atual && <span className="text-white/40 text-sm">{prontos.length} arquivos · {tamanhoLegivel(totalBytes)}</span>}
        />
        <nav className="flex flex-wrap items-center gap-1 text-sm mt-2">
          <a href="/admin/arquivos" className={link}>Arquivos</a>
          {trilha.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <span className="text-white/20">/</span>
              {p.id === atual?.id ? <span className="text-white">{p.nome}</span> : <a href={`/admin/arquivos?pasta=${p.id}`} className={link}>{p.nome}</a>}
            </span>
          ))}
        </nav>

        {/* Subpastas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
          {filhas.map((p) => (
            <a key={p.id} href={`/admin/arquivos?pasta=${p.id}`} className="flex items-center gap-2 bg-[#111] border border-[#222] hover:border-gold-500/40 rounded-xl px-3 py-3 text-sm text-white/80 hover:text-white min-w-0">
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 text-gold-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONES.pasta} />
              </svg>
              <span className="truncate">{p.nome}</span>
            </a>
          ))}
          <details className="bg-[#0d0d0d] border border-dashed border-[#2a2a2a] rounded-xl px-3 py-3 text-sm">
            <summary className="cursor-pointer list-none text-white/50 hover:text-white">+ Nova pasta</summary>
            <ProducaoForm action={criarPastaAction} label="Criar" pending="Criando..." className="mt-2 space-y-2" buttonClassName={btn2}>
              <input type="hidden" name="parent" value={atual?.id ?? ""} />
              <input name="nome" required maxLength={120} placeholder="Nome da pasta" className={`${input} w-full`} />
            </ProducaoForm>
          </details>
        </div>

        {!atual && <p className="text-white/40 text-sm mt-6">Abra uma pasta para enviar arquivos ou criar um link de envio.</p>}

        {atual && (
          <>
            <section className={`${card} mt-6`}>
              <h2 className="text-white font-bold">Enviar para esta pasta</h2>
              <div className="mt-3">
                <EnvioGrande
                  acoes={{
                    iniciar: iniciarAdminAction.bind(null, atual.id),
                    retomar: retomarAdminAction,
                    urls: urlsAdminAction,
                    concluir: concluirAdminAction,
                    cancelar: cancelarAdminAction,
                  }}
                  escopo={`pasta:${atual.id}`}
                  inputCls={input}
                  buttonCls="btn-primary px-4 py-2 rounded-lg text-sm font-bold"
                />
              </div>
            </section>

            <section className={`${card} mt-4`}>
              <h2 className="text-white font-bold">Arquivos</h2>
              {prontos.length === 0 && <p className="text-white/40 text-sm mt-2">Nada aqui ainda.</p>}
              <ul className="divide-y divide-[#1f1f1f] mt-2">
                {prontos.map((a) => (
                  <li key={a.id} className="py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <a href={`/admin/arquivos/baixar/${a.id}`} className="text-white hover:text-gold-400 break-all">{a.nome}</a>
                        <p className="text-white/40 text-xs mt-0.5">
                          {tamanhoLegivel(a.tamanho)} · {a.enviado_por}
                          {a.link_id && " (por link)"} · {quando(a.concluido_em ?? a.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a href={`/admin/arquivos/baixar/${a.id}`} className={btn2}>Baixar</a>
                        <CopiarLink gerar={linkDownloadAction.bind(null, a.id, 7)} label="Link de download (7 dias)" className={btn2} />
                        <details className="relative">
                          <summary className={`${btn2} cursor-pointer list-none`}>Mais</summary>
                          <div className="absolute right-0 z-10 mt-1 w-72 bg-[#111] border border-[#2a2a2a] rounded-xl p-3 space-y-3 shadow-xl">
                            <ProducaoForm action={renomearArquivoAction} label="Renomear" pending="..." className="flex gap-2" buttonClassName={btn2}>
                              <input type="hidden" name="arquivo" value={a.id} />
                              <input name="nome" defaultValue={a.nome} className={`${input} flex-1 min-w-0`} />
                            </ProducaoForm>
                            {destinos.length > 0 && (
                              <ProducaoForm action={moverArquivoAction} label="Mover" pending="..." className="flex gap-2" buttonClassName={btn2}>
                                <input type="hidden" name="arquivo" value={a.id} />
                                <select name="destino" className={`${input} flex-1 min-w-0`}>
                                  {destinos.map((d) => (
                                    <option key={d.id} value={d.id}>{d.label}</option>
                                  ))}
                                </select>
                              </ProducaoForm>
                            )}
                            <form action={apagarArquivoAction}>
                              <input type="hidden" name="arquivo" value={a.id} />
                              <button className="text-xs text-red-400/80 hover:text-red-300">Apagar arquivo</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {pendentes.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[#1f1f1f]">
                  <p className="text-white/50 text-xs font-semibold">Envios não terminados</p>
                  <p className="text-white/30 text-xs">Quem enviou pode continuar escolhendo o mesmo arquivo de novo. Sem retomar, somem em 7 dias.</p>
                  <ul className="mt-2 space-y-1">
                    {pendentes.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-white/60 truncate">
                          {a.nome} · {tamanhoLegivel(a.tamanho)} · {a.enviado_por} · {quando(a.created_at)}
                        </span>
                        <form action={apagarArquivoAction}>
                          <input type="hidden" name="arquivo" value={a.id} />
                          <button className="text-white/30 hover:text-red-400">descartar</button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className={`${card} mt-4`}>
              <h2 className="text-white font-bold">Links de envio</h2>
              <p className="text-white/40 text-xs mt-0.5">
                Para quem é de fora (editor, convidado, parceiro) mandar arquivos para esta pasta sem login.
              </p>
              {links.length > 0 && (
                <ul className="divide-y divide-[#1f1f1f] mt-3">
                  {links.map((l) => {
                    const url = `${site.url}/enviar/${l.token}`;
                    const vale = linkValido(l);
                    return (
                      <li key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className={vale ? "text-white" : "text-white/40 line-through"}>{l.titulo}</p>
                          <p className="text-white/40 text-xs">
                            {vale ? `vale até ${quando(l.expira_em)}` : l.ativo ? "expirado" : "desativado"}
                            {l.max_arquivo ? ` · até ${tamanhoLegivel(l.max_arquivo)} por arquivo` : ""}
                          </p>
                        </div>
                        {vale && (
                          <div className="flex flex-wrap gap-2">
                            <CopiarLink texto={url} className={btn2} />
                            <a href={`https://wa.me/?text=${encodeURIComponent(`${l.titulo}: mande os arquivos por aqui ${url}`)}`} target="_blank" className={btn2}>WhatsApp</a>
                            <a href={url} target="_blank" className={btn2}>Abrir</a>
                            <form action={desativarLinkAction}>
                              <input type="hidden" name="link" value={l.id} />
                              <button className={`${btn2} hover:!text-red-300 hover:!border-red-500/50`}>Desativar</button>
                            </form>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              <details className="mt-3">
                <summary className="cursor-pointer list-none text-gold-400 text-sm font-semibold">+ Novo link de envio</summary>
                <ProducaoForm action={criarLinkAction} label="Criar link" pending="Criando..." okMessage="Link criado." className="mt-3 grid sm:grid-cols-2 gap-2" buttonClassName="btn-primary px-4 py-2 rounded-lg text-xs font-bold sm:col-span-2 justify-self-start">
                  <input type="hidden" name="pasta" value={atual.id} />
                  <input name="titulo" required maxLength={120} placeholder="Título (ex.: Bruto da live de 20/11)" className={`${input} sm:col-span-2`} />
                  <textarea name="mensagem" rows={2} maxLength={1000} placeholder="Mensagem para quem envia (opcional)" className={`${input} sm:col-span-2`} />
                  <label className="text-white/50 text-xs flex items-center gap-2">
                    Vale por
                    <input name="dias" type="number" min={1} max={90} defaultValue={7} className={`${input} w-16`} /> dias
                  </label>
                  <label className="text-white/50 text-xs flex items-center gap-2">
                    Limite por arquivo
                    <input name="max_gb" type="number" min={0} step="0.5" placeholder="sem" className={`${input} w-20`} /> GB
                  </label>
                </ProducaoForm>
              </details>
            </section>

            <section className="mt-6 flex flex-wrap items-start gap-4">
              <details>
                <summary className="cursor-pointer list-none text-white/40 hover:text-white text-xs">Renomear pasta</summary>
                <ProducaoForm action={renomearPastaAction} label="Salvar" pending="..." className="flex gap-2 mt-2" buttonClassName={btn2}>
                  <input type="hidden" name="pasta" value={atual.id} />
                  <input name="nome" defaultValue={atual.nome} className={input} />
                </ProducaoForm>
              </details>
              <details>
                <summary className="cursor-pointer list-none text-red-400/60 hover:text-red-300 text-xs">Apagar pasta</summary>
                <form action={apagarPastaAction} className="flex flex-wrap items-center gap-2 mt-2">
                  <input type="hidden" name="pasta" value={atual.id} />
                  <span className="text-white/40 text-xs">Apaga tudo dentro, no R2 também. Digite o nome da pasta:</span>
                  <input name="confirmar" placeholder={atual.nome} className={input} />
                  <button className="text-xs border border-red-500/40 text-red-300 hover:bg-red-500/10 rounded-lg px-3 py-1.5">Apagar</button>
                </form>
              </details>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
