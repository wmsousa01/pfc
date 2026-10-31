-- Reels de teste do Instagram (só para não seguidores) e as métricas que
-- alimentam o ranking em /admin/marketing. A promoção para os seguidores é
-- feita no app; graduated_at marca o que a equipe já promoveu.

alter table social_posts add column if not exists trial boolean not null default false;
alter table social_posts add column if not exists metrics jsonb;
alter table social_posts add column if not exists metrics_at timestamptz;
alter table social_posts add column if not exists graduated_at timestamptz;

create index if not exists social_posts_trial_idx
  on social_posts (published_at desc)
  where trial and status = 'publicado';
