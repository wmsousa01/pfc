-- =====================================================================
-- AGENDA: episódio gravado a partir da central de arquivos (R2)
--
-- Além do link do Drive, o vídeo do episódio gravado (PFC Visita) pode ser
-- um arquivo da central (/admin/arquivos). O hub lê o arquivo do R2 por
-- link assinado, com Range, do mesmo jeito que lia do Drive.
-- =====================================================================

alter table public.agenda_episodios
  add column if not exists video_arquivo_id uuid references public.arquivos(id) on delete set null;
