-- Horários avulsos: o quadro grava fora do horário fixo numa data só
-- (mudou de dia naquela semana ou vai ao ar duas vezes). Abre uma vaga no
-- link público como os horários fixos. Quando é mudança de dia, a data
-- original fica bloqueada para o quadro (bloqueio_id), e remover o avulso
-- libera de novo.
create table if not exists public.agenda_avulsos (
  id          bigint generated always as identity primary key,
  quadro      text not null,
  data        date not null,
  hora        text not null check (hora ~ '^\d{2}:\d{2}$'),
  duracao_min int  not null default 90,
  motivo      text,
  bloqueio_id bigint references public.agenda_bloqueios(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (quadro, data, hora)
);

alter table public.agenda_avulsos enable row level security;

drop policy if exists "agenda_avulsos admin read" on public.agenda_avulsos;
create policy "agenda_avulsos admin read" on public.agenda_avulsos
  for select to authenticated using (public.is_admin());
