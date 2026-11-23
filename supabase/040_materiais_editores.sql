-- 040: recebimento de materiais dos editores (Drive da produção, com aprovação).
--
-- Nasceu como 029_equipe_materiais no PR #50. A parte de equipe foi trocada
-- pelo modelo de papéis da 039; aqui ficam só as tabelas de materiais (já
-- criadas em produção pela 029 antiga — por isso o "if not exists") e as
-- permissões novas nos papéis de partida.
--
-- Permissões: materiais.ver (vê os próprios envios), materiais.editar (envia),
-- materiais.aprovar (vê os de todos e aprova ou pede ajuste).

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

-- Papéis de partida: coordenação envia e aprova; editor, social media, tráfego
-- e designer enviam (anúncios e vinhetas também passam por aqui).
update public.papeis set permissoes = array(select distinct unnest(permissoes || array['materiais.editar']))
 where chave in ('editor', 'social_media', 'trafego', 'designer');
update public.papeis set permissoes = array(select distinct unnest(permissoes || array['materiais.editar', 'materiais.aprovar']))
 where chave = 'coordenacao';
