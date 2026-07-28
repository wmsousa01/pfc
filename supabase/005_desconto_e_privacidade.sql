-- =====================================================================
-- Fora da Caixa — Migração 005: desconto do cupom + privacidade do custo
-- Rode este arquivo no SQL Editor do Supabase (uma vez), depois da 004.
--
-- DUAS COISAS AQUI:
--
-- 1) DESCONTO NO CUPOM. Até agora o cupom do revendedor só ATRIBUÍA a venda
--    — o cliente não ganhava nada. Isso deixa o influencer sem argumento
--    ("compra aí que eu ganho"). Agora cada revendedor pode ter um desconto
--    próprio, e a comissão passa a incidir sobre o valor efetivamente pago.
--
-- 2) O REVENDEDOR ENXERGAVA O CUSTO DE PRODUÇÃO. A policy antiga
--    ("orders reseller read own") liberava a LINHA INTEIRA da tabela orders,
--    e a linha inclui cost_cents. O painel nunca mostrou isso, mas qualquer
--    revendedor logado que chamasse a API do Supabase direto lia a margem do
--    PFC. Aqui a leitura passa a ser por VIEW, sem as colunas de custo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DESCONTO
-- ---------------------------------------------------------------------
alter table public.resellers
  add column if not exists discount_percent int not null default 0;

comment on column public.resellers.discount_percent is
  'Desconto que o cupom deste revendedor dá ao cliente (0 a 30%).';

alter table public.resellers drop constraint if exists resellers_discount_chk;
alter table public.resellers
  add constraint resellers_discount_chk
  check (discount_percent >= 0 and discount_percent <= 30);

alter table public.orders
  add column if not exists discount_cents int not null default 0;

comment on column public.orders.discount_cents is
  'Desconto do cupom aplicado neste pedido, congelado no momento da venda. '
  'total_cents JÁ é o valor líquido (subtotal - discount_cents).';

alter table public.orders drop constraint if exists orders_discount_chk;
alter table public.orders
  add constraint orders_discount_chk check (discount_cents >= 0);

-- ---------------------------------------------------------------------
-- 2) PRIVACIDADE DO CUSTO
--
-- As views abaixo NÃO usam security_invoker: rodam como a dona (postgres),
-- ignoram a RLS de orders e fazem o próprio filtro por current_reseller_id().
-- É de propósito — é justamente o que permite tirar a policy de leitura
-- direta da tabela sem deixar o revendedor sem painel.
--
-- Além do custo, ficam de fora o WhatsApp e o endereço do cliente: o
-- revendedor não precisa deles para acompanhar a comissão, e dado pessoal
-- que não circula não vaza.
-- ---------------------------------------------------------------------
drop policy if exists "orders reseller read own" on public.orders;
drop policy if exists "order_items reseller read own" on public.order_items;

drop view if exists public.reseller_order_items;
drop view if exists public.reseller_orders;

create view public.reseller_orders as
select
  o.id,
  o.code,
  o.reseller_id,
  o.customer_name,
  o.customer_note,
  o.delivery_method,
  o.status,
  o.payment_status,
  o.total_cents,
  o.discount_cents,
  o.commission_cents,
  o.commission_paid,
  o.commission_paid_at,
  o.delivered_at,
  o.created_at
from public.orders o
where o.reseller_id = public.current_reseller_id();

create view public.reseller_order_items as
select
  i.id,
  i.order_id,
  i.product_id,
  i.product_name,
  i.variant,
  i.qty,
  i.unit_price_cents
from public.order_items i
join public.orders o on o.id = i.order_id
where o.reseller_id = public.current_reseller_id();

-- Só o revendedor logado. Para anon, current_reseller_id() é null e a view
-- não devolve linha nenhuma — mas revogar explicitamente é mais barato que
-- confiar nisso.
revoke all on public.reseller_orders      from anon, authenticated;
revoke all on public.reseller_order_items from anon, authenticated;
grant select on public.reseller_orders      to authenticated;
grant select on public.reseller_order_items to authenticated;
