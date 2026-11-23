import AdminHeader from "@/components/admin/AdminHeader";
import ProducaoForm from "@/components/admin/ProducaoForm";
import QuadroLogo from "@/components/QuadroLogo";
import { requireAcesso } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CAMPANHA, campanhaAtiva } from "@/lib/campanha";
import { quadros } from "@/lib/config";
import { PAPEL_LABEL, STATUS_LABEL, STATUS_STYLE, parcelas, type Indicacao, type IndicacaoStatus } from "@/lib/indicacoes";
import { brl, centsToInput } from "@/lib/money";
import { pagarParcela, salvarIndicacao } from "./actions";

export const dynamic = "force-dynamic";

type Linha = Indicacao & { reseller: { name: string; slug: string; apresentador?: boolean; quadro?: string | null } | null };

const GRUPOS: { titulo: string; status: IndicacaoStatus[] }[] = [
  { titulo: "Para analisar", status: ["registrada"] },
  { titulo: "Em andamento", status: ["aprovada", "reuniao"] },
  { titulo: "Fechadas", status: ["fechada"] },
  { titulo: "Encerradas", status: ["perdida", "rejeitada"] },
];

const input = "admin-input text-sm";

/**
 * Indicações de patrocínio dos parceiros: aprovar (protege 60 dias), levar
 * até o fechamento (congela a comissão) e marcar as parcelas pagas.
 */
