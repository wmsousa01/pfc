"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { iniciarCheckout, type CheckoutFormState } from "@/app/contratar/actions";
import { opcoesDoPlano, PERIODO_NOME, type Metodo, type Periodo } from "@/lib/checkout";
import { REGRAS_PRECO, type Plan } from "@/lib/planos";
import { MAX_NO_INTEREST } from "@/lib/payment";

const SEGMENTS = [
  "Comércio / Loja",
  "Restaurante / Bar / Alimentação",
  "Saúde / Clínica / Estética",
  "Educação / Escola / Cursos",
  "Imobiliária / Construção",
  "Serviços / Consultoria / Agência",
  "Indústria",
  "Outro",
];

const inputCls =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-4 rounded-xl text-base font-bold disabled:opacity-60">
      {pending ? "Salvando..." : "Revisar e ver os termos"}
    </button>
  );
}

export type Prefill = { lead: string; name: string; company: string; whatsapp: string; segment: string | null };

export default function CheckoutForm({ plan, prefill }: { plan: Plan; prefill: Prefill | null }) {
  const [state, action] = useFormState<CheckoutFormState, FormData>(iniciarCheckout, { error: null });
  const [periodo, setPeriodo] = useState<Periodo>("semestral");
  const [metodo, setMetodo] = useState<Metodo>("pix");
  const opcoes = useMemo(() => opcoesDoPlano(plan), [plan]);
  const atual = opcoes.find((o) => o.periodo === periodo && o.metodo === metodo)!;
  const tabela = plan.monthlyPrice * atual.meses;
  const economia = tabela - atual.valor;

  return (
    <form action={action} className="grid lg:grid-cols-[1fr_340px] gap-8 items-start">
      <input type="hidden" name="plan" value={plan.id} />
      <input type="hidden" name="periodo" value={periodo} />
      <input type="hidden" name="metodo" value={metodo} />
      {prefill && <input type="hidden" name="lead" value={prefill.lead} />}
      <input type="text" name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="flex flex-col gap-8">
        {/* 1. Prazo */}
        <fieldset className="bg-[#111] border border-[#222] rounded-2xl p-5 sm:p-6">
          <legend className="sr-only">Prazo do contrato</legend>
          <h2 className="text-white font-bold text-lg">1. Por quanto tempo?</h2>
          <p className="text-white/45 text-sm mt-1">
            Contrato mínimo de {REGRAS_PRECO.minMeses} meses, pago adiantado. Sem renovação automática.
          </p>
          <div className="grid sm:grid-cols-3 gap-3 mt-4">
            {(["trimestral", "semestral", "anual"] as const).map((p) => {
              const o = opcoes.find((x) => x.periodo === p && x.metodo === "pix")!;
              const sel = p === periodo;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriodo(p)}
                  aria-pressed={sel}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    sel ? "border-gold-500 bg-gold-500/10" : "border-[#2a2a2a] hover:border-gold-500/40"
                  }`}
                >
                  <div className="text-white font-bold">{PERIODO_NOME[p]}</div>
                  <div className="text-white/45 text-xs">{o.meses} meses</div>
                  <div className={`mt-2 font-black ${sel ? "text-gold-400" : "text-white"}`}>{brl(o.valor)}</div>
                  {p === "anual" ? (
                    <div className="text-emerald-400 text-xs mt-1">{REGRAS_PRECO.anualPixOff}% off no Pix</div>
                  ) : (
                    <div className="text-white/35 text-xs mt-1">{brl(plan.monthlyPrice)}/mês de tabela</div>
                  )}
                  {o.vantagem && (
                    <div className="text-gold-500/80 text-[11px] mt-2 leading-snug">+ {REGRAS_PRECO.vantagem}</div>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Pagamento */}
        <fieldset className="bg-[#111] border border-[#222] rounded-2xl p-5 sm:p-6">
          <legend className="sr-only">Forma de pagamento</legend>
          <h2 className="text-white font-bold text-lg">2. Como prefere pagar?</h2>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            {(["pix", "cartao"] as const).map((m) => {
              const o = opcoes.find((x) => x.periodo === periodo && x.metodo === m)!;
              const sel = m === metodo;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetodo(m)}
                  aria-pressed={sel}
                  className={`text-left rounded-xl border p-4 transition-colors ${
                    sel ? "border-gold-500 bg-gold-500/10" : "border-[#2a2a2a] hover:border-gold-500/40"
                  }`}
                >
                  <div className="text-white font-bold">{m === "pix" ? "Pix ou boleto" : "Cartão de crédito"}</div>
                  <div className={`mt-1 font-black ${sel ? "text-gold-400" : "text-white"}`}>{brl(o.valor)}</div>
                  <div className="text-white/45 text-xs mt-1">
                    {m === "pix"
                      ? "À vista. Pix confirma na hora."
                      : `Em até ${MAX_NO_INTEREST}x de ${brl(o.valor / MAX_NO_INTEREST)} sem juros. Acima de ${MAX_NO_INTEREST}x, com juros do Mercado Pago.`}
                  </div>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 3. Dados */}
        <fieldset className="bg-[#111] border border-[#222] rounded-2xl p-5 sm:p-6">
          <legend className="sr-only">Seus dados</legend>
          <h2 className="text-white font-bold text-lg">3. Seus dados</h2>
          <p className="text-white/45 text-sm mt-1">Vão para o contrato e para o recibo do Mercado Pago.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-4">
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Empresa / marca *
              <input name="company" required defaultValue={prefill?.company} className={inputCls} autoComplete="organization" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              CNPJ ou CPF *
              <input name="document" required inputMode="numeric" className={inputCls} placeholder="Só números" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Seu nome *
              <input name="name" required defaultValue={prefill?.name} className={inputCls} autoComplete="name" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              E-mail *
              <input name="email" type="email" required className={inputCls} autoComplete="email" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              WhatsApp com DDD *
              <input name="whatsapp" required inputMode="tel" defaultValue={prefill?.whatsapp} className={inputCls} autoComplete="tel" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60">
              Instagram da marca
              <input name="instagram" className={inputCls} placeholder="@suamarca" />
            </label>
            <label className="flex flex-col gap-1.5 text-sm text-white/60 sm:col-span-2">
              Segmento
              <select name="segment" defaultValue={prefill?.segment ?? ""} className={inputCls}>
                <option value="">Selecione</option>
                {SEGMENTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
        </fieldset>
      </div>

      {/* Resumo */}
      <aside className="lg:sticky lg:top-28 bg-[#0d0d0d] border border-gold-500/30 rounded-2xl p-6 flex flex-col gap-4">
        <div>
          <div className="text-white/40 text-xs uppercase tracking-widest font-bold">Resumo</div>
          <div className="text-2xl font-black text-white mt-1">Plano {plan.name}</div>
          <div className="text-white/50 text-sm">{atual.titulo}</div>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-white/65">
          {plan.features.map((f) => (
            <li key={f}>✓ {f}</li>
          ))}
          <li>✓ Página da marca + QR no episódio</li>
          {atual.vantagem && <li className="text-gold-400">★ {REGRAS_PRECO.vantagem}</li>}
        </ul>
        <div className="border-t border-[#222] pt-4">
          {economia > 0 && (
            <div className="flex justify-between text-sm text-white/40">
              <span>Tabela ({atual.meses} meses)</span>
              <s>{brl(tabela)}</s>
            </div>
          )}
          <div className="flex justify-between items-baseline mt-1">
            <span className="text-white/60">Total</span>
            <span className="text-3xl font-black text-gold-500">{brl(atual.valor)}</span>
          </div>
          {economia > 0 && <div className="text-emerald-400 text-xs text-right">Você economiza {brl(economia)}</div>}
        </div>
        {state.error && (
          <p role="alert" className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}
        <Submit />
        <p className="text-white/35 text-xs leading-relaxed">
          Próximo passo: você lê os termos antes de pagar. Pagamento processado pelo Mercado Pago.
        </p>
      </aside>
    </form>
  );
}
