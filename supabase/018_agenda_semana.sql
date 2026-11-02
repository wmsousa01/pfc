-- =====================================================================
-- AGENDA (2): apresentadores, materiais do convidado, arte por IA e a
-- arte da agenda da semana.
--
-- A arte do episódio passa a ter o apresentador ao lado do convidado e
-- pode ser desenhada pelo Gemini a partir das fotos reais (modo "ia"), no
-- padrão das artes da equipe. O PFC News costuma não ter convidado: a arte
-- sai só com o apresentador da semana. O convidado manda fotos, logo e
-- referências pelo link dele, direto para o Storage.
-- =====================================================================

-- Quem apresenta cada quadro. A foto padrão entra em toda arte do quadro;
-- o episódio pode trocar por outra (material tipo "apresentador").
create table if not exists public.agenda_apresentadores (
  id         uuid primary key default gen_random_uuid(),
  quadro     text not null,
  nome       text not null,
  papel      text not null default 'APRESENTADOR',   -- o que sai embaixo do nome na arte
  foto_path  text,                                   -- bucket producao: agenda/apresentadores/<id>.jpg
  ordem      int  not null default 0,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists agenda_apresentadores_quadro_idx
  on public.agenda_apresentadores (quadro, ordem);

-- null = todos os apresentadores ativos do quadro.
alter table public.agenda_episodios add column if not exists apresentadores uuid[];

-- Como o convidado aparece na arte, embaixo do nome ("EMPRESÁRIO").
alter table public.agenda_convidados add column if not exists cargo text;

-- Modo da arte: "ia" (Gemini compõe a cena com as fotos de referência) ou
-- "recorte" (foto recortada + texto por cima, rosto 100% fiel).
alter table public.agenda_artes add column if not exists modo text not null default 'recorte';

-- Fotos, logos e referências do episódio (do convidado ou da equipe).
create table if not exists public.agenda_materiais (
  id              uuid primary key default gen_random_uuid(),
  episodio_id     uuid not null references public.agenda_episodios (id) on delete cascade,
  convidado_id    uuid references public.agenda_convidados (id) on delete set null,
  apresentador_id uuid references public.agenda_apresentadores (id) on delete set null,
  tipo            text not null default 'foto'
    check (tipo in ('foto', 'apresentador', 'logo', 'referencia', 'outro')),
  path            text not null,                     -- bucket producao: agenda/<ep>/materiais/<id>-<nome>
  nome            text not null,
  mime            text not null,
  tamanho         bigint not null default 0,
  usar_na_arte    boolean not null default true,
  enviado_por     text not null,                     -- e-mail da equipe ou "convidado"
  created_at      timestamptz not null default now()
);

create index if not exists agenda_materiais_episodio_idx
  on public.agenda_materiais (episodio_id, created_at);

-- Arte da agenda da semana (3:4, todos os episódios da semana em cards).
-- semana = a segunda-feira. Cada geração é uma versão; a escolhida vai para o Instagram.
create table if not exists public.agenda_semana_artes (
  id         uuid primary key default gen_random_uuid(),
  semana     date not null,
  path       text not null,                          -- 1080×1440
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists agenda_semana_artes_semana_idx
  on public.agenda_semana_artes (semana, created_at desc);

create table if not exists public.agenda_semanas (
  semana         date primary key,
  arte_id        uuid references public.agenda_semana_artes (id) on delete set null,
  ig_legenda     text,
  ig_collab      boolean not null default true,
  ig_publicar_em timestamptz,
  ig_status      text not null default 'nenhum'
    check (ig_status in ('nenhum', 'agendado', 'publicando', 'publicado', 'erro')),
  ig_post_url    text,
  ig_erro        text,
  updated_at     timestamptz not null default now()
);

alter table public.agenda_apresentadores enable row level security;
alter table public.agenda_materiais      enable row level security;
alter table public.agenda_semana_artes   enable row level security;
alter table public.agenda_semanas        enable row level security;

drop policy if exists "agenda_apresentadores admin read" on public.agenda_apresentadores;
create policy "agenda_apresentadores admin read" on public.agenda_apresentadores
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_materiais admin read" on public.agenda_materiais;
create policy "agenda_materiais admin read" on public.agenda_materiais
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_semana_artes admin read" on public.agenda_semana_artes;
create policy "agenda_semana_artes admin read" on public.agenda_semana_artes
  for select to authenticated using (public.is_admin());

drop policy if exists "agenda_semanas admin read" on public.agenda_semanas;
create policy "agenda_semanas admin read" on public.agenda_semanas
  for select to authenticated using (public.is_admin());

-- Apresentadores que aparecem nas artes da equipe. A foto sobe em
-- /admin/agenda/config; o PFC News fica para cadastrar lá.
insert into public.agenda_apresentadores (quadro, nome, papel, ordem)
select v.quadro, v.nome, v.papel, 0
from (values
  ('fora-da-caixa', 'Willian Marinho', 'HOST'),
  ('lado-a-lado-b', 'Alexandre Sampaio', 'APRESENTADOR')
) as v(quadro, nome, papel)
where not exists (select 1 from public.agenda_apresentadores a where a.quadro = v.quadro);
