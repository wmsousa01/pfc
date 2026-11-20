-- =====================================================================
-- CENTRAL DE ARQUIVOS (R2): pastas, arquivos grandes e links de envio.
--
-- A equipe guarda em /admin/arquivos o que antes ficava espalhado no Drive:
-- gravação bruta, vinhetas, vídeos editados de vários GB. Quem é de fora
-- (editor, convidado, parceiro) manda por um link com prazo (/enviar/<token>),
-- sem login, e o arquivo cai na pasta do link.
--
-- Os arquivos ficam no R2, na área "arquivos/" do bucket. Sobem do navegador
-- em partes (multipart), direto ao R2, com retomada se a conexão cair.
-- =====================================================================

create table if not exists public.arquivos_pastas (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid references public.arquivos_pastas (id) on delete cascade,
  nome        text not null,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists arquivos_pastas_parent_idx on public.arquivos_pastas (parent_id, nome);

create table if not exists public.arquivos_links (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,                   -- /enviar/<token>
  pasta_id      uuid not null references public.arquivos_pastas (id) on delete cascade,
  titulo        text not null,                          -- o que aparece para quem envia
  mensagem      text,
  expira_em     timestamptz not null,
  max_arquivo   bigint,                                 -- bytes por arquivo; null = sem limite
  ativo         boolean not null default true,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists arquivos_links_pasta_idx on public.arquivos_links (pasta_id);

create table if not exists public.arquivos (
  id           uuid primary key default gen_random_uuid(),
  pasta_id     uuid not null references public.arquivos_pastas (id) on delete cascade,
  link_id      uuid references public.arquivos_links (id) on delete set null,
  nome         text not null,
  path         text not null unique,                    -- R2: arquivos/<path>
  mime         text not null,
  tamanho      bigint not null,                         -- o que o navegador anunciou; conferido ao concluir
  parte_bytes  bigint not null,                         -- tamanho de cada parte do envio
  upload_id    text,                                    -- envio em partes aberto; null depois de concluído
  status       text not null default 'enviando' check (status in ('enviando', 'pronto')),
  enviado_por  text not null,                           -- e-mail da equipe ou nome de quem usou o link
  created_at   timestamptz not null default now(),
  concluido_em timestamptz
);

create index if not exists arquivos_pasta_idx on public.arquivos (pasta_id, created_at desc);
create index if not exists arquivos_link_idx on public.arquivos (link_id);

-- Acesso só pelo servidor (service role). O admin lê com is_admin().
alter table public.arquivos_pastas enable row level security;
alter table public.arquivos_links  enable row level security;
alter table public.arquivos        enable row level security;

drop policy if exists "arquivos_pastas admin read" on public.arquivos_pastas;
create policy "arquivos_pastas admin read" on public.arquivos_pastas for select to authenticated using (public.is_admin());
drop policy if exists "arquivos_links admin read" on public.arquivos_links;
create policy "arquivos_links admin read" on public.arquivos_links for select to authenticated using (public.is_admin());
drop policy if exists "arquivos admin read" on public.arquivos;
create policy "arquivos admin read" on public.arquivos for select to authenticated using (public.is_admin());

-- Pastas de partida: uma por quadro e uma geral.
insert into public.arquivos_pastas (nome, created_by)
select n, 'sistema'
from unnest(array['Fora da Caixa', 'Lado A Lado B', 'PFC News', 'PFC Visita', 'Tateios Escolares', 'PFC Esporte Clube', 'Geral']) as n
where not exists (select 1 from public.arquivos_pastas p where p.parent_id is null and p.nome = n);
