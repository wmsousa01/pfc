-- =====================================================================
-- PAUTA DE CRIATIVOS: cada criativo da biblioteca aponta para a peça do
-- plano de campanhas que ele cumpre (código de src/lib/campanhas/plano.ts,
-- ex.: C2-E1). Vazio = peça avulsa, fora do plano.
-- =====================================================================

alter table public.mkt_criativos add column if not exists peca text;

create index if not exists mkt_criativos_peca_idx on public.mkt_criativos (peca) where peca is not null and not arquivado;
