-- =====================================================================
-- Fora da Caixa — Migração 029: indicação de patrocínio pelos parceiros
-- Rode este arquivo no SQL Editor do Supabase (uma vez).
--
-- Até aqui o programa de parceiros só conhecia pedido de produto. Agora o
-- parceiro (influencer, apresentador) registra quem indicou para patrocínio,
-- acompanha o andamento no painel e vê a comissão quando o contrato fecha.
-- Regras em docs/estrategia-revendedores-parceiros.md e
-- docs/campanha-fim-de-ano-2026.md.
-- =====================================================================

-- Apresentador de quadro: ganha bônus ao trazer patrocínio para o próprio
-- quadro e desconto ao patrocinar com a empresa dele.
alter table public.resellers add column if not exists apresentador boolean not null default false;
-- Slug do quadro que apresenta (o mesmo de src/lib/config.ts). Null = nenhum.
alter table public.resellers add column if not exists quadro text;

-- Lead que chegou pelo link do parceiro (/r/{slug}?ir=plano).
alter table public.leads add column if not exists reseller_id uuid references public.resellers (id) on delete set null;
create index if not exists leads_reseller_idx on public.leads (reseller_id);

create table if not exists public.indicacoes (
  id               uuid primary key default gen_random_uuid(),
  reseller_id      uuid not null references public.resellers (id) on delete cascade,
  lead_id          uuid references public.leads (id) on delete set null,
  empresa          text not null,
  contato          text,
  -- Só nas indicações registradas pelo parceiro (ele mesmo informou).
  -- Nas que vieram pelo link, o contato fica no lead e o parceiro não vê.
  whatsapp         text,
  interesse        text,
  -- Slug do quadro da cota (para o bônus de apresentador). Null = plano do canal.
  quadro           text,
  -- indicou = passou o contato · vendeu = esteve na reunião e o cliente assinou
  -- patrocina = o próprio apresentador patrocinando (sem comissão, com desconto)
  papel            text not null default 'indicou' check (papel in ('indicou', 'vendeu', 'patrocina')),
  origem           text not null default 'registro' check (origem in ('registro', 'link')),
  status           text not null default 'registrada'
                   check (status in ('registrada', 'aprovada', 'reuniao', 'fechada', 'perdida', 'rejeitada')),
  ciclo            text check (ciclo in ('mensal', 'anual')),
  -- Mensalidade do contrato fechado, em centavos (anual: o equivalente mensal).
  mensal_cents     int check (mensal_cents >= 0),
  -- Congelada ao fechar; mudar a regra depois não altera o que já fechou.
  comissao_cents   int check (comissao_cents >= 0),
  campanha         text,
  protegida_ate    timestamptz,
  fechada_em       timestamptz,
  parcela1_paga_em timestamptz,
  parcela2_paga_em timestamptz,
  observacao       text,
  -- Resposta do admin, visível para o parceiro (motivo de rejeição, próximo passo).
  retorno          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists indicacoes_reseller_idx on public.indicacoes (reseller_id, created_at desc);

alter table public.indicacoes enable row level security;

drop policy if exists "indicacoes admin all" on public.indicacoes;
create policy "indicacoes admin all"
  on public.indicacoes for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- O parceiro só lê as próprias. Registrar passa pela server action (service
-- role), que confere a sessão e preenche reseller_id, status e protegida_ate.
drop policy if exists "indicacoes reseller read own" on public.indicacoes;
create policy "indicacoes reseller read own"
  on public.indicacoes for select
  to authenticated
  using (reseller_id = public.current_reseller_id());
