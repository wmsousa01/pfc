-- 029: equipe com papéis por área + recebimento de materiais dos editores.
--
-- Admin continua sendo quem está em app_admins (acesso total). A tabela equipe
-- dá acesso PARCIAL: cada membro tem um papel (nível pré-definido) e a lista de
-- áreas que abre. As áreas liberadas leem o banco com service-role no servidor,
-- então nenhuma das duas tabelas tem policy para o cliente.

create table if not exists public.equipe (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null,
  papel       text not null default 'editor',
  -- Áreas do admin ("agenda", "materiais"...) e permissões finas ("materiais.aprovar").
  areas       text[] not null default '{}',
  ativo       boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.equipe enable row level security;

-- Materiais enviados pelos editores. O arquivo mora no Drive da produção, numa
-- árvore criada pelo próprio app (Categoria / Quadro / Episódio ou referência);
-- aqui fica o catálogo e o andamento da revisão.
create table if not exists public.materiais (
  id               uuid primary key default gen_random_uuid(),
  categoria        text not null check (categoria in ('quadro', 'visita', 'anuncio', 'vinheta')),
  quadro           text,
  episodio_id      uuid references public.agenda_episodios(id) on delete set null,
  -- Negócio (PFC Visita), cliente/campanha (anúncio) ou nome da vinheta.
  referencia       text,
  tipo             text not null,
  titulo           text not null,
  nota             text,
  versao           int not null default 1,
  -- Nova versão de um material com ajuste pedido.
  substitui_id     uuid references public.materiais(id) on delete set null,
  -- enviando: sessão de upload aberta, arquivo ainda não confirmado.
  status           text not null default 'enviando'
                   check (status in ('enviando', 'recebido', 'ajuste', 'aprovado', 'substituido', 'arquivado')),
  drive_pasta_id   text,
  drive_file_id    text,
  nome_arquivo     text not null,
  mime             text,
  tamanho          bigint,
  enviado_por      uuid,
  enviado_por_nome text,
  revisado_por     text,
  revisado_em      timestamptz,
  comentario       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists materiais_status_idx on public.materiais (status, created_at desc);
create index if not exists materiais_enviado_por_idx on public.materiais (enviado_por, created_at desc);
create index if not exists materiais_episodio_idx on public.materiais (episodio_id);

alter table public.materiais enable row level security;

create table if not exists public.materiais_eventos (
  id           bigserial primary key,
  material_id  uuid not null references public.materiais(id) on delete cascade,
  actor        text not null,
  action       text not null,
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists materiais_eventos_material_idx on public.materiais_eventos (material_id, created_at);

alter table public.materiais_eventos enable row level security;
