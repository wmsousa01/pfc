-- =====================================================================
-- Fora da Caixa — Migração 003: captação de leads (formulário /parcerias)
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
-- =====================================================================

create table if not exists public.leads (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  company     text not null,
  segment     text,
  whatsapp    text not null,
  message     text,
  source      text default 'parcerias',       -- de onde veio o lead
  status      text not null default 'novo',   -- 'novo' | 'contatado' | 'fechado' | 'descartado'
  created_at  timestamptz not null default now()
);

create index if not exists leads_created_idx on public.leads (created_at desc);

-- RLS: o formulário público insere via service-role (ignora RLS).
-- Só admin autenticado lê/atualiza/remove. Nenhum acesso anônimo direto.
alter table public.leads enable row level security;

drop policy if exists "leads admin all" on public.leads;
create policy "leads admin all"
  on public.leads for all
  to authenticated
  using (true) with check (true);
