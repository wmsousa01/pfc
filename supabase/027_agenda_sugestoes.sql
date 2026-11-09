-- Sugestões no roteiro: o apresentador, os comentaristas e a equipe abrem o
-- roteiro pelo link (/roteiro/<token do espelho>) e sugerem edições em
-- cada parte de uma matéria, ou deixam um comentário geral nela. A
-- produção aceita (o texto entra no roteiro e no espelho) ou recusa no
-- admin. Uma linha por sugestão, para duas pessoas sugerindo ao mesmo
-- tempo não apagarem uma a outra.
create table if not exists public.agenda_sugestoes (
  id           uuid primary key default gen_random_uuid(),
  episodio_id  uuid not null references public.agenda_episodios (id) on delete cascade,
  materia      text not null,                   -- título da matéria na hora da sugestão
  campo        text not null
    check (campo in ('manchete', 'leitura', 'comentario', 'humor', 'reflexao', 'pontos', 'servico', 'geral')),
  original     text,                            -- o texto como estava quando a pessoa sugeriu
  proposta     text,                            -- o texto sugerido; null = só comentário
  comentario   text,
  autor        text not null,                   -- o nome que a pessoa digitou no link
  status       text not null default 'aberta' check (status in ('aberta', 'aceita', 'recusada')),
  decidida_por text,
  decidida_em  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists agenda_sugestoes_episodio_idx
  on public.agenda_sugestoes (episodio_id, created_at);

-- Como o resto da agenda: tudo passa pelo servidor (service-role); o admin só lê.
alter table public.agenda_sugestoes enable row level security;

drop policy if exists "agenda_sugestoes admin read" on public.agenda_sugestoes;
create policy "agenda_sugestoes admin read" on public.agenda_sugestoes
  for select to authenticated using (public.is_admin());
