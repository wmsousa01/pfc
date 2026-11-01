-- Terceira linha opcional da headline (gancho / destaque / complemento).
-- Rodar antes do deploy: o pipeline só grava l3 quando ela existe, mas grava.
alter table public.producao_thumbs add column if not exists l3 text;
