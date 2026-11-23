-- 039: acesso por papéis (vários por pessoa) e permissões finas.
--
-- Admin continua sendo quem está em app_admins (acesso total). O resto da
-- equipe recebe um ou mais papéis; o acesso é a SOMA das permissões de todos
-- eles, mais as permissões avulsas da própria pessoa.
--
-- Permissão = "<área>.<ação>": "agenda.ver", "agenda.editar", "campanhas.publicar".
-- Quem tem "x.editar" também passa em "x.ver".
--
-- A tabela equipe veio da 029 do PR #50 (papel único + lista de áreas), que
-- nunca recebeu ninguém (0 linhas em 23/11/2026). Aqui ela troca de forma.

create table if not exists public.equipe (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  email       text not null,
  ativo       boolean not null default true,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.equipe drop column if exists papel;
alter table public.equipe drop column if exists areas;
alter table public.equipe add column if not exists permissoes_extras text[] not null default '{}';
-- Login do apresentador: liga a conta ao cadastro feito pelo link /apresentador.
alter table public.equipe add column if not exists apresentador_id uuid
  references public.apresentadores_cadastros(id) on delete set null;

alter table public.equipe enable row level security;

create table if not exists public.papeis (
  chave       text primary key check (chave ~ '^[a-z0-9_]{2,40}$'),
  nome        text not null,
  descricao   text not null default '',
  permissoes  text[] not null default '{}',
  ordem       int not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.papeis enable row level security;

create table if not exists public.equipe_papeis (
  user_id  uuid not null references public.equipe(user_id) on delete cascade,
  papel    text not null references public.papeis(chave) on delete cascade on update cascade,
  primary key (user_id, papel)
);

create index if not exists equipe_papeis_papel_idx on public.equipe_papeis (papel);
alter table public.equipe_papeis enable row level security;

-- Nenhuma das três tem policy: o app lê com service-role, e o navegador só
-- enxerga o resultado pelas funções abaixo.

-- Papéis de partida. Dá para editar e criar outros em /admin/equipe.
insert into public.papeis (chave, nome, descricao, permissoes, ordem) values
  ('coordenacao', 'Coordenação de conteúdo', 'Toca a grade: agenda, apresentadores, produção, ao vivo e arquivos.',
    array['pendencias.ver','agenda.editar','apresentadores.editar','arquivos.editar','producao.editar','ao_vivo.editar','marketing.ver','fotos.editar'], 10),
  ('editor', 'Editor de vídeo', 'Envia e organiza os arquivos editados; vê a agenda e a produção.',
    array['arquivos.editar','agenda.ver','producao.ver'], 20),
  ('apresentador', 'Apresentador', 'Vê os próprios quadros e episódios e chega ao link pessoal de materiais e termo.',
    array['meus_quadros.ver'], 30),
  ('ao_vivo', 'Operador ao vivo', 'Opera a transmissão: inserções, régie e espelho; vê a agenda.',
    array['ao_vivo.editar','agenda.ver'], 40),
  ('social_media', 'Social media', 'Publicação orgânica, fotos e posts, arquivos.',
    array['pendencias.ver','marketing.editar','fotos.editar','arquivos.editar','agenda.ver'], 50),
  ('trafego', 'Tráfego pago', 'Campanhas e criativos, inclusive subir anúncio na Meta.',
    array['campanhas.editar','campanhas.publicar','arquivos.ver','marketing.ver'], 60),
  ('comercial', 'Comercial', 'Parceiros, propostas, entregas e revendedores; vê pedidos e produtos.',
    array['parceiros.editar','entregas.editar','revendedores.editar','pedidos.ver','produtos.ver'], 70),
  ('financeiro', 'Financeiro', 'Pedidos e produtos; vê parceiros e revendedores.',
    array['pedidos.editar','produtos.editar','parceiros.ver','revendedores.ver','entregas.ver'], 80),
  ('designer', 'Designer / fotógrafo', 'Fotos, artes e arquivos; vê agenda e campanhas.',
    array['fotos.editar','arquivos.editar','agenda.ver','campanhas.ver'], 90)
on conflict (chave) do nothing;

-- Permissões de quem está logado (vazio para quem não é da equipe ou está inativo).
-- Sem parâmetro de usuário de propósito: ninguém consulta as permissões dos outros.
create or replace function public.minhas_permissoes()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct p), '{}')
  from (
    select unnest(e.permissoes_extras) as p
      from public.equipe e
     where e.user_id = auth.uid() and e.ativo
    union
    select unnest(pa.permissoes)
      from public.equipe e
      join public.equipe_papeis ep on ep.user_id = e.user_id
      join public.papeis pa on pa.chave = ep.papel
     where e.user_id = auth.uid() and e.ativo
  ) x;
$$;

create or replace function public.tem_permissao(p text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or exists (
    select 1 from unnest(public.minhas_permissoes()) q
     where q = p
        or (p like '%.ver' and q = left(p, length(p) - 4) || '.editar')
  );
$$;

create or replace function public.tem_alguma_permissao(ps text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from unnest(ps) p where public.tem_permissao(p));
$$;

-- Tudo o que o servidor precisa saber numa ida só.
create or replace function public.meu_acesso()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'admin', public.is_admin(),
    'membro', e.user_id is not null,
    'nome', e.nome,
    'apresentador_id', e.apresentador_id,
    'permissoes', to_jsonb(public.minhas_permissoes())
  )
  from (select 1) um
  left join public.equipe e on e.user_id = auth.uid() and e.ativo;
$$;

