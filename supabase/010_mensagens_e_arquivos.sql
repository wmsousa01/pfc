-- =====================================================================
-- ÁREA DO CLIENTE: mensagens e arquivos
--
-- A conversa mora no Jira (uma tarefa "Conversa com o cliente" por Epic,
-- chave em `partner_panels.jira_chat`). Os ARQUIVOS do cliente moram aqui,
-- num bucket privado: o upload vai direto do navegador para o Storage por
-- URL assinada, sem passar pelo limite de 4,5 MB das funções da Vercel, e
-- sem gastar o espaço de anexos do Jira.
-- =====================================================================

alter table public.partner_panels
  add column if not exists jira_chat text;      -- ex.: PROD-72

create table if not exists public.client_files (
  id              uuid primary key default gen_random_uuid(),
  partner_id      uuid not null references public.partners (id) on delete cascade,
  storage_path    text not null unique,         -- <partner_id>/<aaaa-mm>/<uuid>-<nome>
  file_name       text not null,
  size_bytes      bigint not null,
  mime            text,
  -- id do comentário no Jira em que o arquivo foi enviado (agrupa na conversa)
  jira_comment_id text,
  created_at      timestamptz not null default now()
);

create index if not exists client_files_partner_idx
  on public.client_files (partner_id, created_at desc);

alter table public.client_files enable row level security;

drop policy if exists "client_files admin read" on public.client_files;
create policy "client_files admin read"
  on public.client_files for select
  to authenticated
  using (public.is_admin());

-- Bucket privado. Sem policies em storage.objects: só o service-role lê e
-- assina URLs, depois de validar o token do painel ou o login do admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-files',
  'client-files',
  false,
  52428800,  -- 50 MB por arquivo
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/svg+xml',
    'application/pdf',
    'video/mp4', 'video/quicktime',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
