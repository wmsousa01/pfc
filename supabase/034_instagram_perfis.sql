-- =====================================================================
-- PERFIS EXTRAS DO INSTAGRAM (ex.: @ladoaladob26, do quadro Lado A Lado B).
--
-- Até aqui era uma conta por rede: conectar outra desativava a anterior.
-- Agora a conta "principal" continua sendo a que todo o resto usa (agenda,
-- inserções, números da semana, anúncios), e as outras contas do Instagram
-- que vierem no login da Meta (cada uma ligada à sua Página) ficam como
-- perfis extras, escolhidos post a post em /admin/marketing.
--
-- social_posts.perfil_id: para qual perfil o post vai (null = principal).
-- Fica sem FK de propósito: perfil desconectado não pode fazer o post cair
-- no perfil principal (on delete set null faria isso).
-- =====================================================================

alter table public.social_connections
  add column if not exists principal boolean not null default true;

alter table public.social_posts
  add column if not exists perfil_id bigint;

-- O mesmo corte pode sair no perfil principal e num extra.
drop index if exists public.social_posts_unico_idx;
create unique index if not exists social_posts_unico_idx
  on public.social_posts (platform, contenta_job_id, cut_file, coalesce(perfil_id, 0))
  where status <> 'cancelado';
