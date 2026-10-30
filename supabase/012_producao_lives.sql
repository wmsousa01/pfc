-- =====================================================================
-- PRODUÇÃO: lives do canal → cortes no Contenta
--
-- O hub lê as lives encerradas do canal e, para as que ainda não têm corte,
-- dispara dois jobs no Contenta (shorts 9:16 e longos 16:9) pela rota interna
-- /api/internal/hub. Os cortes saem na conta do PFC no Contenta, de onde sobem
-- para o YouTube e voltam para o /admin/producao pelo fluxo de thumbs.
-- =====================================================================

create table if not exists public.producao_lives (
  id           uuid primary key default gen_random_uuid(),
  youtube_id   text not null unique,
  title        text not null,
  privacy      text,
  duration_sec int,
  ended_at     timestamptz,
  thumb_url    text,
  status       text not null default 'detectada'
    check (status in ('detectada', 'cortando', 'cortada', 'ja_cortada', 'ignorada', 'erro')),
  -- [{ "mode": "shorts" | "long", "jobId": "job_…", "runId": "run_…",
  --    "status": "processing" | "done" | "failed", "totalCuts": 7 }]
  jobs         jsonb not null default '[]'::jsonb,
  error        text,
  triggered_by text,
  triggered_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists producao_lives_status_idx
  on public.producao_lives (status, ended_at desc);

alter table public.producao_lives enable row level security;

drop policy if exists "producao_lives admin read" on public.producao_lives;
create policy "producao_lives admin read" on public.producao_lives
  for select to authenticated using (public.is_admin());
