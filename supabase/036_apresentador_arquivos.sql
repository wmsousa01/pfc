-- Arquivos grandes do apresentador: cada cadastro ganha uma pasta na central
-- de arquivos (Arquivos › Apresentadores › <nome>), criada no primeiro envio.
alter table public.apresentadores_cadastros
  add column if not exists pasta_id uuid references public.arquivos_pastas (id) on delete set null;

insert into public.arquivos_pastas (nome, created_by)
select 'Apresentadores', 'sistema'
where not exists (select 1 from public.arquivos_pastas p where p.parent_id is null and p.nome = 'Apresentadores');