revoke all on function public.minhas_permissoes() from public, anon;
revoke all on function public.tem_permissao(text) from public, anon;
revoke all on function public.tem_alguma_permissao(text[]) from public, anon;
revoke all on function public.meu_acesso() from public, anon;
grant execute on function public.minhas_permissoes() to authenticated;
grant execute on function public.tem_permissao(text) to authenticated;
grant execute on function public.tem_alguma_permissao(text[]) to authenticated;
grant execute on function public.meu_acesso() to authenticated;

-- ---------------------------------------------------------------------------
-- Comercial: as telas leem pela sessão (RLS). Troca is_admin() por permissão.
-- Leitura aceita mais de uma área quando a tela de uma mostra dados da outra
-- (ex.: Pedidos lista revendedores e produtos). As policies públicas e as do
-- próprio revendedor continuam como estão.
-- ---------------------------------------------------------------------------

-- Parceiros
drop policy if exists "partners admin all" on public.partners;
create policy "partners equipe leitura" on public.partners for select to authenticated
  using ((select public.tem_alguma_permissao(array['parceiros.ver','entregas.ver','pedidos.ver'])));
create policy "partners equipe escrita" on public.partners for all to authenticated
  using ((select public.tem_permissao('parceiros.editar'))) with check ((select public.tem_permissao('parceiros.editar')));

drop policy if exists "partner_panels admin all" on public.partner_panels;
create policy "partner_panels equipe leitura" on public.partner_panels for select to authenticated
  using ((select public.tem_permissao('parceiros.ver')));
create policy "partner_panels equipe escrita" on public.partner_panels for all to authenticated
  using ((select public.tem_permissao('parceiros.editar'))) with check ((select public.tem_permissao('parceiros.editar')));

drop policy if exists "partner_leads admin all" on public.partner_leads;
create policy "partner_leads equipe leitura" on public.partner_leads for select to authenticated
  using ((select public.tem_permissao('parceiros.ver')));
create policy "partner_leads equipe escrita" on public.partner_leads for all to authenticated
  using ((select public.tem_permissao('parceiros.editar'))) with check ((select public.tem_permissao('parceiros.editar')));

drop policy if exists "clicks admin read" on public.partner_clicks;
create policy "partner_clicks equipe leitura" on public.partner_clicks for select to authenticated
  using ((select public.tem_permissao('parceiros.ver')));

drop policy if exists "partner_terms_acceptances admin read" on public.partner_terms_acceptances;
create policy "partner_terms_acceptances equipe leitura" on public.partner_terms_acceptances for select to authenticated
  using ((select public.tem_alguma_permissao(array['parceiros.ver','entregas.ver'])));

drop policy if exists "leads admin all" on public.leads;
create policy "leads equipe leitura" on public.leads for select to authenticated
  using ((select public.tem_permissao('parceiros.ver')));
create policy "leads equipe escrita" on public.leads for all to authenticated
  using ((select public.tem_permissao('parceiros.editar'))) with check ((select public.tem_permissao('parceiros.editar')));

drop policy if exists "ig admin all" on public.ig_highlights;
create policy "ig_highlights equipe leitura" on public.ig_highlights for select to authenticated
  using ((select public.tem_permissao('parceiros.ver')));
create policy "ig_highlights equipe escrita" on public.ig_highlights for all to authenticated
  using ((select public.tem_permissao('parceiros.editar'))) with check ((select public.tem_permissao('parceiros.editar')));

drop policy if exists "client_files admin read" on public.client_files;
create policy "client_files equipe leitura" on public.client_files for select to authenticated
  using ((select public.tem_alguma_permissao(array['entregas.ver','parceiros.ver'])));

-- Pedidos
drop policy if exists "orders admin all" on public.orders;
create policy "orders equipe leitura" on public.orders for select to authenticated
  using ((select public.tem_alguma_permissao(array['pedidos.ver','revendedores.ver'])));
create policy "orders equipe escrita" on public.orders for all to authenticated
  using ((select public.tem_permissao('pedidos.editar'))) with check ((select public.tem_permissao('pedidos.editar')));

drop policy if exists "order_items admin all" on public.order_items;
create policy "order_items equipe leitura" on public.order_items for select to authenticated
  using ((select public.tem_alguma_permissao(array['pedidos.ver','revendedores.ver'])));
create policy "order_items equipe escrita" on public.order_items for all to authenticated
  using ((select public.tem_permissao('pedidos.editar'))) with check ((select public.tem_permissao('pedidos.editar')));

-- Produtos
drop policy if exists "products admin all" on public.products;
create policy "products equipe leitura" on public.products for select to authenticated
  using ((select public.tem_alguma_permissao(array['produtos.ver','pedidos.ver'])));
create policy "products equipe escrita" on public.products for all to authenticated
  using ((select public.tem_permissao('produtos.editar'))) with check ((select public.tem_permissao('produtos.editar')));

-- Revendedores
drop policy if exists "resellers admin all" on public.resellers;
create policy "resellers equipe leitura" on public.resellers for select to authenticated
  using ((select public.tem_alguma_permissao(array['revendedores.ver','pedidos.ver'])));
create policy "resellers equipe escrita" on public.resellers for all to authenticated
  using ((select public.tem_permissao('revendedores.editar'))) with check ((select public.tem_permissao('revendedores.editar')));

drop policy if exists "indicacoes admin all" on public.indicacoes;
create policy "indicacoes equipe leitura" on public.indicacoes for select to authenticated
  using ((select public.tem_permissao('revendedores.ver')));
create policy "indicacoes equipe escrita" on public.indicacoes for all to authenticated
  using ((select public.tem_permissao('revendedores.editar'))) with check ((select public.tem_permissao('revendedores.editar')));
