-- ---------------------------------------------------------------------
-- PARTNERS: updated_at
--
-- O sitemap precisa dizer quando a página do parceiro mudou. `created_at`
-- responde outra pergunta: nunca se move quando o admin edita `content`,
-- então a página que de fato mudou não sinaliza nada para o buscador.
--
-- Enquanto esta migration não roda, `sitemap.ts` cai de volta em
-- `created_at` — a coluna ausente chega como undefined no select("*").
-- ---------------------------------------------------------------------

alter table public.partners
  add column if not exists updated_at timestamptz not null default now();

-- Linhas antigas nascem com now() no default acima; alinhar com created_at
-- evita que todas anunciem a data da migration como "conteúdo novo".
update public.partners set updated_at = created_at where updated_at > created_at;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists partners_set_updated_at on public.partners;

create trigger partners_set_updated_at
  before update on public.partners
  for each row
  execute function public.set_updated_at();
