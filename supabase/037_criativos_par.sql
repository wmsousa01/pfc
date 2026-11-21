-- =====================================================================
-- PAR DE FORMATOS: o mesmo conteúdo em vertical e horizontal vira UM
-- anúncio na Meta, cada versão no seu posicionamento (vertical em
-- Reels/Stories, horizontal no Feed), com asset_feed_spec.
--   mkt_criativos.par_id        a outra versão (ligação nos dois sentidos)
--   mkt_entregas.meta_video_id_par  o vídeo do par já enviado à Meta
-- =====================================================================

alter table public.mkt_criativos add column if not exists par_id uuid references public.mkt_criativos (id) on delete set null;
alter table public.mkt_entregas  add column if not exists meta_video_id_par text;

-- Pares dos vídeos que vieram do Drive (mesmo caminho, -16x9 ↔ -9x16).
update public.mkt_criativos a
set par_id = b.id
from public.mkt_criativos b
where a.par_id is null
  and a.origem = 'upload' and b.origem = 'upload'
  and a.ref like 'campanhas/%-16x9.mp4'
  and b.ref = replace(a.ref, '-16x9.mp4', '-9x16.mp4');

update public.mkt_criativos b
set par_id = a.id
from public.mkt_criativos a
where b.par_id is null and a.par_id = b.id;
