"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitOrder, type OrderFormState } from "@/app/loja/actions";
import ProductImage from "./ProductImage";
import { brl } from "@/lib/money";
import { whatsapp } from "@/lib/config";
import { WhatsAppIcon } from "@/components/icons";
import type { Product } from "@/lib/types";

const initialState: OrderFormState = { ok: false, error: null, code: null };

const inputCls =
  "w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold-500/60 transition-colors";

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="btn-primary w-full py-4 rounded-xl text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {pending ? "Enviando..." : "Fechar pedido"}
    </button>
  );
}

function Stepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const btn =
    "w-9 h-9 rounded-lg border border-[#2a2a2a] text-white/70 hover:border-gold-500/60 hover:text-white transition-colors disabled:opacity-30 disabled:hover:border-[#2a2a2a]";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={value === 0}
        className={btn}
        aria-label="Diminuir"
      >
        −
      </button>
      <span className="w-8 text-center text-white font-bold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(50, value + 1))}
        className={btn}
        aria-label="Aumentar"
      >
        +
      </button>
    </div>
  );
}

/**
 * Loja: seleção de produtos + dados do cliente em um único formulário.
 * O cupom já vem preenchido quando o cliente chegou por /r/{slug}; os preços
 * exibidos são só informativos — quem fecha a conta é o servidor.
 */
