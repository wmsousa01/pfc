-- =====================================================================
-- MARKETING: publicação orgânica dos cortes em várias redes
--
-- Os cortes prontos no Contenta (arquivo público no R2) são programados no
-- /admin/marketing para YouTube, Instagram e Facebook (TikTok na fase 2).
-- A fila roda a cada 5 min (014_social_cron.sql → /api/cron/social) e
-- publica o que venceu. Desenho copiado do Contenta (social_connections +
-- social_posts), com tokens cifrados em AES-256-GCM (SOCIAL_TOKEN_KEY).
-- =====================================================================

-- Contas conectadas. O YouTube NÃO entra aqui: reaproveita o canal já
-- conectado no /admin/producao (producao_config.yt_refresh_token).
create table if not exists public.social_connections (
  id                  bigint generated always as identity primary key,
  platform            text not null check (platform in ('instagram', 'facebook', 'tiktok')),
  external_account_id text not null,             -- ig user id, page id, open_id
  account_name        text,
  access_token_enc    text not null,             -- iv:tag:ciphertext (base64)
  refresh_token_enc   text,
  token_expires_at    timestamptz,               -- null = não expira (token de Página da Meta)
  scopes              text,
  status              text not null default 'ativa' check (status in ('ativa', 'revogada')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (platform, external_account_id)
);

create table if not exists public.social_posts (
  id              uuid primary key default gen_random_uuid(),
  platform        text not null check (platform in ('youtube', 'instagram', 'facebook', 'tiktok')),
  connection_id   bigint references public.social_connections (id) on delete set null,
  contenta_job_id text not null,
  cut_file        text not null,
  video_url       text not null,                 -- MP4 público no R2 do Contenta
  thumb_url       text,
  title           text not null,
  caption         text not null default '',
  status          text not null default 'agendado'
    check (status in ('agendado', 'publicando', 'processando', 'publicado', 'erro', 'cancelado')),
  scheduled_at    timestamptz not null default now(),
  attempts        int not null default 0,
  container_id    text,                          -- Instagram: container em processamento
  external_id     text,                          -- id do post/vídeo na rede
  post_url        text,
  error           text,
  created_by      text,                          -- e-mail de quem programou; null = automação
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- O mesmo corte não sai duas vezes na mesma rede (cancelado libera de novo).
create unique index if not exists social_posts_unico_idx
  on public.social_posts (platform, contenta_job_id, cut_file)
  where status <> 'cancelado';

create index if not exists social_posts_fila_idx
  on public.social_posts (status, scheduled_at);

alter table public.social_connections enable row level security;
alter table public.social_posts       enable row level security;

-- social_connections fica sem policy: só o service-role lê os tokens.
drop policy if exists "social_posts admin read" on public.social_posts;
create policy "social_posts admin read" on public.social_posts
  for select to authenticated using (public.is_admin());
