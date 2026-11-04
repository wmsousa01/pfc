-- Reel em collab: convite para até 3 perfis (o convidado aceita no app e o
-- Reel aparece nos dois). collab_dropped = a Meta recusou collab no reel de
-- teste e ele saiu sem o convite.
alter table public.social_posts
  add column if not exists collaborators text[] not null default '{}',
  add column if not exists collab_dropped boolean not null default false;