export default async function IndicacoesPage() {
  await requireAcesso("revendedores.ver");
  const { data, error } = await createServerSupabase()
    .from("indicacoes")
    .select("*, reseller:resellers(name, slug, apresentador, quadro)")
    .order("created_at", { ascending: false })
    .limit(300);
  const linhas = (data ?? []) as Linha[];

  const aPagar = linhas
    .filter((i) => i.status === "fechada")
    .reduce(
      (s, i) => s + parcelas(i).reduce((t, p, n) => t + ((n === 0 ? i.parcela1_paga_em : i.parcela2_paga_em) ? 0 : p.valor), 0),
      0,
    );

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <a href="/admin/revendedores" className="text-white/40 hover:text-white text-sm">
          ← Revendedores
        </a>
        <h1 className="text-2xl font-bold text-white mt-3">Indicações de patrocínio</h1>
        <p className="text-white/45 text-sm mt-1 max-w-3xl leading-relaxed">
          Responda em até 48h. Aprovar protege a indicação por 60 dias; recuse contato que já está na base ou foi abordado
          nos últimos 90 dias. Ao fechar, informe a mensalidade (no anual, o equivalente mensal): a comissão é calculada e
          congelada, com o bônus de apresentador quando o contrato fecha até {CAMPANHA.prazoLabel}
          {campanhaAtiva() ? "" : " (campanha encerrada)"}.
        </p>

        {error ? (
          <div className="mt-8 p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm">
            A tabela de indicações ainda não existe. Rode <code>supabase/029_indicacoes_patrocinio.sql</code> no SQL Editor do
            Supabase.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
              {[
                { v: String(linhas.filter((i) => i.status === "registrada").length), l: "Para analisar" },
                { v: String(linhas.filter((i) => ["aprovada", "reuniao"].includes(i.status)).length), l: "Em andamento" },
                { v: String(linhas.filter((i) => i.status === "fechada").length), l: "Fechadas" },
                { v: brl(aPagar), l: "Comissão a pagar" },
              ].map((c) => (
                <div key={c.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
                  <div className="text-2xl font-black text-gold-500">{c.v}</div>
                  <div className="text-white/50 text-sm mt-1">{c.l}</div>
                </div>
              ))}
            </div>

            {GRUPOS.map((g) => {
              const itens = linhas.filter((i) => g.status.includes(i.status));
              if (itens.length === 0) return null;
              return (
                <section key={g.titulo} className="mt-10">
                  <h2 className="text-white font-bold mb-3">
                    {g.titulo} <span className="text-white/35 font-normal">({itens.length})</span>
                  </h2>
                  <div className="flex flex-col gap-3">
                    {itens.map((i) => {
                      const q = i.quadro ? quadros.find((x) => x.slug === i.quadro) : undefined;
                      const doQuadro = !!i.reseller?.apresentador && i.reseller.quadro === i.quadro && !!i.quadro;
                      return (
                        <div key={i.id} className="bg-[#111] border border-[#222] rounded-xl p-5">
                          <div className="flex items-start gap-3 flex-wrap">
                            {q && <QuadroLogo quadro={q.slug} nome={q.name} className="w-10 h-10" />}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white font-semibold">{i.empresa}</span>
                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>
                                  {STATUS_LABEL[i.status]}
                                </span>
                                {doQuadro && (
                                  <span className="text-[11px] text-gold-400 border border-gold-500/30 rounded-full px-2 py-0.5">
                                    quadro do apresentador
                                  </span>
                                )}
                              </div>
                              <div className="text-white/45 text-xs mt-1">
                                {i.reseller?.name ?? "parceiro removido"} · {new Date(i.created_at).toLocaleDateString("pt-BR")} ·{" "}
                                {i.origem === "link" ? "veio pelo link (contato no lead)" : "registrada pelo parceiro"} ·{" "}
                                {q ? `Cota do ${q.name}` : "Plano do canal"}
                              </div>
                              {(i.contato || i.whatsapp) && (
                                <div className="text-white/60 text-xs mt-1">
                                  {i.contato}
                                  {i.whatsapp && (
                                    <>
                                      {" · "}
                                      <a href={`https://wa.me/55${i.whatsapp}`} target="_blank" className="text-emerald-400 hover:underline">
                                        {i.whatsapp}
                                      </a>
                                    </>
                                  )}
                                </div>
                              )}
                              {i.interesse && <div className="text-white/45 text-xs mt-1">Interesse: {i.interesse}</div>}
                              {i.observacao && <div className="text-white/45 text-xs mt-1">Parceiro: {i.observacao}</div>}
                            </div>
                            {i.status === "fechada" && (
                              <div className="text-right">
                                <div className="text-gold-500 font-black">{brl(i.comissao_cents ?? 0)}</div>
                                <div className="text-white/35 text-[11px]">
                                  comissão{i.campanha ? " · campanha" : ""}
                                </div>
                              </div>
                            )}
                          </div>

                          <ProducaoForm
                            action={salvarIndicacao}
                            label="Salvar"
                            pending="Salvando..."
                            okMessage="Salvo."
                            className="mt-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-2 items-end"
                            buttonClassName="btn-primary px-4 py-2 rounded-lg text-sm font-bold"
                          >
                            <input type="hidden" name="id" value={i.id} />
                            <select name="status" defaultValue={i.status} className={input} aria-label="Status">
                              {(Object.keys(STATUS_LABEL) as IndicacaoStatus[]).map((s) => (
                                <option key={s} value={s}>
                                  {STATUS_LABEL[s]}
                                </option>
                              ))}
                            </select>
                            <select name="papel" defaultValue={i.papel} className={input} aria-label="Papel">
                              {(Object.keys(PAPEL_LABEL) as (keyof typeof PAPEL_LABEL)[]).map((p) => (
                                <option key={p} value={p}>
                                  {p === "indicou" ? "Indicou (30%)" : p === "vendeu" ? "Vendeu (100%)" : "Apresentador patrocina"}
                                </option>
                              ))}
                            </select>
                            <select name="ciclo" defaultValue={i.ciclo ?? "mensal"} className={input} aria-label="Ciclo">
                              <option value="mensal">Mensal (0,9×; 1× na campanha)</option>
                              <option value="anual">Anual (1,5×)</option>
                            </select>
                            <input
                              name="mensal"
                              defaultValue={i.mensal_cents ? centsToInput(i.mensal_cents) : ""}
                              placeholder="Mensalidade R$"
                              className={input}
                              aria-label="Mensalidade"
                            />
                            <input
                              name="retorno"
                              defaultValue={i.retorno ?? ""}
                              placeholder="Retorno para o parceiro"
                              className={`${input} lg:col-span-1`}
                              aria-label="Retorno"
                            />
                          </ProducaoForm>

                          {i.status === "fechada" && (i.comissao_cents ?? 0) > 0 && (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {parcelas(i).map((p, n) => {
                                const paga = n === 0 ? i.parcela1_paga_em : i.parcela2_paga_em;
                                return paga ? (
                                  <span key={n} className="text-emerald-400 text-xs border border-emerald-500/30 rounded-lg px-3 py-1.5">
                                    Parcela {n + 1} ({brl(p.valor)}) paga em {new Date(paga).toLocaleDateString("pt-BR")}
                                  </span>
                                ) : (
                                  <form key={n} action={pagarParcela}>
                                    <input type="hidden" name="id" value={i.id} />
                                    <input type="hidden" name="parcela" value={n + 1} />
                                    <button className="text-xs border border-[#333] hover:border-gold-500/50 text-white/70 rounded-lg px-3 py-1.5">
                                      Marcar parcela {n + 1} paga ({brl(p.valor)}, {p.quando})
                                    </button>
                                  </form>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
            {linhas.length === 0 && (
              <p className="text-white/40 text-sm mt-10">
                Nenhuma indicação ainda. Elas chegam quando um parceiro registra no painel ou quando uma empresa envia o Monte
                seu plano pelo link dele.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
