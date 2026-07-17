"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitLead, type LeadFormState } from "@/app/parcerias/actions";
import { whatsapp } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";

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

const initialState: LeadFormState = { ok: false, error: null };

const inputCls =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full py-4 rounded-xl text-base font-bold disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Quero receber o media kit"}
    </button>
  );
}

/**
 * Seção de captação de leads da página /parcerias.
 * Grava o lead no Supabase e, no sucesso, direciona para o WhatsApp
 * com mensagem pré-preenchida.
 */
export default function LeadCapture() {
  const [state, formAction] = useFormState(submitLead, initialState);

  return (
    <section id="media-kit" className="section-py bg-[#0a0a0a]">
      <div className="container-px max-w-5xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          {/* Copy */}
          <div>
            <span className="section-tag">Media kit + proposta</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black mt-3 leading-tight">
              Receba os números e uma{" "}
              <span className="text-gradient-gold">proposta para o seu segmento</span>
            </h2>
            <p className="text-white/55 mt-4 leading-relaxed">
              Deixe seu contato e enviamos o media kit completo do Fora da
              Caixa no seu WhatsApp — audiência, formatos e o plano que faz
              sentido para o seu tipo de negócio. Sem compromisso.
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm text-white/60">
              {[
                "Números atualizados do canal e dos quadros",
                "Sugestão de quadro ideal para o seu segmento",
                "Como funciona a página exclusiva + QR com tracking",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-gold-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Form / sucesso */}
          <div className="bg-[#111] border border-[#222] rounded-2xl p-6 lg:p-8">
            {state.ok ? (
              <div className="flex flex-col items-center text-center gap-4 py-6">
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl">
                  ✓
                </div>
                <h3 className="text-xl font-bold text-white">
                  Recebemos seu pedido!
                </h3>
                <p className="text-white/55 text-sm leading-relaxed max-w-sm">
                  Vamos te chamar no WhatsApp com o media kit e uma proposta.
                  Se preferir, adiante a conversa agora:
                </p>
                <a
                  href={whatsapp(
                    "Acabei de pedir o media kit pelo site e quero adiantar a conversa"
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary px-6 py-3.5 rounded-xl font-bold inline-flex items-center gap-2.5"
                >
                  <WhatsAppIcon className="w-5 h-5" />
                  Chamar no WhatsApp
                </a>
              </div>
            ) : (
              <form action={formAction} className="flex flex-col gap-4">
                {/* Honeypot anti-spam — invisível para humanos */}
                <input
                  type="text"
                  name="site_url"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="hidden"
                />

                <div className="grid sm:grid-cols-2 gap-4">
                  <input
                    name="name"
                    required
                    placeholder="Seu nome *"
                    className={inputCls}
                  />
                  <input
                    name="company"
                    required
                    placeholder="Empresa *"
                    className={inputCls}
                  />
                </div>

                <select name="segment" defaultValue="" className={inputCls}>
                  <option value="" disabled>
                    Segmento do negócio
                  </option>
                  {SEGMENTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <input
                  name="whatsapp"
                  required
                  type="tel"
                  inputMode="tel"
                  placeholder="WhatsApp com DDD *"
                  className={inputCls}
                />

                <textarea
                  name="message"
                  rows={3}
                  placeholder="Conte rapidamente o que busca (opcional)"
                  className={inputCls}
                />

                {state.error && (
                  <p className="text-red-400 text-sm">{state.error}</p>
                )}

                <SubmitButton />
                <p className="text-white/30 text-xs text-center">
                  Usamos seu contato só para enviar o media kit e a proposta.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
