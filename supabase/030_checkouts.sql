-- =====================================================================
-- Fora da Caixa — Migração 030: jornada do cliente (checkout → onboarding)
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
-- =====================================================================
--
-- Um checkout nasce quando o cliente escolhe plano e prazo em
-- /contratar/<plano>. Guarda o aceite dos termos (texto exato, por hash) e o
-- contrato que vira `partner_panels.contract` quando o Mercado Pago aprova o
-- pagamento. Só service-role lê e escreve: tem documento, e-mail e WhatsApp.

create table if not exists public.checkouts (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid references public.leads (id) on delete set null,
  reseller_id       uuid references public.resellers (id) on delete set null,
  origem            text not null default 'site',     -- 'site' | 'admin' (link mandado ao lead)

  plan              text not null,                     -- apoio | patrocinador | master
  periodo           text not null,                     -- trimestral | semestral | anual
  metodo            text not null,                     -- pix | cartao
  meses             int  not null check (meses >= 3),
  valor             numeric(10, 2) not null check (valor > 0),

  company           text not null,
  name              text not null,
  document          text not null,                     -- CPF ou CNPJ, só dígitos
  email             text not null,
  whatsapp          text not null,
  segment           text,
  instagram         text,

  -- Aceite (gravado na revisão, antes de ir ao pagamento). O contrato é o
  -- texto exato que gerou o hash; quando o pagamento é aprovado ele é copiado
  -- sem mudança para partner_panels.contract.
  contract          jsonb,
  terms_version     text,
  terms_hash        text,
  accepted_at       timestamptz,
  ip                text,
  user_agent        text,

  -- aberto → aguardando (foi ao MP) → pago | recusado; processando/erro são
  -- estados internos da finalização; divergente = valor pago não bate.
  status            text not null default 'aberto',
  mp_preference_id  text,
  mp_payment_id     text,
  mp_status         text,
  paid_at           timestamptz,
  erro              text,

  partner_id        uuid references public.partners (id) on delete set null,
  onboarding_token  uuid not null default gen_random_uuid() unique,
  onboarding_done_at timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists checkouts_created_idx on public.checkouts (created_at desc);
create index if not exists checkouts_lead_idx on public.checkouts (lead_id);

create or replace function public.checkouts_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists checkouts_touch on public.checkouts;
create trigger checkouts_touch before update on public.checkouts
  for each row execute function public.checkouts_touch();

-- RLS ligada e sem policy: acesso zero por anon/authenticated. O site usa
-- service-role; o admin lê pelo servidor depois do requireAdmin.
alter table public.checkouts enable row level security;
