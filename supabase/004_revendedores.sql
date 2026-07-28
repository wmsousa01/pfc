-- =====================================================================
-- Fora da Caixa — Migração 004: revendedores, produtos e pedidos
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
--
-- O QUE MUDA AQUI (importante):
-- Até agora, "usuário autenticado" era sinônimo de "admin". A partir do
-- momento em que revendedores também fazem login, isso deixa de ser
-- verdade. Esta migração cria o papel de ADMIN explícito (tabela
-- app_admins) e reaperta as policies antigas — senão um revendedor
-- logado conseguiria ler leads e parceiros direto do banco.
--
-- Todos os usuários que já existem hoje são promovidos a admin
-- automaticamente (veja o bloco "PAPÉIS" abaixo).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PAPÉIS
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Quem já tinha login antes desta migração era, por definição, o admin.
insert into public.app_admins (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- security definer: as funções precisam enxergar as tabelas ignorando RLS,
-- senão as próprias policies que as usam entrariam em recursão.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

create or replace function public.current_reseller_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select r.id from public.resellers r
  where r.user_id = auth.uid() and r.active
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- PRODUTOS
-- Preço e custo em CENTAVOS (inteiro) — nada de float com dinheiro.
-- ---------------------------------------------------------------------
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  sku           text unique not null,
  name          text not null,
  description   text,
  detail        text,
  price_cents   int  not null default 0,
  cost_cents    int  not null default 0,
  image_url     text,
  image_alt_url text,
  -- Lista de variações (ex.: tamanhos). Vazio = produto sem variação.
  variants      jsonb not null default '[]'::jsonb,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ATENÇÃO: preços/custos abaixo são PLACEHOLDERS. Ajuste em /admin/produtos.
insert into public.products (sku, name, description, detail, price_cents, cost_cents, image_url, image_alt_url, variants, sort_order)
values
  (
    'camiseta-pfc',
    'Camiseta PFC',
    'Preta, com o logo no peito e estampa completa nas costas com as 5 estrelas dos quadros.',
    'Tamanhos P ao GG · algodão premium',
    7990, 3990,
    '/produtos/camiseta-costas.png',
    '/produtos/camiseta-frente.png',
    '["P","M","G","GG"]'::jsonb,
    1
  ),
  (
    'caneca-pfc',
    'Caneca PFC',
    'Cerâmica branca com interior e alça pretos, estampada com o logo do PFC.',
    '325ml · cerâmica',
    4500, 2200,
    '/produtos/caneca.png',
    null,
    '[]'::jsonb,
    2
  )
on conflict (sku) do nothing;

-- ---------------------------------------------------------------------
-- REVENDEDORES
-- Apresentadores de quadro, influencers e parceiros que indicam vendas.
-- Ganham por link (/r/{slug}) ou cupom (o próprio slug em maiúsculas).
-- ---------------------------------------------------------------------
create table if not exists public.resellers (
  id               uuid primary key default gen_random_uuid(),
  -- Conta de login do revendedor (criada pelo admin). Null = sem acesso ainda.
  user_id          uuid unique references auth.users (id) on delete set null,
  slug             text unique not null,       -- vira o link e o cupom
  name             text not null,
  email            text,
  whatsapp         text,
  role_label       text,                       -- "Influencer", "Quadro PFC News"...
  notes            text,
  -- 'percent' = % sobre o valor do pedido | 'fixed' = R$ fixo por peça vendida
  commission_type  text not null default 'percent',
  commission_value int  not null default 10,   -- % (percent) ou centavos (fixed)
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  constraint resellers_commission_type_chk
    check (commission_type in ('percent', 'fixed')),
  constraint resellers_commission_value_chk
    check (commission_value >= 0)
);

create index if not exists resellers_user_idx on public.resellers (user_id);

-- ---------------------------------------------------------------------
-- PEDIDOS
-- Os valores são congelados no momento do pedido (snapshot): mudar o preço
-- de um produto depois não pode reescrever o histórico nem a comissão.
-- ---------------------------------------------------------------------
create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null,
  reseller_id        uuid references public.resellers (id) on delete set null,
  customer_name      text not null,
  customer_whatsapp  text not null,
  customer_note      text,
  delivery_method    text not null default 'combinar',  -- 'retirada' | 'entrega' | 'combinar'
  delivery_address   text,
  -- Andamento da ENTREGA
  status             text not null default 'novo',
  -- Andamento do PAGAMENTO do cliente
  payment_status     text not null default 'pendente',
  total_cents        int  not null default 0,
  cost_cents         int  not null default 0,
  commission_cents   int  not null default 0,
  commission_paid    boolean not null default false,
  commission_paid_at timestamptz,
  delivered_at       timestamptz,
  source             text default 'loja',
  created_at         timestamptz not null default now(),
  constraint orders_status_chk check (
    status in ('novo', 'confirmado', 'producao', 'pronto', 'entregue', 'cancelado')
  ),
  constraint orders_payment_chk check (
    payment_status in ('pendente', 'pago', 'estornado')
  )
);

