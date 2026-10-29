"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  submitPartnerLead,
  handOffLead,
  type PartnerLeadState,
} from "@/app/parceiros/[slug]/actions";
import {
  MODES,
  NEEDS,
  QUANTITIES,
  TIMEFRAMES,
  businessTypesFor,
  type TriageOption,
} from "@/lib/lead-triage";
import { imovelSteps, type ImovelOption } from "@/lib/lead-triage-imoveis";
import type { PartnerTheme } from "@/lib/brandkit";
import type { PartnerTriage } from "@/lib/types";
import { WhatsAppIcon } from "@/components/icons";
import { CheckIcon } from "./icons";

type Answers = {
  need: string;
  mode: string;
  /** Só na triagem de imóveis. */
  payment: string;
  business_type: string;
  quantity: string;
  timeframe: string;
  name: string;
  whatsapp: string;
  city: string;
  note: string;
};

const INITIAL_STATE: PartnerLeadState = {
  ok: false,
  error: null,
  waUrl: null,
  temperature: null,
  leadId: null,
};

const EMPTY: Answers = {
  need: "",
  mode: "",
  payment: "",
  business_type: "",
  quantity: "",
  timeframe: "",
  name: "",
  whatsapp: "",
  city: "",
  note: "",
};

type Step = {
  key: keyof Answers | "contato";
  question: string;
  helper?: string;
  options?: ImovelOption[];
  /** Opções em coluna (rótulos longos) em vez de grade. */
  stacked?: boolean;
};

/** Máscara leve de telefone brasileiro — só formata, a validação é no server. */
function maskPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function SubmitButton({ theme, label }: { theme: PartnerTheme; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full py-4 px-6 font-bold text-base transition-transform hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
      style={{
        backgroundColor: theme.primary,
        color: theme.onPrimary,
        borderRadius: theme.radius,
        boxShadow: `0 12px 30px ${theme.primary}55`,
      }}
    >
      {pending ? "Enviando..." : label}
    </button>
  );
}

/**
 * Triagem conversacional: uma pergunta por vez, respondida em um toque.
 * Cada resposta é um critério de qualificação — no fim, o parceiro recebe o
 * lead com equipamento, prazo, volume e tipo de negócio já definidos.
 */
