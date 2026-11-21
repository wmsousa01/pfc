-- =====================================================================
-- POSICIONAMENTOS DOS CRIATIVOS: onde cada peça aparece (Reels, Stories,
-- Feed, Shorts…). Códigos em src/lib/campanhas/store.ts (POSICIONAMENTOS).
-- O padrão sai do formato (9:16 → Reels/Stories, 4:5 e 16:9 → Feed) e a
-- equipe ajusta na biblioteca de criativos.
--
-- Os vídeos da pasta de campanhas do Drive passaram para o R2, em
-- producao/campanhas/<campanha>/<peça>/ (origem 'upload', ref = caminho).
-- =====================================================================

alter table public.mkt_criativos add column if not exists posicionamentos text[] not null default '{}';
