-- =====================================================================
-- CAMPANHAS PAGAS (Meta Ads + Google Ads) do próprio Fora da Caixa
--
-- /admin/campanhas: estratégias → criativos entregues a cada uma → anúncio
-- PAUSADO no gerenciador (a equipe ativa lá) → métricas de volta.
--   mkt_estrategias  o briefing de cada campanha (objetivo, público, oferta)
--   mkt_criativos    biblioteca: Drive, upload, cortes do Contenta ou gerado
--   mkt_entregas     criativo × estratégia × rede, com copy, análise e ids
-- Arquivos no bucket `producao`, em campanhas/.
-- =====================================================================

-- As contas de anúncio entram na mesma tabela das conexões sociais, com o
-- token cifrado (SOCIAL_TOKEN_KEY): meta_ads = token longo de usuário
-- (60 dias), google_ads = refresh token do OAuth com escopo adwords.
alter table public.social_connections drop constraint if exists social_connections_platform_check;
alter table public.social_connections add constraint social_connections_platform_check
  check (platform in ('instagram', 'facebook', 'tiktok', 'meta_ads', 'google_ads'));

create table if not exists public.mkt_estrategias (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  objetivo         text not null default 'trafego' check (objetivo in ('alcance', 'trafego', 'video')),
  plataformas      text[] not null default '{meta}',
  publico          text not null default '',
  oferta           text not null default '',
  mensagem         text not null default '',
  angulos          text[] not null default '{}',
  link             text,
  cta              text not null default 'LEARN_MORE',
  -- Segmentação geográfica: centro + raio (padrão Mogi Guaçu, 15 km).
  geo_lat          double precision not null default -22.3719,
  geo_lng          double precision not null default -46.9422,
  geo_raio_km      int not null default 15 check (geo_raio_km between 1 and 80),
  idade_min        int not null default 18 check (idade_min between 18 and 65),
  idade_max        int not null default 65 check (idade_max between 18 and 65),
  orcamento_diario int not null default 2000,    -- centavos de real
  inicio           date,
  fim              date,
  kpi              text not null default '',
  status           text not null default 'rascunho' check (status in ('rascunho', 'ativa', 'pausada', 'encerrada')),
  meta_campaign_id text,
  meta_adset_id    text,
  google_campaign_id text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.mkt_criativos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  tipo         text not null check (tipo in ('video', 'imagem')),
  origem       text not null check (origem in ('drive', 'upload', 'contenta', 'gerado')),
  -- drive: id do arquivo · contenta: URL pública do MP4 · upload/gerado: path no Storage
  ref          text not null,
  thumb_url    text,                              -- miniatura pública (Drive/Contenta)
  mime         text,
  tamanho      bigint,
  duracao_s    int,
  formato      text check (formato in ('9:16', '4:5', '1:1', '16:9')),
  -- Parâmetros do gerador de estático (headline, CTA, prompt), para refazer.
  gerado_com   jsonb,
  analise      jsonb,
  analise_nota int,
  analisado_em timestamptz,
  arquivado    boolean not null default false,
  created_by   text,
  created_at   timestamptz not null default now(),
  unique (origem, ref)
);

create table if not exists public.mkt_entregas (
  id              uuid primary key default gen_random_uuid(),
  estrategia_id   uuid not null references public.mkt_estrategias (id) on delete cascade,
  criativo_id     uuid not null references public.mkt_criativos (id) on delete cascade,
  plataforma      text not null check (plataforma in ('meta', 'google')),
  angulo          text,
  headline        text not null default '',
  texto           text not null default '',
  status          text not null default 'rascunho'
    check (status in ('rascunho', 'aprovado', 'enviando', 'no_gerenciador', 'erro')),
  -- Análise do criativo no contexto da estratégia (o da biblioteca é genérico).
  analise         jsonb,
  analise_nota    int,
  -- Passos da subida na Meta, guardados para retomar se o vídeo demorar.
  meta_video_id   text,
  meta_image_hash text,
  meta_creative_id text,
  meta_ad_id      text,
  -- Google: o anúncio é montado no gerenciador; o id liga as métricas.
  google_ad_id    text,
  erro            text,
  metrics         jsonb,
  metrics_at      timestamptz,
  aprovado_por    text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (estrategia_id, criativo_id, plataforma)
);

create index if not exists mkt_entregas_estrategia_idx on public.mkt_entregas (estrategia_id);
create index if not exists mkt_criativos_recentes_idx on public.mkt_criativos (created_at desc) where not arquivado;

alter table public.mkt_estrategias enable row level security;
alter table public.mkt_criativos   enable row level security;
alter table public.mkt_entregas    enable row level security;

-- Escrita só pelo service-role (server actions); admin lê.
drop policy if exists "mkt_estrategias admin read" on public.mkt_estrategias;
create policy "mkt_estrategias admin read" on public.mkt_estrategias for select to authenticated using (public.is_admin());
drop policy if exists "mkt_criativos admin read" on public.mkt_criativos;
create policy "mkt_criativos admin read" on public.mkt_criativos for select to authenticated using (public.is_admin());
drop policy if exists "mkt_entregas admin read" on public.mkt_entregas;
create policy "mkt_entregas admin read" on public.mkt_entregas for select to authenticated using (public.is_admin());