export default function PartnerLeadForm({
  slug,
  partnerName,
  theme,
  triage,
  source,
  fallbackUrl,
  fallbackLabel,
}: {
  slug: string;
  partnerName: string;
  theme: PartnerTheme;
  triage?: PartnerTriage;
  source?: string;
  /** Para onde levar quem fica fora do perfil (ex.: Instagram do parceiro). */
  fallbackUrl?: string | null;
  fallbackLabel?: string;
}) {
  const [state, formAction] = useFormState(submitPartnerLead, INITIAL_STATE);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  /** Mensagem de "fora do perfil" quando a resposta encerra a triagem. */
  const [stopped, setStopped] = useState<string | null>(null);
  const imoveis = triage?.kind === "imoveis";
  const [origin, setOrigin] = useState(source ?? "");
  const shellRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // A página é estática, então a origem (?src=qr vindo de /go/{slug}) é lida
  // aqui no cliente em vez de no servidor.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src") ?? params.get("utm_source");
    if (src) setOrigin(src.slice(0, 40));
  }, []);

  const steps: Step[] = imoveis
    ? imovelSteps(answers.need, partnerName)
    : [
    {
      key: "need",
      question: "O que você precisa gelar?",
      helper: "Sem problema se ainda não souber — a gente ajuda a escolher.",
      options: NEEDS,
    },
    {
      key: "mode",
      question: "Prefere alugar ou comprar?",
      options: MODES,
    },
    {
      key: "business_type",
      question: "Onde o equipamento vai ficar?",
      options: businessTypesFor(triage),
      stacked: true,
    },
    {
      key: "quantity",
      question: "Quantos equipamentos?",
      options: QUANTITIES,
    },
    {
      key: "timeframe",
      question: "Para quando você precisa?",
      helper: "É o que define a prioridade do seu atendimento.",
      options: TIMEFRAMES,
    },
    {
      key: "contato",
      question: "Perfeito. Para onde mandamos a proposta?",
      helper: `${partnerName} recebe tudo o que você respondeu junto com seu contato.`,
    },
  ];

  const current = steps[step];
  const total = steps.length;
  const progress = state.ok ? 100 : Math.round((step / total) * 100);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    shellRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [step, state.ok]);

  function pick(key: keyof Answers, value: string, stop?: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
    if (stop) {
      setStopped(stop);
      return;
    }
    // Uma pergunta respondida avança sozinha: menos atrito, menos abandono.
    setStep((s) => Math.min(s + 1, total - 1));
  }

  const canSubmit =
    answers.name.trim().length > 1 &&
    answers.whatsapp.replace(/\D/g, "").length >= 10;

  const cardStyle = {
    backgroundColor: theme.surfaceStrong,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius,
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: theme.bg,
    border: `1px solid ${theme.border}`,
    borderRadius: Math.max(8, theme.radius - 6),
    color: theme.fg,
  };

  /* ------------------------------- sucesso ------------------------------- */
  if (state.ok) {
    return (
      <div ref={shellRef} className="p-7 sm:p-9 text-center" style={cardStyle}>
        <div
          className="w-16 h-16 mx-auto flex items-center justify-center"
          style={{
            borderRadius: 999,
            backgroundColor: `${theme.primary}22`,
            color: theme.primaryText,
            border: `1px solid ${theme.primary}55`,
          }}
        >
          <CheckIcon className="w-8 h-8" />
        </div>

        <h3
          className="text-2xl mt-5"
          style={{ color: theme.fg, ...theme.heading }}
        >
          Pedido registrado!
        </h3>
        <p
          className="mt-3 leading-relaxed max-w-md mx-auto"
          style={{ color: theme.fgMuted }}
        >
          {state.temperature === "quente"
            ? `Seu pedido entrou como prioridade. Chame agora no WhatsApp — a ${partnerName} já recebe tudo o que você respondeu.`
            : `A ${partnerName} vai te chamar. Se quiser adiantar, é só clicar abaixo — o resumo do seu pedido já vai escrito.`}
        </p>

        {state.waUrl && (
          <a
            href={state.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (state.leadId) void handOffLead(state.leadId);
            }}
            className="mt-6 inline-flex items-center justify-center gap-3 px-7 py-4 font-bold transition-transform hover:-translate-y-0.5"
            style={{
              backgroundColor: theme.primary,
              color: theme.onPrimary,
              borderRadius: theme.radius,
              boxShadow: `0 12px 30px ${theme.primary}55`,
            }}
          >
            <WhatsAppIcon className="w-5 h-5" />
            Falar no WhatsApp agora
          </a>
        )}

        <p className="text-xs mt-5" style={{ color: theme.fgSubtle }}>
          Seu contato é usado só para este atendimento.
        </p>
      </div>
    );
  }

  /* ---------------------------- fora do perfil --------------------------- */
  if (stopped) {
    return (
      <div ref={shellRef} className="p-7 sm:p-9 text-center" style={cardStyle}>
        <p className="leading-relaxed max-w-md mx-auto" style={{ color: theme.fg }}>
          {stopped}
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          {fallbackUrl && (
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3.5 font-bold text-sm"
              style={{ backgroundColor: theme.primary, color: theme.onPrimary, borderRadius: theme.radius }}
            >
              {fallbackLabel ?? "Conhecer o parceiro"}
            </a>
          )}
          <button
            type="button"
            onClick={() => {
              setStopped(null);
              setAnswers((p) => ({ ...p, mode: "" }));
            }}
            className="px-6 py-3.5 text-sm font-semibold"
            style={{ border: `1px solid ${theme.border}`, borderRadius: theme.radius, color: theme.fgMuted }}
          >
            ← Escolher outra faixa
          </button>
        </div>
      </div>
    );
  }

  /* ------------------------------ formulário ----------------------------- */
  return (
    <div ref={shellRef} className="overflow-hidden" style={cardStyle}>
      {/* Progresso */}
      <div className="h-1.5 w-full" style={{ backgroundColor: theme.surface }}>
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${Math.max(progress, 6)}%`,
            background: `linear-gradient(90deg, ${theme.secondary}, ${theme.primary})`,
          }}
        />
      </div>

      <form action={formAction} className="p-6 sm:p-8">
        {/* Contexto para o server action */}
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="source" value={origin} />
        {/* Honeypot — invisível para humanos */}
        <input
          type="text"
          name="site_url"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        {/* Todas as respostas viajam juntas, independente do passo visível */}
        {(Object.keys(EMPTY) as (keyof Answers)[]).map((k) =>
          k === "name" || k === "whatsapp" || k === "city" || k === "note" ? null : (
            <input key={k} type="hidden" name={k} value={answers[k]} />
          )
        )}

        <div className="flex items-center justify-between gap-4">
          <span
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: theme.primaryText }}
          >
            Passo {step + 1} de {total}
          </span>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="text-xs hover:opacity-100 opacity-70 transition-opacity"
              style={{ color: theme.fgMuted }}
            >
              ← voltar
            </button>
          )}
        </div>

        <h3
          className="text-2xl sm:text-3xl mt-3 leading-tight"
          style={{ color: theme.fg, ...theme.heading }}
        >
          {current.question}
        </h3>
        {current.helper && (
          <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.fgSubtle }}>
            {current.helper}
          </p>
        )}

        {/* Opções */}
        {current.options && (
          <div
            role="radiogroup"
            aria-label={current.question}
            className={
              current.stacked
                ? "mt-6 grid sm:grid-cols-2 gap-2.5"
                : "mt-6 grid grid-cols-2 gap-3"
            }
          >
            {current.options.map((o) => {
              const key = current.key as keyof Answers;
              const selected = answers[key] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => pick(key, o.value, o.stop)}
                  className="text-left p-4 transition-all hover:-translate-y-0.5"
                  style={{
                    borderRadius: Math.max(10, theme.radius - 4),
                    backgroundColor: selected ? `${theme.primary}1f` : theme.surface,
                    border: `1px solid ${selected ? theme.primary : theme.border}`,
                    color: theme.fg,
                    boxShadow: selected ? `0 8px 24px ${theme.primary}33` : "none",
                  }}
                >
                  <span className="font-bold text-[15px] block">{o.label}</span>
                  {o.hint && (
                    <span className="text-xs mt-0.5 block" style={{ color: theme.fgSubtle }}>
                      {o.hint}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Contato */}
        {current.key === "contato" && (
          <div className="mt-6 flex flex-col gap-3">
            <input
              name="name"
              required
              value={answers.name}
              onChange={(e) => setAnswers((p) => ({ ...p, name: e.target.value }))}
              placeholder="Seu nome *"
              className="w-full px-4 py-3.5 text-sm outline-none placeholder:opacity-40"
              style={inputStyle}
            />
            <input
              name="whatsapp"
              required
              type="tel"
              inputMode="tel"
              value={answers.whatsapp}
              onChange={(e) =>
                setAnswers((p) => ({ ...p, whatsapp: maskPhone(e.target.value) }))
              }
              placeholder="WhatsApp com DDD *"
              className="w-full px-4 py-3.5 text-sm outline-none placeholder:opacity-40"
              style={inputStyle}
            />
            <input
              name="city"
              value={answers.city}
              onChange={(e) => setAnswers((p) => ({ ...p, city: e.target.value }))}
              placeholder={imoveis ? "Cidade ou bairro de interesse" : "Cidade / bairro"}
              list="triage-cities"
              className="w-full px-4 py-3.5 text-sm outline-none placeholder:opacity-40"
              style={inputStyle}
            />
            {triage?.cities?.length ? (
              <datalist id="triage-cities">
                {triage.cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            ) : null}
            <textarea
              name="note"
              rows={3}
              value={answers.note}
              onChange={(e) => setAnswers((p) => ({ ...p, note: e.target.value }))}
              placeholder={
                imoveis
                  ? "Quartos, condomínio, algo indispensável? (opcional)"
                  : "Quer contar mais alguma coisa? (opcional)"
              }
              className="w-full px-4 py-3.5 text-sm outline-none placeholder:opacity-40 resize-none"
              style={inputStyle}
            />

            {state.error && (
              <p className="text-sm" style={{ color: "#f87171" }}>
                {state.error}
              </p>
            )}

            <div className={canSubmit ? "" : "opacity-60"}>
              <SubmitButton
                theme={theme}
                label={
                  imoveis
                    ? answers.need === "vender"
                      ? "Quero avaliar meu imóvel"
                      : "Quero ver as opções"
                    : "Quero minha proposta"
                }
              />
            </div>
            <p className="text-xs text-center" style={{ color: theme.fgSubtle }}>
              Sem compromisso. Você fala direto com a {partnerName}.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}
