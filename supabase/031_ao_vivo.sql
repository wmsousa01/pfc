-- =====================================================================
-- Fora da Caixa — Migração 031: inserções dos patrocinadores na live
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
-- =====================================================================
--
-- A cena de cada quadro é montada uma vez no OBS com uma fonte de navegador
-- (/ao-vivo/tela/<token_tela>). O que aparece nela vem daqui:
--
--   ao_vivo_telas      um par de links por quadro: a tela do OBS e a régie
--   ao_vivo_cotas      o combinado com o parceiro (tipo, momento, duração,
--                      frequência, vigência)
--   ao_vivo_sessoes    uma live: começa, pode segurar, encerra
--   ao_vivo_insercoes  a fila da live, montada das cotas quando ela começa;
--                      cada linha guarda quando entrou e saiu do ar, e é
--                      isso que vira a prova de veiculação do parceiro.
--
-- Só service-role lê e escreve (as rotas conferem o token ou o admin).

create table if not exists public.ao_vivo_telas (
  quadro       text primary key,
  token_tela   text not null unique,
  token_regie  text not null unique,
  created_at   timestamptz not null default now()
);

create table if not exists public.ao_vivo_cotas (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners (id) on delete cascade,
  quadro        text not null,
  -- PFC Esporte Clube: null = todos os episódios do quadro.
  modalidade    text,
  tipo          text not null check (tipo in ('logo', 'faixa', 'qr', 'vinheta')),
  -- continuo: o episódio todo (só logo); durante: espalhada pela live.
  momento       text not null default 'durante'
    check (momento in ('abertura', 'durante', 'encerramento', 'continuo')),
  duracao_s     int  not null default 15 check (duracao_s between 0 and 600),
  -- Frequência de "durante": N vezes por episódio OU a cada N minutos.
  vezes         int  check (vezes between 1 and 30),
  a_cada_min    int  check (a_cada_min between 1 and 180),
  texto         text,                 -- faixa: a frase; qr: a chamada
  midia_path    text,                 -- vinheta (vídeo) ou arte própria, no bucket producao
  midia_mime    text,
  posicao       text not null default 'inferior-direito'
    check (posicao in ('superior-esquerdo', 'superior-direito', 'inferior-esquerdo', 'inferior-direito')),
  inicio        date,                 -- vigência; null = sem limite
  fim           date,
  ativo         boolean not null default true,
  -- Na fila, a maior entra antes quando duas caem no mesmo minuto (master > apoio).
  prioridade    int  not null default 0,
  observacao    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ao_vivo_cotas_freq check (
    momento <> 'durante' or (vezes is not null) <> (a_cada_min is not null)
  ),
  constraint ao_vivo_cotas_continuo check (momento <> 'continuo' or tipo = 'logo')
);

create index if not exists ao_vivo_cotas_quadro_idx on public.ao_vivo_cotas (quadro, ativo);
create index if not exists ao_vivo_cotas_partner_idx on public.ao_vivo_cotas (partner_id);

create table if not exists public.ao_vivo_sessoes (
  id                    uuid primary key default gen_random_uuid(),
  quadro                text not null,
  modalidade            text,
  episodio_id           uuid references public.agenda_episodios (id) on delete set null,
  titulo                text,
  status                text not null default 'no_ar'
    check (status in ('no_ar', 'encerramento', 'encerrada')),
  duracao_prevista_min  int  not null default 60,
  iniciada_em           timestamptz not null default now(),
  encerrada_em          timestamptz,
  -- Régie segurou: nada novo entra até soltar (o que está no ar termina).
  segurando             boolean not null default false,
  iniciada_por          text,
  created_at            timestamptz not null default now()
);

-- Uma live por vez em cada quadro.
create unique index if not exists ao_vivo_sessoes_uma_por_quadro
  on public.ao_vivo_sessoes (quadro) where status <> 'encerrada';
create index if not exists ao_vivo_sessoes_inicio_idx on public.ao_vivo_sessoes (iniciada_em desc);

