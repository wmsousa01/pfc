-- =====================================================================
-- Fora da Caixa — Schema Supabase
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
-- =====================================================================

-- Extensão para gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- PARCEIROS
-- ---------------------------------------------------------------------
create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  plan        text,
  tagline     text,
  description text,
  logo_url    text,
  cover_url   text,
  website     text,
  cta_url     text,
  cta_label   text,
  accent      text default '#FFD700',
  sections    jsonb default '[]'::jsonb,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists partners_active_idx on public.partners (active);

-- ---------------------------------------------------------------------
-- CLIQUES / ACESSOS (tracking do QR code)
-- ---------------------------------------------------------------------
create table if not exists public.partner_clicks (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references public.partners (id) on delete cascade,
  source      text default 'direct',   -- 'qr' | 'direct' | 'site' | ...
  referer     text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists partner_clicks_partner_idx
  on public.partner_clicks (partner_id, created_at desc);

-- ---------------------------------------------------------------------
-- DESTAQUES DO INSTAGRAM (curados manualmente no admin)
-- ---------------------------------------------------------------------
create table if not exists public.ig_highlights (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  image_url   text not null,
  link_url    text not null,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- =====================================================================
-- ROW LEVEL SECURITY
-- Leitura pública apenas de registros ativos. Escrita só via service-role
-- (que ignora RLS) ou usuário autenticado (admin).
-- =====================================================================
alter table public.partners       enable row level security;
alter table public.partner_clicks enable row level security;
alter table public.ig_highlights  enable row level security;

-- Parceiros: qualquer um pode LER os ativos
drop policy if exists "partners public read active" on public.partners;
create policy "partners public read active"
  on public.partners for select
  using (active = true);

-- Parceiros: usuários autenticados (admin) têm acesso total
drop policy if exists "partners admin all" on public.partners;
create policy "partners admin all"
  on public.partners for all
  to authenticated
  using (true) with check (true);

-- Destaques IG: leitura pública dos ativos
drop policy if exists "ig public read active" on public.ig_highlights;
create policy "ig public read active"
  on public.ig_highlights for select
  using (active = true);

drop policy if exists "ig admin all" on public.ig_highlights;
create policy "ig admin all"
  on public.ig_highlights for all
  to authenticated
  using (true) with check (true);

-- Cliques: apenas admin autenticado pode LER (o service-role insere,
-- ignorando RLS). Ninguém anônimo lê nem escreve diretamente.
drop policy if exists "clicks admin read" on public.partner_clicks;
create policy "clicks admin read"
  on public.partner_clicks for select
  to authenticated
  using (true);

-- =====================================================================
-- DADOS DE EXEMPLO (opcional — remova se não quiser)
-- =====================================================================
insert into public.partners (slug, name, plan, tagline, description, website, cta_url, cta_label, accent, sections)
values (
  'parceiro-exemplo',
  'Parceiro Exemplo',
  'Patrocinador',
  'Sua marca no centro da conversa da cidade.',
  'Este é um parceiro de exemplo criado pelo schema. Edite ou remova no painel admin.',
  'https://exemplo.com.br',
  'https://wa.me/5519989331908',
  'Falar no WhatsApp',
  '#FFD700',
  '[{"heading":"Sobre a parceria","body":"Descreva aqui a história e a oferta do parceiro."}]'::jsonb
)
on conflict (slug) do nothing;
