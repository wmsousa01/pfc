-- =====================================================================
-- Fora da Caixa — Migração 007: painel do revendedor por função, não por view
-- Rode este arquivo no SQL Editor do Supabase (uma vez), depois da 006.
--
-- POR QUE MUDAR ALGO QUE FUNCIONA:
-- O advisor do Supabase marca `security_definer_view` como Critical, e as duas
-- views da 005 caem nessa regra. O alerta é genérico — ele acusa qualquer view
-- SECURITY DEFINER porque a maioria não filtra nada e vira bypass de RLS. As
-- nossas filtram (`where reseller_id = current_reseller_id()`) e não expõem
-- cost_cents, whatsapp nem endereço, então não havia vulnerabilidade.
--
-- O que muda é a FORMA, não a garantia: expor um subconjunto filtrado por
-- FUNÇÃO security definer é o padrão recomendado da Supabase — é o que
-- is_admin() e current_reseller_id() já são — e sai do radar daquele lint.
--
-- O QUE NÃO MUDA, e é bom ter claro: a proteção continua sendo o texto da
-- função. Não há RLS por baixo como segunda linha de defesa. Se alguém um dia
-- acrescentar o.cost_cents na lista de colunas, vaza — nenhuma policy barra.
-- A alternativa com defesa em profundidade (security_invoker + privilégio por
-- coluna) exigiria que o painel ADMIN parasse de ler `orders` pela sessão do
-- usuário: admin e revendedor são o mesmo role `authenticated`, e privilégio
-- por coluna não distingue os dois. Ficou para outro dia.
-- =====================================================================

drop view if exists public.reseller_order_items;
drop view if exists public.reseller_orders;

-- ---------------------------------------------------------------------
-- Pedidos do revendedor logado
-- Sem cost_cents (margem do PFC) e sem customer_whatsapp/delivery_address:
-- o revendedor não precisa deles para acompanhar a comissão, e dado pessoal
-- que não circula não vaza.
-- ---------------------------------------------------------------------
create or replace function public.reseller_orders()
returns table (
  id                 uuid,
  code               text,
  reseller_id        uuid,
  customer_name      text,
  customer_note      text,
  delivery_method    text,
  status             text,
  payment_status     text,
  total_cents        integer,
  discount_cents     integer,
  commission_cents   integer,
  commission_paid    boolean,
  commission_paid_at timestamptz,
  delivered_at       timestamptz,
  created_at         timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    o.id, o.code, o.reseller_id, o.customer_name, o.customer_note,
    o.delivery_method, o.status, o.payment_status, o.total_cents,
    o.discount_cents, o.commission_cents, o.commission_paid,
    o.commission_paid_at, o.delivered_at, o.created_at
  from public.orders o
  where o.reseller_id = public.current_reseller_id()
  order by o.created_at desc;
$$;

-- ---------------------------------------------------------------------
-- Itens desses pedidos. Sem unit_cost_cents, pelo mesmo motivo.
-- ---------------------------------------------------------------------
create or replace function public.reseller_order_items()
returns table (
  id               uuid,
  order_id         uuid,
  product_id       uuid,
  product_name     text,
  variant          text,
  qty              integer,
  unit_price_cents integer
)
language sql stable security definer set search_path = public
as $$
  select
    i.id, i.order_id, i.product_id, i.product_name,
    i.variant, i.qty, i.unit_price_cents
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.reseller_id = public.current_reseller_id();
$$;

-- ---------------------------------------------------------------------
-- Só o revendedor logado.
-- O `revoke ... from public` é o que importa: o Postgres concede EXECUTE ao
-- role PUBLIC por padrão, então sem isso as funções ficariam chamáveis por
-- anon via /rest/v1/rpc/. Para anon current_reseller_id() é null e não viria
-- linha nenhuma, mas revogar é mais barato que confiar nisso.
-- ---------------------------------------------------------------------
revoke all on function public.reseller_orders()      from public, anon;
revoke all on function public.reseller_order_items() from public, anon;
grant execute on function public.reseller_orders()      to authenticated;
grant execute on function public.reseller_order_items() to authenticated;
