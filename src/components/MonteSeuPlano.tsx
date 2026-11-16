"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Image from "next/image";
import { enviarPlano, type EnvioState } from "@/app/monte-seu-plano/actions";
import { quadroSponsorship, whatsapp } from "@/lib/config";
import {
  DURACOES,
  OBJETIVOS,
  SEGMENTOS,
  VERBAS,
  VISITA_AVULSO,
  VISITA_CLIENTE,
  modalidadesLivres,
  orcar,
  plans,
  quadrosComCota,
  recomendar,
  type Briefing,
  type Objetivo,
  type Selecao,
} from "@/lib/monte-plano";
import { WhatsAppIcon, ArrowRight } from "@/components/icons";

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR")}`;

const input =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";

function chip(on: boolean) {
  return `rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
    on ? "border-gold-500 bg-gold-500/[0.08] text-white" : "border-[#2a2a2a] bg-[#0d0d0d] text-white/65 hover:border-white/25"
  }`;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative w-12 h-7 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/60 ${
        on ? "bg-gold-500" : "bg-[#333]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function Sugerido({ motivo }: { motivo?: string }) {
  if (!motivo) return null;
  return (
    <p className="mt-2 text-xs leading-relaxed text-gold-500/90">
      <span className="font-bold uppercase tracking-wider text-[10px] mr-1.5">Sugerido</span>
      {motivo}
    </p>
  );
}

function ItemRow(props: {
  titulo: string;
  preco: string;
  detalhe?: string;
  on: boolean;
  onChange: (v: boolean) => void;
  motivo?: string;
  logo?: string;
}) {
  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${props.on ? "border-gold-500/50 bg-gold-500/[0.04]" : "border-[#2a2a2a] bg-[#0d0d0d]"}`}>
      <div className="flex items-start gap-3">
        {props.logo && <Image src={props.logo} alt="" width={40} height={40} className="w-10 h-10 object-contain flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="text-white font-semibold leading-tight">{props.titulo}</div>
          <div className="text-white/45 text-xs mt-1">
            {props.preco}
            {props.detalhe ? ` · ${props.detalhe}` : ""}
          </div>
        </div>
        <Toggle on={props.on} onChange={props.onChange} label={props.titulo} />
      </div>
      <Sugerido motivo={props.motivo} />
    </div>
  );
}

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-4 rounded-xl font-bold disabled:opacity-60">
      {pending ? "Enviando..." : "Enviar para o comercial"}
    </button>
  );
}

const vazio: Briefing = { empresa: "", segmento: "", objetivos: [], verba: "500-1000", exclusividade: false, quadro: "" };
const inicial: EnvioState = { ok: false, error: null, resumo: null };

export default function MonteSeuPlano() {
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [b, setB] = useState<Briefing>(vazio);
  const [sel, setSel] = useState<Selecao | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});
  const [state, action] = useFormState(enviarPlano, inicial);

  const orc = useMemo(() => (sel ? orcar(sel) : null), [sel]);
  const cotas = quadrosComCota();
  const mods = modalidadesLivres();

  const sugerir = () => {
    const r = recomendar(b);
    setSel(r.selecao);
    setMotivos(r.motivos);
    setEtapa(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleIn = (lista: string[], v: string, on: boolean) => (on ? [...lista, v] : lista.filter((x) => x !== v));
  const setObj = (o: Objetivo) =>
    setB((x) => ({ ...x, objetivos: x.objetivos.includes(o) ? x.objetivos.filter((y) => y !== o) : [...x.objetivos, o] }));

  const passos = ["Sua marca", "Objetivos", "Seu plano"];

  return (
    <div className="container-px max-w-6xl mx-auto">
      {/* Progresso */}
      <ol className="flex items-center justify-center gap-2 sm:gap-4 mb-10 text-xs sm:text-sm">
        {passos.map((p, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const ativo = etapa === n;
          const feito = etapa > n;
          return (
            <li key={p} className="flex items-center gap-2">
              <button
                type="button"
                disabled={!feito}
                onClick={() => setEtapa(n)}
                className={`w-7 h-7 rounded-full font-black flex items-center justify-center ${
                  ativo ? "bg-gold-500 text-black" : feito ? "bg-gold-500/20 text-gold-500" : "bg-white/5 text-white/30"
                }`}
              >
                {n}
              </button>
              <span className={ativo ? "text-white font-semibold" : "text-white/40"}>{p}</span>
              {i < passos.length - 1 && <span className="w-6 sm:w-10 h-px bg-white/10" />}
            </li>
          );
        })}
      </ol>

      {/* 1 · Marca */}
      {etapa === 1 && (
        <div className="max-w-2xl mx-auto flex flex-col gap-6">
          <label className="block">
            <span className="text-white/70 text-sm font-semibold">Nome da sua empresa</span>
            <input
              className={`${input} mt-2`}
              value={b.empresa}
              onChange={(e) => setB({ ...b, empresa: e.target.value })}
              placeholder="Ex.: Box Guaçu Crossfit"
              maxLength={120}
            />
          </label>
          <div>
            <span className="text-white/70 text-sm font-semibold">Qual é o seu segmento?</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {SEGMENTOS.map((s) => (
                <button key={s.label} type="button" className={chip(b.segmento === s.label)} onClick={() => setB({ ...b, segmento: s.label })}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={!b.empresa.trim() || !b.segmento}
            onClick={() => setEtapa(2)}
            className="btn-primary self-end px-8 py-4 rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-40"
          >
            Continuar <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2 · Objetivos */}
      {etapa === 2 && (
        <div className="max-w-2xl mx-auto flex flex-col gap-7">
          <div>
            <span className="text-white/70 text-sm font-semibold">O que você quer com o anúncio? Pode marcar mais de um.</span>
            <div className="grid sm:grid-cols-2 gap-2 mt-2">
              {OBJETIVOS.map((o) => (
                <button key={o.id} type="button" className={chip(b.objetivos.includes(o.id))} onClick={() => setObj(o.id)}>
                  <span className="block font-semibold">{o.label}</span>
                  <span className="block text-xs text-white/40 mt-0.5">{o.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-white/70 text-sm font-semibold">Quanto pensa em investir por mês?</span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {VERBAS.map((v) => (
                <button key={v.id} type="button" className={chip(b.verba === v.id)} onClick={() => setB({ ...b, verba: v.id })}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-white/70 text-sm font-semibold">Tem um quadro preferido?</span>
            <select className={`${input} mt-2`} value={b.quadro} onChange={(e) => setB({ ...b, quadro: e.target.value })}>
              <option value="">Deixa com vocês, sugiram o melhor</option>
              {cotas.map((q) => (
                <option key={q.slug} value={q.slug}>
                  {q.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-[#2a2a2a] bg-[#0d0d0d] p-4">
            <div>
              <div className="text-white font-semibold text-sm">Quero exclusividade no meu segmento</div>
              <div className="text-white/40 text-xs mt-0.5">Nenhum concorrente direto anunciando junto.</div>
            </div>
            <Toggle on={b.exclusividade} onChange={(v) => setB({ ...b, exclusividade: v })} label="Exclusividade" />
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setEtapa(1)} className="text-white/50 text-sm hover:text-white">
              ← Voltar
            </button>
            <button
              type="button"
              disabled={b.objetivos.length === 0}
              onClick={sugerir}
              className="btn-primary px-8 py-4 rounded-xl font-bold inline-flex items-center gap-2 disabled:opacity-40"
            >
              Ver meu plano <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3 · Plano com toggles */}
      {etapa === 3 && sel && orc && (
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
          <div className="flex flex-col gap-8">
            <p className="text-white/55 leading-relaxed">
              Montamos uma sugestão para a <strong className="text-white">{b.empresa}</strong> com base no que você contou.
              Ligue e desligue os itens: o preço ao lado muda na hora.
            </p>

            {/* Plano do canal */}
            <section>
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Presença no canal todo</h3>
              <div className="flex flex-col gap-3">
                {plans.map((p) => (
                  <ItemRow
                    key={p.id}
                    titulo={`Plano ${p.name}`}
                    preco={`${brl(p.monthlyPrice)}/mês`}
                    detalhe={p.features.slice(0, 3).join(", ")}
                    on={sel.plano === p.id}
                    onChange={(on) => setSel({ ...sel, plano: on ? p.id : null })}
                    motivo={sel.plano === p.id ? motivos[`plano:${p.id}`] : undefined}
                  />
                ))}
              </div>
              <p className="text-white/30 text-xs mt-2">Um plano por vez: ligar um desliga o outro.</p>
            </section>

            {/* Cotas de quadro */}
            <section>
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Sua marca apresenta um quadro</h3>
              <div className="flex flex-col gap-3">
                {cotas.map((q) => (
                  <ItemRow
                    key={q.slug}
                    titulo={`Cota Master · ${q.name}`}
                    preco={`${brl(quadroSponsorship.master.monthlyPrice)}/mês`}
                    detalhe={q.cota?.status === "negociacao" ? "em negociação, sujeita a disponibilidade" : "exclusiva no quadro"}
                    logo={q.logo}
                    on={sel.quadros.includes(q.slug)}
                    onChange={(on) => setSel({ ...sel, quadros: toggleIn(sel.quadros, q.slug, on) })}
                    motivo={sel.quadros.includes(q.slug) ? motivos[`quadro:${q.slug}`] : undefined}
                  />
                ))}
              </div>
            </section>

            {/* Apoio por modalidade */}
            {mods.length > 0 && (
              <section>
                <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Apoio por modalidade</h3>
                <div className="flex flex-col gap-3">
                  {mods.map((m) => (
                    <ItemRow
                      key={m.key}
                      titulo={`${m.nome} · ${m.quadro.name}`}
                      preco="Sob consulta"
                      detalhe="só nos episódios da modalidade"
                      logo={m.quadro.logo}
                      on={sel.modalidades.includes(m.key)}
                      onChange={(on) => setSel({ ...sel, modalidades: toggleIn(sel.modalidades, m.key, on) })}
                      motivo={sel.modalidades.includes(m.key) ? motivos[`modalidade:${m.key}`] : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Visita */}
            <section>
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Episódio no seu espaço</h3>
              <ItemRow
                titulo="PFC Visita"
                preco={sel.plano || sel.quadros.length ? `${brl(VISITA_CLIENTE)} (preço de cliente)` : brl(VISITA_AVULSO)}
                detalhe="pagamento único"
                on={sel.visita}
                onChange={(on) => setSel({ ...sel, visita: on })}
                motivo={sel.visita ? motivos.visita : undefined}
              />
            </section>

            {/* Duração */}
            <section>
              <h3 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">Por quanto tempo?</h3>
              <div className="grid grid-cols-4 gap-2">
                {DURACOES.map((d) => {
                  const bloqueado = d < orc.minMeses;
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={bloqueado}
                      onClick={() => setSel({ ...sel, meses: d })}
                      className={`${chip(orc.meses === d)} text-center disabled:opacity-30 disabled:cursor-not-allowed`}
                    >
                      <span className="block font-bold">{d === 12 ? "1 ano" : `${d} ${d === 1 ? "mês" : "meses"}`}</span>
                      {d === 12 && <span className="block text-[10px] text-emerald-400 font-bold">20% OFF no plano</span>}
                    </button>
                  );
                })}
              </div>
              {orc.minMeses > 1 && (
                <p className="text-white/35 text-xs mt-2">
                  Cotas de quadro e de modalidade têm contrato mínimo de {orc.minMeses} meses.
                </p>
              )}
            </section>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-white/55">
              <span className="text-white font-semibold">Incluso em tudo:</span> página da sua marca em
              pfctv.com.br/parceiros, QR code na tela e relatório de acessos.
            </div>
          </div>

          {/* Resumo fixo */}
          <aside className="lg:sticky lg:top-28 rounded-2xl border-2 border-gold-500/60 bg-[#0d0d0d] p-6 flex flex-col gap-4">
            <div>
              <span className="section-tag">Seu plano</span>
              <div className="text-white/40 text-xs mt-1">
                {orc.meses} {orc.meses === 1 ? "mês" : "meses"} · estimativa, o comercial confirma
              </div>
            </div>

            {orc.vazio ? (
              <p className="text-white/50 text-sm">Ligue pelo menos um item para ver o preço.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {orc.linhas.map((l) => (
                  <li key={l.key} className="flex justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <div className="text-white font-semibold leading-tight">{l.label}</div>
                      <div className="text-white/40 text-xs mt-0.5">{l.detalhe}</div>
                    </div>
                    <div className="text-white font-bold whitespace-nowrap">{l.valor === null ? "a consultar" : brl(l.valor)}</div>
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-white/10 pt-4">
              <div className="flex items-baseline justify-between">
                <span className="text-white/60 text-sm">Total estimado</span>
                <span className="text-3xl font-black text-gold-500">{brl(orc.total)}</span>
              </div>
              {orc.sobConsulta.length > 0 && (
                <p className="text-white/40 text-xs mt-1 text-right">+ {orc.sobConsulta.join(", ")} (sob consulta)</p>
              )}
              <ul className="mt-3 flex flex-col gap-1">
                {orc.pagamento.map((p) => (
                  <li key={p} className="text-white/40 text-xs leading-relaxed">
                    {p}
                  </li>
                ))}
              </ul>
            </div>

            {state.ok ? (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4 text-sm text-emerald-300 flex flex-col gap-3">
                <span>Recebemos seu plano. O comercial vai te chamar no WhatsApp para fechar os detalhes.</span>
                {state.resumo && (
                  <a
                    href={whatsapp(state.resumo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary py-3 rounded-xl font-bold inline-flex items-center justify-center gap-2"
                  >
                    <WhatsAppIcon className="w-4 h-4" /> Adiantar pelo WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <form action={action} className="flex flex-col gap-3">
                <input type="hidden" name="plano" value={JSON.stringify({ briefing: b, selecao: { ...sel, meses: orc.meses } })} />
                <input type="text" name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
                <input name="name" required placeholder="Seu nome" className={input} maxLength={120} />
                <input name="whatsapp" required inputMode="tel" placeholder="WhatsApp com DDD" className={input} />
                {state.error && <p className="text-red-400 text-sm">{state.error}</p>}
                {!orc.vazio && <Enviar />}
                <p className="text-white/30 text-[11px] leading-relaxed">
                  Sem pagamento agora. O comercial confere a disponibilidade e manda a proposta final.
                </p>
              </form>
            )}

            <button
              type="button"
              onClick={sugerir}
              className="text-white/40 text-xs hover:text-white self-center"
            >
              Voltar para a sugestão original
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
