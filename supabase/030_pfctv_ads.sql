-- PFCTV Ads, fase 1: "Oferta da semana" self-serve.
--
-- O comerciante preenche a oferta, paga no Checkout Pro do Mercado Pago e a
-- oferta entra na fila de aprovação. Aprovada, vira um story no Instagram do
-- PFC e aparece em /ofertas, com um link curto rastreado (/o/{codigo}).
--
-- Vagas limitadas por semana: a reserva é atômica (advisory lock por semana)
-- e expira se o pagamento não acontecer. Tudo via service-role: RLS ligado e
-- sem policy = sem acesso por anon/authenticated.

create table if not exists public.ads_ofertas (
  id uuid primary key default gen_random_uuid(),
  -- Código curto do link rastreado /o/{codigo}.
  codigo text not null unique,
  -- Segunda-feira da semana em que a oferta roda (horário de Brasília).
  semana date not null,
  status text not null default 'reservada'
    check (status in ('reservada', 'paga', 'aprovada', 'publicando', 'publicada', 'erro', 'recusada', 'cancelada')),

  -- Quem compra (vai na nota fiscal).
  empresa text not null,
  responsavel text not null,
  documento text not null,
  email text not null,
  whatsapp text not null,
  instagram text,
  cidade text not null,

  -- A oferta.
  titulo text not null,
  descricao text not null,
  cor text,
  logo_path text,

  valor_cents integer not null check (valor_cents > 0),
  termos_em timestamptz not null,
  reservada_ate timestamptz not null,

  -- Mercado Pago.
  mp_preference_id text,
  mp_payment_id text unique,
  mp_status text,
  pago_em timestamptz,
  reembolso_id text,

  -- Produção e publicação.
  aprovada_em timestamptz,
  arte_path text,
  publicar_em timestamptz,
  publicada_em timestamptz,
  post_id text,
  erro text,
  motivo_recusa text,

  cliques integer not null default 0,
  nota_emitida_em timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ads_ofertas_semana_status on public.ads_ofertas (semana, status);
create index if not exists ads_ofertas_fila on public.ads_ofertas (status, publicar_em);

alter table public.ads_ofertas enable row level security;

-- Status que ocupam vaga: tudo o que foi pago e não foi recusado, mais as
-- reservas ainda dentro do prazo.
create or replace function public.ads_vagas_ocupadas(p_semana date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from ads_ofertas
  where semana = p_semana
    and (
      status in ('paga', 'aprovada', 'publicando', 'publicada', 'erro')
      or (status = 'reservada' and reservada_ate > now())
    );
$$;

-- Reserva atômica: duas pessoas comprando a última vaga ao mesmo tempo não
-- passam as duas. Devolve o id da oferta, ou null se a semana lotou.
create or replace function public.ads_reservar_oferta(p jsonb, p_vagas integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semana date := (p->>'semana')::date;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ads_oferta_' || v_semana::text));
  if ads_vagas_ocupadas(v_semana) >= p_vagas then
    return null;
  end if;
  insert into ads_ofertas (
    codigo, semana, empresa, responsavel, documento, email, whatsapp, instagram, cidade,
    titulo, descricao, cor, valor_cents, termos_em, reservada_ate
  ) values (
    p->>'codigo', v_semana, p->>'empresa', p->>'responsavel', p->>'documento', p->>'email',
    p->>'whatsapp', nullif(p->>'instagram', ''), p->>'cidade', p->>'titulo', p->>'descricao',
    nullif(p->>'cor', ''), (p->>'valor_cents')::int, now(), (p->>'reservada_ate')::timestamptz
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Clique no link rastreado: soma 1 e devolve para onde redirecionar.
-- Só conta oferta que está (ou esteve) no ar.
create or replace function public.ads_registrar_clique(p_codigo text)
returns table (whatsapp text, empresa text, titulo text)
language sql
security definer
set search_path = public
as $$
  update ads_ofertas
     set cliques = cliques + 1
   where codigo = p_codigo
     and status in ('aprovada', 'publicando', 'publicada', 'erro')
  returning whatsapp, empresa, titulo;
$$;

revoke all on function public.ads_vagas_ocupadas(date) from public, anon, authenticated;
revoke all on function public.ads_reservar_oferta(jsonb, integer) from public, anon, authenticated;
revoke all on function public.ads_registrar_clique(text) from public, anon, authenticated;
grant execute on function public.ads_vagas_ocupadas(date) to service_role;
grant execute on function public.ads_reservar_oferta(jsonb, integer) to service_role;
grant execute on function public.ads_registrar_clique(text) to service_role;