create table if not exists public.ao_vivo_insercoes (
  id           uuid primary key default gen_random_uuid(),
  sessao_id    uuid not null references public.ao_vivo_sessoes (id) on delete cascade,
  cota_id      uuid references public.ao_vivo_cotas (id) on delete set null,
  -- O parceiro fica gravado aqui também: o relatório não pode sumir se a cota for apagada.
  partner_id   uuid references public.partners (id) on delete set null,
  tipo         text not null,
  momento      text not null,
  -- Segundos depois do início da live; null = espera o encerramento.
  previsto_s   int,
  duracao_s    int  not null,
  prioridade   int  not null default 0,
  status       text not null default 'pendente'
    check (status in ('pendente', 'no_ar', 'exibida', 'pulada', 'perdida')),
  inicio_em    timestamptz,
  fim_em       timestamptz,
  disparo      text check (disparo in ('auto', 'manual')),
  created_at   timestamptz not null default now()
);

create index if not exists ao_vivo_insercoes_sessao_idx on public.ao_vivo_insercoes (sessao_id, status, previsto_s);
create index if not exists ao_vivo_insercoes_partner_idx on public.ao_vivo_insercoes (partner_id, inicio_em desc);

create or replace function public.ao_vivo_cotas_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ao_vivo_cotas_touch on public.ao_vivo_cotas;
create trigger ao_vivo_cotas_touch before update on public.ao_vivo_cotas
  for each row execute function public.ao_vivo_cotas_touch();

-- ---------------------------------------------------------------------
-- O relógio da live. A tela do OBS e a régie chamam a cada segundo; a trava
-- garante que duas chamadas juntas não soltam duas inserções ao mesmo tempo.
--
-- Duas pistas: o canto (logos, podem ficar vários juntos) e o destaque
-- (faixa, QR, vinheta: um por vez, com p_gap_s de respiro entre um e outro).
-- Segurar só impede que algo novo entre; o que está no ar termina.
-- ---------------------------------------------------------------------
create or replace function public.ao_vivo_avancar(p_sessao uuid, p_gap_s int default 15)
returns void language plpgsql as $$
declare
  s       record;
  agora   timestamptz := clock_timestamp();
  decor   numeric;
  ultimo  timestamptz;
  prox    uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ao_vivo:' || p_sessao::text));

  select * into s from public.ao_vivo_sessoes where id = p_sessao;
  if not found or s.status = 'encerrada' then return; end if;
  decor := extract(epoch from agora - s.iniciada_em);

  -- 1. O que cumpriu o tempo sai do ar (duracao_s = 0 é logo do episódio todo).
  update public.ao_vivo_insercoes
     set status = 'exibida',
         fim_em = inicio_em + make_interval(secs => duracao_s::double precision)
   where sessao_id = p_sessao and status = 'no_ar' and duracao_s > 0
     and inicio_em + make_interval(secs => duracao_s::double precision) <= agora;

  if s.segurando then return; end if;

  -- 2. Canto: todos os logos que chegaram na hora.
  update public.ao_vivo_insercoes
     set status = 'no_ar', inicio_em = agora, disparo = coalesce(disparo, 'auto')
   where sessao_id = p_sessao and status = 'pendente' and tipo = 'logo'
     and previsto_s is not null and (previsto_s <= decor or disparo = 'manual');

  -- 3. Destaque: um por vez.
  if exists (select 1 from public.ao_vivo_insercoes
              where sessao_id = p_sessao and status = 'no_ar' and tipo <> 'logo') then
    return;
  end if;

  select max(fim_em) into ultimo from public.ao_vivo_insercoes
   where sessao_id = p_sessao and tipo <> 'logo' and fim_em is not null;

  select id into prox from public.ao_vivo_insercoes
   where sessao_id = p_sessao and status = 'pendente' and tipo <> 'logo'
     and previsto_s is not null
     and (previsto_s <= decor or disparo = 'manual')
     -- "Agora" da régie fura o respiro; o automático espera.
     and (disparo = 'manual' or ultimo is null
          or ultimo + make_interval(secs => p_gap_s::double precision) <= agora)
   order by (disparo = 'manual') desc,
            (s.status = 'encerramento' and momento = 'encerramento') desc,
            previsto_s, prioridade desc, created_at
   limit 1;

  if prox is not null then
    update public.ao_vivo_insercoes
       set status = 'no_ar', inicio_em = agora, disparo = coalesce(disparo, 'auto')
     where id = prox;
  end if;
end $$;

revoke execute on function public.ao_vivo_avancar(uuid, int) from public, anon, authenticated;

alter table public.ao_vivo_telas     enable row level security;
alter table public.ao_vivo_cotas     enable row level security;
alter table public.ao_vivo_sessoes   enable row level security;
alter table public.ao_vivo_insercoes enable row level security;
-- Sem policies: só service-role.
