-- =====================================================================
-- AGENDA: convidado → briefing → arte → divulgação → live no YouTube
--
-- A pré-produção dos episódios. O convidado escolhe um horário livre no
-- /convidado (horários fixos de cada quadro, em agenda_slots), preenche o
-- briefing e recebe um link próprio para completar depois. A equipe
-- confirma no /admin/agenda; daí saem o evento no Google Calendar (com
-- convite para o convidado), o briefing do apresentador gerado pela IA, as
-- artes de divulgação (feed 4:5, story/TikTok 9:16 e a thumb 16:9 da live),
-- o post collab no Instagram e a live agendada no YouTube.
-- =====================================================================

-- Horários fixos em que cada quadro grava. Hora no horário de Brasília.
create table if not exists public.agenda_slots (
  id               bigint generated always as identity primary key,
  quadro           text not null,
  weekday          int  not null check (weekday between 0 and 6),   -- 0 = domingo
  hora             text not null check (hora ~ '^\d{2}:\d{2}$'),
  duracao_min      int  not null default 90,
  antecedencia_dias int not null default 2,     -- o convidado não marca para amanhã
  janela_dias      int  not null default 42,    -- até quantos dias à frente aparece
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (quadro, weekday, hora)
);

-- Datas sem gravação (feriado, viagem). quadro null = todos.
create table if not exists public.agenda_bloqueios (
  id         bigint generated always as identity primary key,
  data       date not null,
  quadro     text,
  motivo     text,
  created_at timestamptz not null default now()
);

create table if not exists public.agenda_episodios (
  id              uuid primary key default gen_random_uuid(),
  quadro          text not null,
  inicio          timestamptz not null,
  duracao_min     int  not null default 90,
  status          text not null default 'solicitado'
    check (status in ('solicitado', 'confirmado', 'realizado', 'cancelado')),
  tema            text,                         -- a pauta em uma linha
  briefing        jsonb,                        -- gerado pela IA e editado pela equipe
  observacoes     text,                         -- nota interna da equipe
  arte_id         uuid,                         -- conjunto de artes aprovado
  gcal_event_id   text,
  yt_broadcast_id text,
  ig_formatos     text[] not null default '{}', -- feed | story
  ig_legenda      text,
  ig_collab       boolean not null default true,
  ig_publicar_em  timestamptz,                  -- null = não programado
  ig_status       text not null default 'nenhum'
    check (ig_status in ('nenhum', 'agendado', 'publicando', 'publicado', 'erro')),
  ig_posts        jsonb not null default '[]'::jsonb,   -- [{ formato, id, url }]
  ig_erro         text,
  created_by      text,                         -- e-mail da equipe; null = o próprio convidado
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Dois convidados não pegam o mesmo horário do mesmo quadro (cancelado libera).
create unique index if not exists agenda_episodios_horario_idx
  on public.agenda_episodios (quadro, inicio)
  where status <> 'cancelado';

create index if not exists agenda_episodios_inicio_idx
  on public.agenda_episodios (inicio);

create index if not exists agenda_episodios_ig_fila_idx
  on public.agenda_episodios (ig_status, ig_publicar_em);

create table if not exists public.agenda_convidados (
  id           uuid primary key default gen_random_uuid(),
  episodio_id  uuid not null references public.agenda_episodios (id) on delete cascade,
  token        text not null unique,            -- link do convidado: /convidado/b/<token>
  nome         text not null,
  email        text,
  whatsapp     text,
  instagram    text,                            -- sem @
  bio          text,
  temas        text,
  divulgar     text,                            -- o que ele quer divulgar no episódio
  links        text,
  foto_path    text,                            -- bucket producao: agenda/convidados/<id>.jpg
  ig_perfil    jsonb,                           -- business_discovery: nome, bio, seguidores, foto
  briefing_em  timestamptz,                     -- última vez que o convidado salvou o briefing
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists agenda_convidados_episodio_idx
  on public.agenda_convidados (episodio_id, created_at);

-- Cada geração produz o conjunto inteiro, nos três formatos.
create table if not exists public.agenda_artes (
  id          uuid primary key default gen_random_uuid(),
  episodio_id uuid not null references public.agenda_episodios (id) on delete cascade,
  feed_path   text not null,                    -- 1080×1350
  story_path  text not null,                    -- 1080×1920 (Story, Reels, TikTok)
  thumb_path  text not null,                    -- 1280×720 (thumb da live)
  l1          text not null,
  l2          text not null,
  l3          text,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists agenda_artes_episodio_idx
  on public.agenda_artes (episodio_id, created_at desc);

create table if not exists public.agenda_eventos (
  id          bigint generated always as identity primary key,
  episodio_id uuid not null references public.agenda_episodios (id) on delete cascade,
  actor       text not null,                    -- e-mail, "convidado" ou "automação"
  action      text not null,
  detail      text,
  created_at  timestamptz not null default now()
);

create index if not exists agenda_eventos_episodio_idx
  on public.agenda_eventos (episodio_id, created_at desc);

alter table public.agenda_slots      enable row level security;
alter table public.agenda_bloqueios  enable row level security;
alter table public.agenda_episodios  enable row level security;
alter table public.agenda_convidados enable row level security;
alter table public.agenda_artes      enable row level security;
alter table public.agenda_eventos    enable row level security;

-- Tudo passa pelo servidor (service-role); o admin só lê. O convidado nunca
-- fala direto com o banco: o link dele é resolvido no servidor pelo token.
drop policy if exists "agenda_slots admin read" on public.agenda_slots;
create policy "agenda_slots admin read" on public.agenda_slots
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_bloqueios admin read" on public.agenda_bloqueios;
create policy "agenda_bloqueios admin read" on public.agenda_bloqueios
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_episodios admin read" on public.agenda_episodios;
create policy "agenda_episodios admin read" on public.agenda_episodios
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_convidados admin read" on public.agenda_convidados;
create policy "agenda_convidados admin read" on public.agenda_convidados
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_artes admin read" on public.agenda_artes;
create policy "agenda_artes admin read" on public.agenda_artes
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_eventos admin read" on public.agenda_eventos;
create policy "agenda_eventos admin read" on public.agenda_eventos
  for select to authenticated using (public.is_admin());

-- Horários iniciais dos quadros com dia fixo (dá para mudar em
-- /admin/agenda/config). Papo Fora da Caixa às terças, Lado A Lado B às
-- quintas. O horário é um palpite — confira antes de divulgar o link. PFC
-- Visita não tem dia fixo: entra pelo "Novo episódio" do admin.
insert into public.agenda_slots (quadro, weekday, hora, duracao_min) values
  ('fora-da-caixa', 2, '19:00', 90),
  ('lado-a-lado-b', 4, '19:00', 90)
on conflict (quadro, weekday, hora) do nothing;
