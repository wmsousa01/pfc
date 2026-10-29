import AdminHeader from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { getClientAccounts, getPartnersWithoutContract } from "@/lib/client-area";
import { chatAwaitingReply, getClientDeliveries, isJiraConfigured } from "@/lib/jira";
import { activateClientAreaAction } from "./actions";
import { dataBR, input, isLate } from "./shared";

export const dynamic = "force-dynamic";

/**
 * Central das entregas: um cartão por cliente com os alertas (mensagem sem
 * resposta, entrega atrasada, termos pendentes). O trabalho em si acontece
 * na página de cada cliente, /admin/entregas/<slug>.
 */
export default async function EntregasPage() {
  await requireAdmin();

  const [accounts, withoutContract] = await Promise.all([
    getClientAccounts(),
    getPartnersWithoutContract(),
  ]);

  const rows = await Promise.all(
    accounts.map(async (a) => {
      const deliveries = a.jiraEpic ? await getClientDeliveries(a.jiraEpic, { fresh: true }) : null;
      const pending = deliveries?.filter((d) => d.status !== "entregue") ?? [];
      return {
        a,
        total: deliveries?.length ?? 0,
        done: deliveries ? deliveries.length - pending.length : 0,
        late: deliveries?.filter(isLate).length ?? 0,
        next: pending.find((d) => d.dueDate) ?? pending[0] ?? null,
        failed: deliveries === null,
        awaiting: a.jiraChat ? await chatAwaitingReply(a.jiraChat) : false,
      };
    })
  );

  const lateTotal = rows.reduce((n, r) => n + r.late, 0);
  const awaitingTotal = rows.filter((r) => r.awaiting).length;
  const pendingTerms = accounts.filter((a) => !a.acceptedAt).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white">Entregas dos patrocinadores</h1>
        <p className="text-white/40 text-sm mt-1">
          Um cliente por cartão. Abra o cliente para criar e entregar tarefas, ver a conversa e
          reenviar o acesso ao portal.
        </p>

        {!isJiraConfigured() && (
          <div className="mt-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            Jira sem credenciais (SAJIRA_EMAIL/SAJIRA_TOKEN). As entregas não carregam.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {[
            { v: accounts.length, l: "Clientes com portal", c: "text-gold-500" },
            { v: awaitingTotal, l: "Mensagens sem resposta", c: awaitingTotal ? "text-orange-400" : "text-white" },
            { v: lateTotal, l: "Entregas atrasadas", c: lateTotal ? "text-red-400" : "text-white" },
            { v: pendingTerms, l: "Termos não aceitos", c: pendingTerms ? "text-yellow-400" : "text-white" },
          ].map((k) => (
            <div key={k.l} className="bg-[#111] border border-[#222] rounded-xl p-5">
              <div className={`text-3xl font-black ${k.c}`}>{k.v}</div>
              <div className="text-white/50 text-sm mt-1">{k.l}</div>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-10">
          {rows.map(({ a, total, done, late, next, failed, awaiting }) => (
            <a
              key={a.partnerId}
              href={`/admin/entregas/${a.slug}`}
              className="group bg-[#111] border border-[#222] hover:border-gold-500/50 rounded-2xl p-5 flex flex-col gap-3 transition-colors"
            >
              <div>
                <div className="text-white font-bold text-lg group-hover:text-gold-400 transition-colors">
                  {a.name} →
                </div>
                <div className="text-white/40 text-xs mt-0.5">
                  Plano {a.contract.plan} · desde {dataBR(a.contract.start)}
                </div>
              </div>

              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-gold-500" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
              </div>
              <div className="text-white/50 text-xs">
                {failed ? "Não foi possível ler o Jira" : `${done} de ${total} entregas feitas`}
                {next && (
                  <span className="block text-white/35 mt-0.5">
                    Próxima: {next.title} ({dataBR(next.dueDate)})
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 mt-auto">
                {awaiting && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-orange-500/15 border-orange-500/40 text-orange-400">
                    Mensagem sem resposta
                  </span>
                )}
                {late > 0 && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-400">
                    {late} atrasada{late > 1 ? "s" : ""}
                  </span>
                )}
                {!a.acceptedAt && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                    Termos pendentes
                  </span>
                )}
                {!awaiting && !late && a.acceptedAt && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                    Em dia
                  </span>
                )}
              </div>
            </a>
          ))}
        </div>

        {/* Ativar portal de um patrocinador novo */}
        <section className="mt-12 bg-[#111] border border-gold-500/25 rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold text-white">Ativar área do cliente</h2>
          <p className="text-white/40 text-sm mt-1">
            Para um patrocinador que fechou plano. Cria o Epic no Jira e libera termos, entregas e
            mensagens no portal dele.
          </p>
          {withoutContract.length === 0 ? (
            <p className="text-white/40 text-sm mt-4">
              Todos os parceiros cadastrados já têm área do cliente.{" "}
              <a href="/admin/parceiros/new" className="text-gold-500">Cadastrar parceiro novo →</a>
            </p>
          ) : (
            <form action={activateClientAreaAction} className="mt-5 grid sm:grid-cols-2 gap-3">
              <select name="partner_id" required className={input}>
                <option value="">Parceiro…</option>
                {withoutContract.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <input name="plan" required placeholder="Plano (ex.: Patrocinador Anual)" className={input} />
              <input name="price" required inputMode="decimal" placeholder="Valor total (ex.: 7651)" className={input} />
              <input name="payment" placeholder="Como pagou (ex.: Pix à vista em 05/11)" className={input} />
              <label className="flex flex-col gap-1 text-xs text-white/40">
                Início da vigência
                <input name="start" type="date" required className={input} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-white/40">
                Meses
                <input name="months" type="number" min={1} defaultValue={12} required className={input} />
              </label>
              <textarea
                name="deliverables"
                required
                rows={5}
                placeholder={"O que o plano inclui, um item por linha (vira a cláusula dos termos)\nEx.: Logo no estúdio\nMenção nos episódios"}
                className={`${input} sm:col-span-2 resize-y`}
              />
              <button className="btn-primary sm:col-span-2 py-3 rounded-lg text-sm font-bold">
                Criar Epic e ativar o portal
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
