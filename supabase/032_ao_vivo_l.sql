-- =====================================================================
-- Fora da Caixa — Migração 032: inserção em L (estilo TV)
-- Rode este arquivo no SQL Editor do Supabase (uma vez), antes do deploy.
-- =====================================================================
--
-- No L o vídeo encolhe para o canto e o patrocinador ocupa a coluna da
-- direita e a faixa de baixo. `texto` é a frase principal; `legenda` são as
-- letras miúdas (regulamento, validade, autorização).

alter table public.ao_vivo_cotas drop constraint if exists ao_vivo_cotas_tipo_check;
alter table public.ao_vivo_cotas
  add constraint ao_vivo_cotas_tipo_check check (tipo in ('logo', 'faixa', 'l', 'qr', 'vinheta'));

alter table public.ao_vivo_cotas add column if not exists legenda text;
