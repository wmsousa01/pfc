-- =====================================================================
-- ÁREA DO CLIENTE (no painel do parceiro)
--
-- 1. `partner_panels` ganha o contrato do cliente e o Epic dele no Jira.
--    Fica aqui, e não em `partners.content`, porque `partners` tem leitura
--    pública dos ativos — o preço negociado vazaria para qualquer visitante.
-- 2. `partner_terms_acceptances`: o aceite dos termos. É o registro oficial;
--    o Jira recebe só uma cópia em comentário, que pode ser editado.
--    Por isso a tabela não aceita UPDATE nem DELETE, nem do admin.
-- =====================================================================

alter table public.partner_panels
  add column if not exists jira_epic text,      -- ex.: PROD-140
  add column if not exists contract  jsonb;     -- ver ClientContract em src/lib/types.ts

comment on column public.partner_panels.contract is
  'Condição contratada pelo cliente: plano, valor, pagamento, início, meses e versão dos termos.';

create table if not exists public.partner_terms_acceptances (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references public.partners (id) on delete restrict,
  terms_version    text not null,
  -- sha-256 do texto exato exibido: prova do que foi aceito, mesmo que a
  -- versão seja editada por engano depois.
  terms_hash       text not null,
  accepted_name    text not null,
  accepted_document text not null,               -- CPF ou CNPJ, só dígitos
  ip               text,
  user_agent       text,
  accepted_at      timestamptz not null default now(),
  unique (partner_id, terms_version)
);

create index if not exists partner_terms_acceptances_partner_idx
  on public.partner_terms_acceptances (partner_id, accepted_at desc);

create or replace function public.block_terms_acceptance_change()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Aceite de termos é imutável';
end;
$$;

drop trigger if exists partner_terms_acceptances_immutable
  on public.partner_terms_acceptances;

create trigger partner_terms_acceptances_immutable
  before update or delete on public.partner_terms_acceptances
  for each row
  execute function public.block_terms_acceptance_change();

-- O site grava e lê via service-role, só depois de validar o token do
-- painel. Admin logado apenas lê.
alter table public.partner_terms_acceptances enable row level security;

drop policy if exists "partner_terms_acceptances admin read"
  on public.partner_terms_acceptances;
create policy "partner_terms_acceptances admin read"
  on public.partner_terms_acceptances for select
  to authenticated
  using (public.is_admin());
