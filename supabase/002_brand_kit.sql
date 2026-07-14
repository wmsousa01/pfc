-- =====================================================================
-- Fora da Caixa — Kit de marca do parceiro (rode no SQL Editor do Supabase)
-- Adiciona paleta de cores e preset de estilo visual.
-- `accent` continua sendo a COR PRIMÁRIA (compatibilidade).
-- =====================================================================

alter table public.partners
  add column if not exists color_secondary text,
  add column if not exists color_bg text default '#0a0a0a',
  add column if not exists style_preset text default 'moderno';

-- Storage: bucket público para logos/capas dos parceiros.
-- O bucket é criado pelo app (script), mas as políticas ficam aqui.
-- Leitura pública + escrita apenas para usuários autenticados (admin).
insert into storage.buckets (id, name, public)
values ('partner-assets', 'partner-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "partner-assets public read" on storage.objects;
create policy "partner-assets public read"
  on storage.objects for select
  using (bucket_id = 'partner-assets');

drop policy if exists "partner-assets admin write" on storage.objects;
create policy "partner-assets admin write"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'partner-assets')
  with check (bucket_id = 'partner-assets');
