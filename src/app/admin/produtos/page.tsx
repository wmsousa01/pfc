import AdminHeader from "@/components/admin/AdminHeader";
import { requireAdmin } from "@/lib/auth";
import { getAllProducts } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { brl, centsToInput } from "@/lib/money";
import type { Product } from "@/lib/types";
import { saveProduct, toggleProductActive, deleteProduct } from "./actions";

export const dynamic = "force-dynamic";

/** Campos comuns entre "novo produto" e "editar produto". */
function ProductFields({ product }: { product?: Product }) {
  return (
    <>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Nome *</label>
          <input
            name="name"
            required
            defaultValue={product?.name}
            placeholder="Camiseta PFC"
            className="admin-input mt-1.5"
          />
        </div>
        <div>
          <label className="admin-label">SKU</label>
          <input
            name="sku"
            defaultValue={product?.sku}
            placeholder="camiseta-pfc"
            className="admin-input mt-1.5"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="admin-label">Preço de venda (R$)</label>
          <input
            name="price"
            defaultValue={product ? centsToInput(product.price_cents) : ""}
            placeholder="79,90"
            className="admin-input mt-1.5"
          />
        </div>
        <div>
          <label className="admin-label">Custo (R$)</label>
          <input
            name="cost"
            defaultValue={product ? centsToInput(product.cost_cents) : ""}
            placeholder="39,90"
            className="admin-input mt-1.5"
          />
        </div>
        <div>
          <label className="admin-label">Ordem</label>
          <input
            name="sort_order"
            type="number"
            defaultValue={product?.sort_order ?? 0}
            className="admin-input mt-1.5"
          />
        </div>
      </div>

      <div>
        <label className="admin-label">Descrição</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={product?.description ?? ""}
          className="admin-input mt-1.5"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Detalhe curto</label>
          <input
            name="detail"
            defaultValue={product?.detail ?? ""}
            placeholder="325ml · cerâmica"
            className="admin-input mt-1.5"
          />
        </div>
        <div>
          <label className="admin-label">Tamanhos (separados por vírgula)</label>
          <input
            name="variants"
            defaultValue={(product?.variants ?? []).join(", ")}
            placeholder="P, M, G, GG"
            className="admin-input mt-1.5"
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="admin-label">Imagem (URL ou /produtos/...)</label>
          <input
            name="image_url"
            defaultValue={product?.image_url ?? ""}
            className="admin-input mt-1.5"
          />
        </div>
        <div>
          <label className="admin-label">Imagem alternativa (hover)</label>
          <input
            name="image_alt_url"
            defaultValue={product?.image_alt_url ?? ""}
            className="admin-input mt-1.5"
          />
        </div>
      </div>

      <label className="flex items-center gap-2.5 text-white/70 text-sm cursor-pointer">
        <input
          type="checkbox"
          name="active"
          defaultChecked={product?.active ?? true}
          className="w-4 h-4 accent-gold-500"
        />
        Visível na loja
      </label>
    </>
  );
}

export default async function AdminProductsPage() {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <AdminHeader />
        <div className="max-w-3xl mx-auto px-6 py-20 text-center text-white/50">
          Supabase não configurado.
        </div>
      </div>
    );
  }

  const products = await getAllProducts();

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <AdminHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <h1 className="text-2xl font-bold text-white mb-2">Produtos</h1>
        <p className="text-white/40 text-sm mb-8">
          O preço fecha a conta do cliente e o custo define o lucro que aparece
          nos pedidos. Cada venda guarda uma cópia desses valores — alterar aqui
          não mexe em pedidos já feitos.
        </p>

        <div className="flex flex-col gap-4">
          {products.map((p) => (
            <details
              key={p.id}
              className="bg-[#111] border border-[#222] rounded-xl overflow-hidden"
            >
              <summary className="px-5 py-4 cursor-pointer flex items-center justify-between gap-4 hover:bg-white/[0.02]">
                <div className="min-w-0">
                  <div className="text-white font-medium">{p.name}</div>
                  <div className="text-white/40 text-xs">
                    {brl(p.price_cents)} · custo {brl(p.cost_cents)} · margem{" "}
                    <span className="text-emerald-400">
                      {brl(p.price_cents - p.cost_cents)}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${
                    p.active
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-white/5 border-white/10 text-white/40"
                  }`}
                >
                  {p.active ? "Na loja" : "Oculto"}
                </span>
              </summary>

              <div className="px-5 pb-5 border-t border-[#1e1e1e] pt-5 flex flex-col gap-4">
                <form action={saveProduct} className="flex flex-col gap-4">
                  <input type="hidden" name="id" value={p.id} />
                  <ProductFields product={p} />
                  <button className="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold self-start">
                    Salvar
                  </button>
                </form>

                <div className="flex gap-3 pt-3 border-t border-[#1e1e1e]">
                  <form action={toggleProductActive}>
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={(!p.active).toString()}
                    />
                    <button className="text-white/50 hover:text-white text-xs border border-[#2a2a2a] rounded-lg px-3 py-1.5">
                      {p.active ? "Ocultar da loja" : "Mostrar na loja"}
                    </button>
                  </form>
                  <form action={deleteProduct}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="text-red-400/70 hover:text-red-400 text-xs border border-red-500/20 rounded-lg px-3 py-1.5">
                      Excluir
                    </button>
                  </form>
                </div>
              </div>
            </details>
          ))}
        </div>

        <h2 className="text-xl font-bold text-white mt-12 mb-4">Novo produto</h2>
        <form
          action={saveProduct}
          className="bg-[#111] border border-[#222] rounded-xl p-5 flex flex-col gap-4"
        >
          <ProductFields />
          <button className="btn-primary px-5 py-2.5 rounded-lg text-sm font-bold self-start">
            Adicionar produto
          </button>
        </form>
      </div>
    </div>
  );
}