export default function OrderForm({
  products,
  initialCoupon,
  resellerName,
  discountPercent,
}: {
  products: Product[];
  initialCoupon: string;
  resellerName: string | null;
  discountPercent: number;
}) {
  const [state, formAction] = useFormState(submitOrder, initialState);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [variant, setVariant] = useState<Record<string, string>>({});
  const [delivery, setDelivery] = useState("combinar");
  const [coupon, setCoupon] = useState(initialCoupon);

  // O desconto só é previsto na tela para o cupom que o servidor JÁ validou.
  // Se o cliente digitar outro, some o preview em vez de prometer um valor que
  // pode não existir — quem fecha a conta é o servidor, de qualquer forma.
  const couponMatches =
    initialCoupon !== "" &&
    coupon.trim().toUpperCase() === initialCoupon.toUpperCase();
  const couponApplies = couponMatches && discountPercent > 0;

  const { subtotal, discount, total, units } = useMemo(() => {
    let subtotal = 0;
    let units = 0;
    for (const p of products) {
      const q = qty[p.id] ?? 0;
      subtotal += q * p.price_cents;
      units += q;
    }
    const discount = couponApplies
      ? Math.round((subtotal * discountPercent) / 100)
      : 0;
    return { subtotal, discount, total: subtotal - discount, units };
  }, [products, qty, couponApplies, discountPercent]);

  if (state.ok) {
    return (
      <div className="bg-[#111] border border-[#222] rounded-2xl p-8 max-w-xl mx-auto text-center flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-2xl">
          ✓
        </div>
        <h3 className="text-xl font-bold text-white">Pedido registrado!</h3>
        {state.code && (
          <p className="text-white/70 text-sm">
            Seu código é{" "}
            <span className="text-gold-500 font-black tracking-wide">
              {state.code}
            </span>
          </p>
        )}
        <p className="text-white/55 text-sm leading-relaxed max-w-sm">
          Vamos confirmar tudo com você no WhatsApp — pagamento, prazo e
          entrega. Se preferir, adiante a conversa agora:
        </p>
        <a
          href={whatsapp(
            `Acabei de fazer o pedido ${state.code ?? ""} no site do Fora da Caixa`
          )}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-6 py-3.5 rounded-xl font-bold inline-flex items-center gap-2.5"
        >
          <WhatsAppIcon className="w-5 h-5" />
          Chamar no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {/* Honeypot anti-spam — invisível para humanos */}
      <input
        type="text"
        name="site_url"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {/* Produtos */}
      <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
        {products.map((p) => {
          const q = qty[p.id] ?? 0;
          const chosen = variant[p.id] ?? p.variants[0] ?? "";
          return (
            <div
              key={p.id}
              className={`group bg-[#0d0d0d] border rounded-2xl overflow-hidden flex flex-col transition-colors ${
                q > 0 ? "border-gold-500/60" : "border-[#2a2a2a]"
              }`}
            >
              <div className="relative aspect-[4/3] bg-[#0a0a0a]">
                <span className="absolute top-4 left-4 z-10 bg-gold-500 text-black text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-full">
                  Pré-venda
                </span>
                {p.image_url && (
                  <ProductImage
                    src={p.image_url}
                    alt={p.name}
                    className={
                      p.image_alt_url
                        ? "transition-opacity duration-500 group-hover:opacity-0"
                        : ""
                    }
                  />
                )}
                {p.image_alt_url && (
                  <ProductImage
                    src={p.image_alt_url}
                    alt={`${p.name} — frente`}
                    className="opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                )}
              </div>

              <div className="p-6 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-2xl font-black">{p.name}</h3>
                  <span className="text-gold-500 font-black text-xl whitespace-nowrap">
                    {brl(p.price_cents)}
                  </span>
                </div>
                {p.description && (
                  <p className="text-white/55 text-sm leading-relaxed">
                    {p.description}
                  </p>
                )}
                {p.detail && <p className="text-white/35 text-xs">{p.detail}</p>}

                <div className="mt-auto pt-4 flex items-center justify-between gap-3 border-t border-[#1e1e1e]">
                  {p.variants.length > 0 ? (
                    <select
                      name={`variant__${p.id}`}
                      value={chosen}
                      onChange={(e) =>
                        setVariant((v) => ({ ...v, [p.id]: e.target.value }))
                      }
                      className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gold-500/60"
                      aria-label={`Tamanho — ${p.name}`}
                    >
                      {p.variants.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-white/30 text-xs">Tamanho único</span>
                  )}

                  <input type="hidden" name={`qty__${p.id}`} value={q} />
                  <Stepper
                    value={q}
                    onChange={(v) => setQty((s) => ({ ...s, [p.id]: v }))}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dados do cliente */}
      <div className="bg-[#111] border border-[#222] rounded-2xl p-6 lg:p-8 flex flex-col gap-4 max-w-2xl mx-auto w-full">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-lg font-bold text-white">Seus dados</h3>
          <div className="text-right">
            <div className="text-white/40 text-xs">
              {units} {units === 1 ? "peça" : "peças"}
            </div>
            {discount > 0 && (
              <div className="text-white/35 text-xs line-through">
                {brl(subtotal)}
              </div>
            )}
            <div className="text-gold-500 font-black text-2xl">{brl(total)}</div>
            {discount > 0 && (
              <div className="text-emerald-400 text-xs font-semibold">
                −{brl(discount)} com o cupom
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <input
            name="customer_name"
            required
            placeholder="Seu nome *"
            className={inputCls}
          />
          <input
            name="customer_whatsapp"
            required
            type="tel"
            inputMode="tel"
            placeholder="WhatsApp com DDD *"
            className={inputCls}
          />
        </div>

        <select
          name="delivery_method"
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
          className={inputCls}
        >
          <option value="combinar">Combinar a entrega no WhatsApp</option>
          <option value="retirada">Retirar em mãos / no estúdio</option>
          <option value="entrega">Entregar no meu endereço</option>
        </select>

        {delivery === "entrega" && (
          <input
            name="delivery_address"
            placeholder="Endereço para entrega"
            className={inputCls}
          />
        )}

        <div>
          <input
            name="coupon"
            value={coupon}
            onChange={(e) => setCoupon(e.target.value)}
            placeholder="Cupom do revendedor (opcional)"
            className={`${inputCls} uppercase`}
          />
          {resellerName && couponApplies && (
            <p className="text-emerald-400 text-xs mt-2">
              Cupom de <strong>{resellerName}</strong> aplicado:{" "}
              <strong>{discountPercent}% de desconto</strong> no seu pedido.
            </p>
          )}
          {resellerName && couponMatches && !couponApplies && (
            <p className="text-emerald-400 text-xs mt-2">
              Indicação de <strong>{resellerName}</strong> aplicada — a venda
              conta para ele.
            </p>
          )}
          {resellerName && !couponMatches && (
            <p className="text-white/40 text-xs mt-2">
              {coupon.trim() === ""
                ? `Você chegou pela indicação de ${resellerName} — deixe o cupom preenchido para não perder o benefício.`
                : "Conferimos o cupom ao enviar o pedido."}
            </p>
          )}
        </div>

        <textarea
          name="customer_note"
          rows={2}
          placeholder="Alguma observação? (opcional)"
          className={inputCls}
        />

        {state.error && <p className="text-red-400 text-sm">{state.error}</p>}

        <SubmitButton disabled={units === 0} />
        <p className="text-white/30 text-xs text-center">
          Sem pagamento agora — a pré-venda dimensiona a primeira produção.
          Confirmamos valor, prazo e forma de pagamento no WhatsApp.
        </p>
      </div>
    </form>
  );
}
