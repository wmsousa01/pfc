-- =====================================================================
-- PRODUÇÃO: cortes do YouTube → thumb gerada → aprovação → publicação
--
-- O corte nasce no Contenta e sobe privado para o canal. Daqui em diante o
-- hub assume: lê os vídeos privados do canal pela YouTube Data API, gera
-- opções de headline e thumb no Gemini, a equipe aprova uma no
-- /admin/producao e só então a thumb sobe e o vídeo é agendado/publicado.
-- =====================================================================

create table if not exists public.producao_videos (
  id                uuid primary key default gen_random_uuid(),
  youtube_id        text not null unique,
  title             text not null,
  quadro            text,
  duration_sec      int,
  privacy           text,                       -- private | unlisted | public (último lido)
  yt_thumb_url      text,                       -- miniatura automática do YouTube
  frame_path        text,                       -- frame enviado à mão, quando o do YouTube não abre
  transcript        text,
  headline_options  jsonb not null default '[]'::jsonb,  -- [{ "l1": "...", "l2": "..." }]
  status            text not null default 'novo'
    check (status in ('novo', 'gerando', 'revisar', 'aprovada', 'publicada', 'ignorado', 'erro')),
  error             text,
  approved_thumb_id uuid,
  approved_by       text,
  approved_at       timestamptz,
  publish_at        timestamptz,                -- null = publicar na hora da aprovação
  uploaded_at       timestamptz,                -- quando o YouTube recebeu o vídeo
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists producao_videos_status_idx
  on public.producao_videos (status, uploaded_at desc);

create table if not exists public.producao_thumbs (
  id           uuid primary key default gen_random_uuid(),
  video_id     uuid not null references public.producao_videos (id) on delete cascade,
  storage_path text not null,                   -- bucket producao: thumbs/<video_id>/<uuid>.jpg
  l1           text not null,
  l2           text not null,
  model        text not null,
  created_by   text,                            -- e-mail de quem pediu; null = automação
  created_at   timestamptz not null default now()
);

create index if not exists producao_thumbs_video_idx
  on public.producao_thumbs (video_id, created_at desc);

-- Histórico que a equipe lê no cartão: quem fez o quê e quando.
create table if not exists public.producao_eventos (
  id         bigint generated always as identity primary key,
  video_id   uuid not null references public.producao_videos (id) on delete cascade,
  actor      text not null,                     -- e-mail ou "automação"
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists producao_eventos_video_idx
  on public.producao_eventos (video_id, created_at desc);

-- Chave/valor só do servidor: refresh token do canal, logo, prompt.
create table if not exists public.producao_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.producao_videos  enable row level security;
alter table public.producao_thumbs  enable row level security;
alter table public.producao_eventos enable row level security;
alter table public.producao_config  enable row level security;

drop policy if exists "producao_videos admin read" on public.producao_videos;
create policy "producao_videos admin read" on public.producao_videos
  for select to authenticated using (public.is_admin());

drop policy if exists "producao_thumbs admin read" on public.producao_thumbs;
create policy "producao_thumbs admin read" on public.producao_thumbs
  for select to authenticated using (public.is_admin());

drop policy if exists "producao_eventos admin read" on public.producao_eventos;
create policy "producao_eventos admin read" on public.producao_eventos
  for select to authenticated using (public.is_admin());

-- producao_config fica sem policy: guarda o refresh token do YouTube, só o
-- service-role lê.

-- Bucket privado: thumbs geradas, frames enviados e o logo oficial.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('producao', 'producao', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
