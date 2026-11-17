"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { iniciarCheckout, type CheckoutState } from "@/app/anuncie/actions";
import { buscarInstagram } from "@/app/monte-seu-plano/instagram";
import type { MarcaIg } from "@/lib/marca-instagram";

type Semana = { segunda: string; rotulo: string; livres: number };

const input =
  "w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3.5 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-gold-500/60";
const label = "block text-white/60 text-xs font-semibold mb-1.5";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full py-4 rounded-xl font-bold disabled:opacity-60">
      {pending ? "Reservando sua vaga…" : "Reservar vaga e pagar R$ 97"}
    </button>
  );
}

export default function FormOferta({ semanas, regras, limites }: { semanas: Semana[]; regras: readonly string[]; limites: { titulo: number; descricao: number } }) {
  const [state, action] = useFormState<CheckoutState, FormData>(iniciarCheckout, { error: null, url: null });
  const primeiraLivre = semanas.find((s) => s.livres > 0)?.segunda ?? "";
  const [semana, setSemana] = useState(primeiraLivre);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [ig, setIg] = useState("");
  const [marca, setMarca] = useState<MarcaIg | null>(null);
  const [lendo, setLendo] = useState(false);

  useEffect(() => {
    if (state.url) window.location.href = state.url;
  }, [state.url]);

  async function lerIg() {
    if (!ig.trim()) return setMarca(null);
    setLendo(true);
    const r = await buscarInstagram(ig).catch(() => null);
    setMarca(r?.ok ? r.marca : null);
    setLendo(false);
  }

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="text" name="site_url" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <fieldset>
        <legend className="text-white font-bold mb-3">1. Escolha a semana</legend>
        <div className="grid grid-cols-2 gap-2">
          {semanas.map((s) => {
            const lotada = s.livres === 0;
            const on = semana === s.segunda;
            return (
              <label
                key={s.segunda}
                className={`rounded-xl border px-3 py-3 text-sm cursor-pointer transition-colors ${
                  lotada
                    ? "border-white/5 text-white/25 cursor-not-allowed"
                    : on
                      ? "border-gold-500 bg-gold-500/10 text-white"
                      : "border-[#2a2a2a] text-white/70 hover:border-gold-500/40"
                }`}
              >
                <input
                  type="radio"
                  name="semana"
                  value={s.segunda}
                  checked={on}
                  disabled={lotada}
                  onChange={() => setSemana(s.segunda)}
                  className="sr-only"
                />
                <span className="block font-bold">{s.rotulo}</span>
                <span className={`block text-xs mt-0.5 ${lotada ? "" : s.livres <= 3 ? "text-amber-400" : "text-white/40"}`}>
                  {lotada ? "Esgotada" : `${s.livres} ${s.livres === 1 ? "vaga" : "vagas"}`}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="text-white font-bold mb-3">2. Sua oferta</legend>
        <div>
          <label className={label} htmlFor="titulo">
            Título da oferta <span className="text-white/30">({titulo.length}/{limites.titulo})</span>
          </label>
          <input id="titulo" name="titulo" required maxLength={limites.titulo} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Rodízio de pizza por R$ 49,90 às terças" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="descricao">
            Detalhes <span className="text-white/30">({descricao.length}/{limites.descricao})</span>
          </label>
          <textarea id="descricao" name="descricao" required maxLength={limites.descricao} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Validade, endereço, condições. Uma ou duas frases." className={input} />
        </div>
        <div>
          <label className={label} htmlFor="instagram">
            Instagram da empresa <span className="text-white/30">(opcional: usamos a sua logo e a sua cor na arte)</span>
          </label>
          <input id="instagram" name="instagram" value={ig} onChange={(e) => setIg(e.target.value)} onBlur={lerIg} placeholder="@suaempresa" className={input} />
          {lendo && <p className="text-white/40 text-xs mt-1.5">Buscando a sua marca…</p>}
          {marca && !lendo && (
            <div className="flex items-center gap-3 mt-2 text-sm text-white/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {marca.logo && <img src={marca.logo} alt="" className="w-9 h-9 rounded-full bg-white object-contain" />}
              <span>
                {marca.nome ?? `@${marca.username}`}
                {marca.cor && <span className="inline-block w-3 h-3 rounded-full ml-2 align-middle" style={{ background: marca.cor }} />}
              </span>
            </div>
          )}
        </div>
      </fieldset>

      <fieldset className="grid sm:grid-cols-2 gap-4">
        <legend className="text-white font-bold mb-3 sm:col-span-2">3. Seus dados (vão na nota fiscal)</legend>
        <div>
          <label className={label} htmlFor="empresa">Empresa</label>
          <input id="empresa" name="empresa" required maxLength={80} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="responsavel">Seu nome</label>
          <input id="responsavel" name="responsavel" required maxLength={80} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="documento">CPF ou CNPJ</label>
          <input id="documento" name="documento" required inputMode="numeric" maxLength={20} className={input} />
        </div>
        <div>
          <label className={label} htmlFor="cidade">Cidade</label>
          <select id="cidade" name="cidade" required defaultValue="Mogi Guaçu" className={input}>
            <option>Mogi Guaçu</option>
            <option>Mogi Mirim</option>
            <option>Estiva Gerbi</option>
            <option>Itapira</option>
            <option>Outra da região</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="whatsapp">WhatsApp que recebe os clientes</label>
          <input id="whatsapp" name="whatsapp" required inputMode="tel" maxLength={30} placeholder="(19) 99999-9999" className={input} />
        </div>
        <div>
          <label className={label} htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required maxLength={120} className={input} />
        </div>
      </fieldset>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
        <ul className="flex flex-col gap-1.5 text-white/55 text-xs leading-relaxed list-disc pl-4">
          {regras.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <label className="flex items-start gap-2.5 mt-3 text-sm text-white/80 cursor-pointer">
          <input type="checkbox" name="termos" required className="mt-1 accent-[#FFD700]" />
          Li e aceito as regras da oferta.
        </label>
      </div>

      {state.error && <p className="text-red-400 text-sm">{state.error}</p>}
      {semanas.every((s) => s.livres === 0) ? (
        <p className="text-amber-400 text-sm">Todas as semanas à venda estão esgotadas. Volte na próxima segunda.</p>
      ) : (
        <Enviar />
      )}
      <p className="text-white/35 text-xs text-center -mt-3">
        Pagamento à vista no Pix ou no cartão, pelo Mercado Pago. A vaga fica reservada por 1 hora enquanto você paga.
      </p>
    </form>
  );
}
