-- =====================================================================
-- APRESENTADORES: cadastro próprio, materiais e termo de uso de imagem.
--
-- O apresentador se cadastra em /apresentador, aceita o termo de uso de
-- imagem e ganha um link pessoal (/apresentador/<token>) para mandar fotos,
-- vídeos, vinhetas e PDFs usados nas gravações e transmissões. A equipe
-- aprova em /admin/apresentadores: a aprovação liga o cadastro aos quadros
-- (agenda_apresentadores), e a foto escolhida vira a foto padrão das artes.
--
-- Os arquivos ficam no bucket "producao", em apresentadores/<id>/, e sobem
-- do navegador direto ao Storage por URL assinada (limite de 4,5 MB da Vercel).
-- =====================================================================

create table if not exists public.apresentadores_cadastros (
  id               uuid primary key default gen_random_uuid(),
  token            text not null unique,                 -- link pessoal: /apresentador/<token>
  nome             text not null,                        -- como é chamado no programa
  papel            text,                                 -- o que sai embaixo do nome na arte
  email            text not null,
  whatsapp         text not null,
  instagram        text,
  quadros          text[] not null default '{}',         -- quadros que apresenta ou quer apresentar
  bio              text,
  status           text not null default 'pendente'
    check (status in ('pendente', 'aprovado', 'arquivado')),
  -- Aceite do termo de uso de imagem: versão, hash do texto exibido e quem aceitou.
  termo_versao     text not null,
  termo_hash       text not null,
  termo_nome       text not null,                        -- nome completo digitado como assinatura
  termo_aceito_em  timestamptz not null default now(),
  termo_ip         text,
  termo_user_agent text,
  termo_revogado_em timestamptz,                         -- pedido de não usar em conteúdos novos
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists apresentadores_cadastros_status_idx
  on public.apresentadores_cadastros (status, created_at desc);

create table if not exists public.apresentadores_materiais (
  id           uuid primary key default gen_random_uuid(),
  cadastro_id  uuid not null references public.apresentadores_cadastros (id) on delete cascade,
  tipo         text not null default 'foto'
    check (tipo in ('foto', 'video', 'vinheta', 'logo', 'documento', 'outro')),
  path         text not null,                            -- bucket producao: apresentadores/<cadastro>/<id>-<nome>
  nome         text not null,
  mime         text not null,
  tamanho      bigint not null default 0,
  descricao    text,
  created_at   timestamptz not null default now()
);

create index if not exists apresentadores_materiais_cadastro_idx
  on public.apresentadores_materiais (cadastro_id, created_at);

-- O apresentador do quadro (o que entra nas artes) passa a saber de que cadastro veio.
alter table public.agenda_apresentadores
  add column if not exists cadastro_id uuid references public.apresentadores_cadastros (id) on delete set null;

-- Acesso só pelo servidor (service role). O admin lê com is_admin().
alter table public.apresentadores_cadastros enable row level security;
alter table public.apresentadores_materiais enable row level security;

drop policy if exists "apresentadores_cadastros admin read" on public.apresentadores_cadastros;
create policy "apresentadores_cadastros admin read" on public.apresentadores_cadastros
  for select to authenticated using (public.is_admin());

drop policy if exists "apresentadores_materiais admin read" on public.apresentadores_materiais;
create policy "apresentadores_materiais admin read" on public.apresentadores_materiais
  for select to authenticated using (public.is_admin());
