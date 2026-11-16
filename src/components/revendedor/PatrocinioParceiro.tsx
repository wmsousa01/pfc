import CopyButton from "@/components/CopyButton";
import ProducaoForm from "@/components/admin/ProducaoForm";
import QuadroLogo from "@/components/QuadroLogo";
import { registrarIndicacao } from "@/app/revendedor/actions";
import { CAMPANHA, campanhaAtiva, diasParaAcabar, quadrosFundador } from "@/lib/campanha";
import { quadros, quadroSponsorship } from "@/lib/config";
import {
  PAPEL_LABEL,
  STATUS_LABEL,
  STATUS_STYLE,
  comissaoCents,
  parcelas,
  type Indicacao,
} from "@/lib/indicacoes";
import { brl } from "@/lib/money";
import type { Reseller } from "@/lib/types";

const input =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold-500/60";

/**
 * Trilha de patrocínio no painel do parceiro: regras e campanha em números,
 * link de patrocínio, registro de indicação e o andamento de cada uma.
 */
export default function PatrocinioParceiro({
  reseller,
  indicacoes,
  linkPlano,
  semTabela,
}: {
  reseller: Reseller;
  indicacoes: Indicacao[];
  linkPlano: string;
  /** Migração 029 ainda não aplicada. */
  semTabela: boolean;
}) {
  const ativa = campanhaAtiva();
  const dias = diasParaAcabar();
  const masterCents = quadroSponsorship.master.monthlyPrice * 100;
  const meuQuadro = reseller.apresentador && reseller.quadro ? quadros.find((q) => q.slug === reseller.quadro) : undefined;
  const ex = (papel: "vendeu" | "indicou", doQuadro = false) =>
    brl(comissaoCents({ mensalCents: masterCents, ciclo: "mensal", papel, quadroDoApresentador: doQuadro, naCampanha: ativa }).total);
  const desconto = CAMPANHA.apresentador.descontoPercent;
  const fundador = quadrosFundador();

  const fechadas = indicacoes.filter((i) => i.status === "fechada");
  const aReceber = fechadas.reduce(
    (s, i) =>
      s +
      parcelas(i).reduce((t, p, n) => t + ((n === 0 ? i.parcela1_paga_em : i.parcela2_paga_em) ? 0 : p.valor), 0),
    0,
  );
  const abertas = indicacoes.filter((i) => ["registrada", "aprovada", "reuniao"].includes(i.status)).length;

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white">Patrocínio</h2>
          <p className="text-white/45 text-sm mt-1">
            Traga uma marca para patrocinar o PFC e ganhe uma mensalidade inteira. É aqui que o programa paga de verdade.
          </p>
        </div>
        <div className="flex gap-3 text-center">
          <div className="bg-[#111] border border-[#222] rounded-xl px-4 py-2">
            <div className="text-gold-500 font-black text-lg">{abertas}</div>
            <div className="text-white/40 text-[11px]">em andamento</div>
          </div>
          <div className="bg-[#111] border border-[#222] rounded-xl px-4 py-2">
            <div className="text-gold-500 font-black text-lg">{brl(aReceber)}</div>
            <div className="text-white/40 text-[11px]">a receber</div>
          </div>
        </div>
      </div>

      {/* Regras em números */}
      <div className="grid md:grid-cols-3 gap-4 mt-5">
        <div className="bg-[#111] border border-gold-500/40 rounded-xl p-5">
          <div className="text-gold-500 text-xs font-bold uppercase tracking-wider">Você vendeu</div>
          <div className="text-white font-black text-2xl mt-1">1 mensalidade</div>
          <p className="text-white/45 text-xs mt-1.5 leading-relaxed">
            Esteve na reunião e o cliente assinou. Cota master de quadro: <b className="text-white/80">{ex("vendeu")}</b>.
            No contrato anual, 1,5× a mensalidade.
          </p>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Você indicou</div>
          <div className="text-white font-black text-2xl mt-1">30%</div>
          <p className="text-white/45 text-xs mt-1.5 leading-relaxed">
            Passou o contato e a equipe conduziu. Cota master de quadro: <b className="text-white/80">{ex("indicou")}</b>.
          </p>
        </div>
        <div className="bg-[#111] border border-[#222] rounded-xl p-5">
          <div className="text-white/50 text-xs font-bold uppercase tracking-wider">Como recebe</div>
          <div className="text-white font-black text-2xl mt-1">Pix</div>
          <p className="text-white/45 text-xs mt-1.5 leading-relaxed">
            Mensal: metade após o 1º pagamento do cliente e metade após o 3º. Anual: tudo em até 7 dias. Só conta
            dinheiro que entrou.
          </p>
        </div>
      </div>

      {/* Campanha */}
      {ativa && (
        <div className="mt-4 rounded-xl border border-gold-500/40 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-black bg-gold-500 px-2.5 py-1 rounded-full">
              Campanha de fim de ano
            </span>
            <span className="text-gold-400 text-xs font-semibold">
              fechando até {CAMPANHA.prazoLabel}
              {dias > 0 ? ` · faltam ${dias} dias` : " · último dia"}
            </span>
          </div>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-white/70 leading-relaxed">
            {fundador.length > 0 && (
              <li className="flex gap-3 items-start">
                <span className="flex -space-x-1.5 flex-shrink-0">
                  {fundador.map((q) => (
                    <QuadroLogo key={q.slug} quadro={q.slug} nome={q.name} className="w-7 h-7" />
                  ))}
                </span>
                <span>
                  <b className="text-white">Argumento para levar ao cliente:</b> quem fechar a cota master de{" "}
                  {fundador.map((q) => q.name).join(" ou ")} vira <b className="text-white">patrocinador fundador</b>: R${" "}
                  {quadroSponsorship.master.monthlyPrice}/mês travado por {CAMPANHA.fundador.precoTravadoMeses} meses e{" "}
                  {CAMPANHA.fundador.bonus}.
                </span>
              </li>
            )}
            {reseller.apresentador && (
              <li>
                <b className="text-white">Bônus de apresentador:</b> patrocínio para{" "}
                {meuQuadro ? `o ${meuQuadro.name}` : "o quadro que você apresenta"} fechado até {CAMPANHA.prazoLabel} rende
                +{CAMPANHA.apresentador.bonusPercent}% na comissão: <b className="text-gold-400">{ex("vendeu", true)}</b> numa
                cota master que você vendeu.
              </li>
            )}
            {reseller.apresentador && (
              <li>
                <b className="text-white">Sua empresa patrocina com {desconto}% off</b> enquanto você apresentar: cota master
                por <b className="text-gold-400">{brl(Math.round((masterCents * (100 - desconto)) / 100))}/mês</b>, e o mesmo
                desconto nos planos do canal. Registre abaixo como &quot;Minha empresa vai patrocinar&quot;.
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-6 mt-6">
        {/* Link + registro */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <h3 className="text-white font-bold">Seu link de patrocínio</h3>
            <p className="text-white/45 text-xs mt-1 leading-relaxed">
              Abre o Monte seu plano: a empresa monta o plano e vê o preço. O pedido que sair de lá entra aqui como
              indicação sua.
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <code className="text-white/70 text-xs bg-[#0a0a0a] border border-[#222] rounded-lg px-3 py-2 break-all flex-1 min-w-0">
                {linkPlano}
              </code>
              <CopyButton value={linkPlano} label="Copiar" />
            </div>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-5">
            <h3 className="text-white font-bold">Registrar indicação</h3>
            <p className="text-white/45 text-xs mt-1 leading-relaxed">
              Registre <b className="text-white/70">antes</b> de procurar a empresa. Aprovada, ela fica protegida para você
              por 60 dias.
            </p>
            {semTabela ? (
              <p className="text-amber-300/80 text-xs mt-3">O registro abre em breve. Por enquanto, use o seu link.</p>
            ) : (
              <ProducaoForm
                action={registrarIndicacao}
                label="Registrar"
                pending="Registrando..."
                okMessage="Registrada! A equipe responde em até 48h."
                className="mt-4 flex flex-col gap-3"
                buttonClassName="btn-primary py-2.5 rounded-lg text-sm font-bold"
              >
                <input name="empresa" required maxLength={120} placeholder="Empresa" className={input} />
                <div className="grid grid-cols-2 gap-3">
                  <input name="contato" maxLength={80} placeholder="Nome do contato" className={input} />
                  <input name="whatsapp" inputMode="tel" maxLength={20} placeholder="WhatsApp com DDD" className={input} />
                </div>
                <select name="quadro" defaultValue={meuQuadro?.slug ?? ""} className={input}>
                  <option value="">Plano do canal (sem quadro)</option>
                  {quadros
                    .filter((q) => q.cota)
                    .map((q) => (
                      <option key={q.slug} value={q.slug}>
                        Cota do {q.name}
                      </option>
                    ))}
                </select>
                <select name="papel" defaultValue="indicou" className={input}>
                  {(["indicou", "vendeu", ...(reseller.apresentador ? ["patrocina" as const] : [])] as const).map((p) => (
                    <option key={p} value={p}>
                      {PAPEL_LABEL[p]}
                    </option>
                  ))}
                </select>
                <textarea
                  name="observacao"
                  rows={2}
                  maxLength={600}
                  placeholder="O que a empresa busca, verba, melhor horário (opcional)"
                  className={input}
                />
              </ProducaoForm>
            )}
          </div>
        </div>

        {/* Lista */}
        <div className="lg:col-span-3 bg-[#111] border border-[#222] rounded-xl overflow-hidden self-start">
          <div className="px-5 py-3 border-b border-[#222] text-white/40 text-xs uppercase tracking-wider">
            Suas indicações
          </div>
          {indicacoes.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">
              Nenhuma ainda. Registre a primeira ou mande seu link para uma empresa.
            </div>
          ) : (
            <ul>
              {indicacoes.map((i) => {
                const q = i.quadro ? quadros.find((x) => x.slug === i.quadro) : undefined;
                return (
                  <li key={i.id} className="px-5 py-4 border-b border-[#1a1a1a] last:border-0">
                    <div className="flex items-start gap-3">
                      {q && <QuadroLogo quadro={q.slug} nome={q.name} className="w-8 h-8" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">{i.empresa}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[i.status]}`}>
                            {STATUS_LABEL[i.status]}
                          </span>
                          {i.origem === "link" && <span className="text-white/35 text-[11px]">chegou pelo seu link</span>}
                        </div>
                        <div className="text-white/35 text-xs mt-0.5">
                          {new Date(i.created_at).toLocaleDateString("pt-BR")} · {q ? `Cota do ${q.name}` : "Plano do canal"} ·{" "}
                          {i.papel === "vendeu" ? "você vende" : i.papel === "patrocina" ? "sua empresa" : "indicação"}
                          {i.protegida_ate && ["aprovada", "reuniao"].includes(i.status)
                            ? ` · protegida até ${new Date(i.protegida_ate).toLocaleDateString("pt-BR")}`
                            : ""}
                        </div>
                        {i.retorno && <p className="text-white/55 text-xs mt-1.5">Equipe: {i.retorno}</p>}
                        {i.status === "fechada" && (i.comissao_cents ?? 0) > 0 && (
                          <ul className="mt-2 flex flex-col gap-0.5">
                            {parcelas(i).map((p, n) => {
                              const paga = n === 0 ? i.parcela1_paga_em : i.parcela2_paga_em;
                              return (
                                <li key={n} className={`text-xs ${paga ? "text-emerald-400" : "text-white/50"}`}>
                                  {brl(p.valor)} {paga ? `pago em ${new Date(paga).toLocaleDateString("pt-BR")}` : p.quando}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                      {i.status === "fechada" && (
                        <div className="text-right">
                          <div className="text-gold-500 font-black">{brl(i.comissao_cents ?? 0)}</div>
                          <div className="text-white/35 text-[11px]">sua comissão</div>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