create index if not exists orders_created_idx  on public.orders (created_at desc);
create index if not exists orders_reseller_idx on public.orders (reseller_id, created_at desc);

create table if not exists public.order_items (
  id               uuid primary key default gen_random_uuid(),
  order_id         uuid not null references public.orders (id) on delete cascade,
  product_id       uuid references public.products (id) on delete set null,
  product_name     text not null,               -- snapshot
  variant          text,                        -- tamanho escolhido
  qty              int  not null default 1,
  unit_price_cents int  not null default 0,     -- snapshot
  unit_cost_cents  int  not null default 0,     -- snapshot
  constraint order_items_qty_chk check (qty > 0)
);

create index if not exists order_items_order_idx on public.order_items (order_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.app_admins  enable row level security;
alter table public.products    enable row level security;
alter table public.resellers   enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- app_admins: ninguém lê pelo cliente. is_admin() é security definer e
-- não depende de policy. (Sem policy = sem acesso via anon/authenticated.)

-- Produtos: vitrine pública lê os ativos; só admin escreve.
drop policy if exists "products public read active" on public.products;
create policy "products public read active"
  on public.products for select
  using (active = true);

drop policy if exists "products admin all" on public.products;
create policy "products admin all"
  on public.products for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Revendedores: admin gerencia; o revendedor enxerga apenas o próprio cadastro.
-- Não há leitura pública — comissão é informação interna.
drop policy if exists "resellers admin all" on public.resellers;
create policy "resellers admin all"
  on public.resellers for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "resellers read own" on public.resellers;
create policy "resellers read own"
  on public.resellers for select
  to authenticated
  using (user_id = auth.uid());

-- Pedidos: admin vê tudo; revendedor vê só os pedidos atribuídos a ele.
-- A loja pública insere via service-role (ignora RLS), como já é feito em leads.
drop policy if exists "orders admin all" on public.orders;
create policy "orders admin all"
  on public.orders for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "orders reseller read own" on public.orders;
create policy "orders reseller read own"
  on public.orders for select
  to authenticated
  using (reseller_id = public.current_reseller_id());

drop policy if exists "order_items admin all" on public.order_items;
create policy "order_items admin all"
  on public.order_items for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "order_items reseller read own" on public.order_items;
create policy "order_items reseller read own"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.reseller_id = public.current_reseller_id()
    )
  );

-- ---------------------------------------------------------------------
-- REAPERTO DAS POLICIES ANTIGAS
-- Antes: qualquer usuário autenticado tinha acesso total. Agora que
-- revendedores logam, isso vazaria leads e dados de parceiros.
-- ---------------------------------------------------------------------
drop policy if exists "partners admin all" on public.partners;
create policy "partners admin all"
  on public.partners for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ig admin all" on public.ig_highlights;
create policy "ig admin all"
  on public.ig_highlights for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "clicks admin read" on public.partner_clicks;
create policy "clicks admin read"
  on public.partner_clicks for select
  to authenticated
  using (public.is_admin());

drop policy if exists "leads admin all" on public.leads;
create policy "leads admin all"
  on public.leads for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "partner-assets admin write" on storage.objects;
create policy "partner-assets admin write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'partner-assets' and public.is_admin())
  with check (bucket_id = 'partner-assets' and public.is_admin());
