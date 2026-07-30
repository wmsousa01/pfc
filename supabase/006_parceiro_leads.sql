-- =====================================================================
-- Fora da Caixa — Migração 006: página rica do parceiro + leads qualificados
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
--
-- 1. `partners` ganha contato direto (whatsapp/instagram/cidade) e um bloco
--    `content` (jsonb) com o conteúdo rico da landing.
-- 2. `partner_leads`: lead qualificado pela triagem da página do parceiro.
-- 3. `partner_panels`: token do painel read-only que o parceiro acessa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Conteúdo e contato do parceiro
-- ---------------------------------------------------------------------
alter table public.partners
  add column if not exists whatsapp  text,   -- só dígitos, com DDI: 5519999999999
  add column if not exists instagram text,   -- handle sem @
  add column if not exists city      text,
  add column if not exists content   jsonb not null default '{}'::jsonb;

comment on column public.partners.content is
  'Conteúdo rico da landing (ver PartnerContent em src/lib/types.ts): '
  'hero, stats, perks, products, steps, faq, gallery e config da triagem.';

-- ---------------------------------------------------------------------
-- 2. Leads qualificados por parceiro
-- ---------------------------------------------------------------------
create table if not exists public.partner_leads (
  id             uuid primary key default gen_random_uuid(),
  partner_id     uuid not null references public.partners (id) on delete cascade,

  -- identificação
  name           text not null,
  whatsapp       text not null,            -- só dígitos
  city           text,

  -- qualificação (as respostas da triagem)
  business_type  text,                     -- 'bar' | 'restaurante' | 'mercado' | ...
  need           text,                     -- 'freezer' | 'geladeira' | 'cervejeira' | 'nao_sei'
  mode           text,                     -- 'locacao' | 'compra' | 'indiferente'
  quantity       int,
  timeframe      text,                     -- 'imediato' | 'semana' | 'mes' | 'pesquisando'
  note           text,

  -- resultado da triagem
  score          int  not null default 0,  -- 0 a 100
  temperature    text not null default 'frio',  -- 'quente' | 'morno' | 'frio'

  -- proveniência
  channel        text not null default 'site',  -- 'site' | 'whatsapp' | 'bot'
  source         text,                          -- 'qr' | 'direct' | 'ig' | ...
  answers        jsonb not null default '{}'::jsonb,  -- payload cru (triagens futuras)

  -- acompanhamento
  status         text not null default 'novo',  -- 'novo'|'contatado'|'negociando'|'fechado'|'perdido'
  handed_off_at  timestamptz,              -- quando o lead foi levado ao WhatsApp do parceiro
  created_at     timestamptz not null default now()
);

create index if not exists partner_leads_partner_idx
  on public.partner_leads (partner_id, created_at desc);
create index if not exists partner_leads_status_idx
  on public.partner_leads (status);

-- ---------------------------------------------------------------------
-- 3. Painel read-only do parceiro (link secreto)
-- Fica FORA de `partners` de propósito: `partners` tem leitura pública dos
-- ativos, então um token guardado lá vazaria para qualquer visitante.
-- ---------------------------------------------------------------------
create table if not exists public.partner_panels (
  partner_id  uuid primary key references public.partners (id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Ninguém anônimo lê nem escreve. O site insere/lê via service-role
-- (que ignora RLS) e só depois de validar o token do painel.
--
-- ATENÇÃO ao `is_admin()`: desde a 004, "authenticated" NÃO é sinônimo de
-- admin — revendedores também logam. Com `using (true)` aqui, qualquer
-- revendedor leria os leads dos parceiros e, pior, os tokens de
-- partner_panels, que são justamente o segredo que dá acesso ao painel.
-- =====================================================================
alter table public.partner_leads  enable row level security;
alter table public.partner_panels enable row level security;

drop policy if exists "partner_leads admin all" on public.partner_leads;
create policy "partner_leads admin all"
  on public.partner_leads for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "partner_panels admin all" on public.partner_panels;
create policy "partner_panels admin all"
  on public.partner_panels for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Gera o token de painel para os parceiros que ainda não têm.
insert into public.partner_panels (partner_id)
select id from public.partners
on conflict (partner_id) do nothing;
