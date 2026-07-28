"use client";

import { useState } from "react";
import { saveReseller } from "@/app/admin/revendedores/actions";
import { MAX_DISCOUNT_PERCENT } from "@/lib/commission";
import { centsToInput } from "@/lib/money";
import type { Reseller } from "@/lib/types";

/**
 * Cadastro do revendedor. O campo de senha é opcional: preenchê-lo cria (ou
 * renova) o acesso dele ao painel /revendedor.
 */
export default function ResellerForm({ reseller }: { reseller?: Reseller }) {
  const [type, setType] = useState(reseller?.commission_type ?? "percent");
  const [discount, setDiscount] = useState(
    String(reseller?.discount_percent ?? 5)
  );

  const defaultValue = reseller
    ? reseller.commission_type === "fixed"
      ? centsToInput(reseller.commission_value)
      : String(reseller.commission_value)
    : "10";

  const discountNum = Math.max(0, Number(discount) || 0);

  return (
    <form action={saveReseller} className="flex flex-col gap-5">
      {reseller && <input type="hidden" name="id" value={reseller.id} />}

      <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-4">
        <p className="text-white font-semibold">Dados</p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="admin-label">Nome *</label>
            <input
              name="name"
              required
              defaultValue={reseller?.name}
              placeholder="Ex: Ana Souza"
              className="admin-input mt-1.5"
            />
          </div>
          <div>
            <label className="admin-label">Link / cupom *</label>
            <input
              name="slug"
              required
              defaultValue={reseller?.slug}
              placeholder="ana-souza"
              className="admin-input mt-1.5"
            />
            <p className="text-white/30 text-xs mt-1.5">
              Vira o link <span className="text-white/50">/r/ana-souza</span> e o
              cupom <span className="text-white/50">ANA-SOUZA</span>.
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="admin-label">Papel no ecossistema</label>
            <input
              name="role_label"
              defaultValue={reseller?.role_label ?? ""}
              placeholder="Influencer · Quadro PFC News · Convidado"
              className="admin-input mt-1.5"
            />
          </div>
          <div>
            <label className="admin-label">WhatsApp</label>
            <input
              name="whatsapp"
              defaultValue={reseller?.whatsapp ?? ""}
              placeholder="19989331908"
              className="admin-input mt-1.5"
            />
          </div>
        </div>

        <div>
          <label className="admin-label">Observações internas</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={reseller?.notes ?? ""}
            placeholder="Combinações, prazos de repasse, etc."
            className="admin-input mt-1.5"
          />
        </div>

        <label className="flex items-center gap-2.5 text-white/70 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="active"
            defaultChecked={reseller?.active ?? true}
            className="w-4 h-4 accent-gold-500"
          />
          Revendedor ativo (link e cupom funcionando)
        </label>
      </div>

      {/* Comissão e desconto */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-4">
        <div>
          <p className="text-white font-semibold">Comissão e desconto</p>
          <p className="text-white/40 text-xs mt-1">
            As duas regras são congeladas em cada pedido no momento da venda —
            mudar aqui não altera pedidos já feitos.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="admin-label">Tipo</label>
            <select
              name="commission_type"
              value={type}
              onChange={(e) => setType(e.target.value as "percent" | "fixed")}
              className="admin-input mt-1.5"
            >
              <option value="percent">% sobre o valor do pedido</option>
              <option value="fixed">R$ fixo por peça vendida</option>
            </select>
          </div>
          <div>
            <label className="admin-label">
              {type === "fixed" ? "Valor por peça (R$)" : "Percentual (%)"}
            </label>
            <input
              name="commission_value"
              defaultValue={defaultValue}
              placeholder={type === "fixed" ? "15,00" : "10"}
              className="admin-input mt-1.5"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-[#1e1e1e]">
          <label className="admin-label">
            Desconto do cupom para o cliente (%)
          </label>
          <input
            name="discount_percent"
            type="number"
            min={0}
            max={MAX_DISCOUNT_PERCENT}
            step={1}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="admin-input mt-1.5 sm:w-40"
          />
          <p className="text-white/30 text-xs mt-1.5 leading-relaxed">
            {discountNum > 0 ? (
              <>
                Quem comprar com o cupom dele paga{" "}
                <span className="text-emerald-400">{discountNum}% menos</span>. É
                o argumento que ele usa para divulgar — sem isso o post dele vira
                só &quot;compra aí que eu ganho&quot;.
              </>
            ) : (
              <>
                0 = o cupom só atribui a venda, o cliente não ganha nada.
                Máximo {MAX_DISCOUNT_PERCENT}%.
              </>
            )}
            {type === "percent" && discountNum > 0 && (
              <>
                {" "}
                A comissão dele incide sobre o valor{" "}
                <strong className="text-white/50">já com desconto</strong>.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Acesso */}
      <div className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-4">
        <div>
          <p className="text-white font-semibold">Acesso ao painel</p>
          <p className="text-white/40 text-xs mt-1">
            {reseller?.user_id
              ? "Este revendedor já tem acesso. Preencha a senha só para redefini-la."
              : "Preencha e-mail e senha para criar o login dele em /revendedor."}
          </p>
          <p className="text-amber-400/70 text-xs mt-1.5">
            Precisa ser um e-mail diferente do seu de admin. Quem é admin sempre
            cai no /admin — para testar o painel do parceiro, crie um e-mail à
            parte.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="admin-label">E-mail</label>
            <input
              name="email"
              type="email"
              defaultValue={reseller?.email ?? ""}
              placeholder="ana@email.com"
              className="admin-input mt-1.5"
            />
          </div>
          <div>
            <label className="admin-label">Senha (mín. 8 caracteres)</label>
            <input
              name="password"
              type="text"
              autoComplete="new-password"
              placeholder={reseller?.user_id ? "Deixe vazio para manter" : "Senha inicial"}
              className="admin-input mt-1.5"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="btn-primary px-6 py-3 rounded-lg font-bold">
          {reseller ? "Salvar alterações" : "Criar revendedor"}
        </button>
        <a
          href="/admin/revendedores"
          className="px-6 py-3 rounded-lg border border-[#2a2a2a] text-white/60 hover:text-white text-sm font-medium flex items-center"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
