-- =====================================================================
-- AGENDA (3): episódio gravado (PFC Visita) a partir do Google Drive
--
-- O PFC Visita não é ao vivo: o episódio pronto fica numa pasta do Drive.
-- O hub liga o arquivo ao episódio, tira frames dele para a arte, sobe o
-- vídeo para o YouTube em pedaços (direto Drive → YouTube, retomável entre
-- rodadas do cron) agendado para a data do episódio e, depois que ele fica
-- público, manda cortar no Contenta como faz com as lives.
-- =====================================================================

alter table public.agenda_episodios
  add column if not exists video_drive_id  text,          -- id do arquivo no Drive (link público)
  add column if not exists video_nome      text,
  add column if not exists video_tamanho   bigint,
  add column if not exists video_duracao_s int,
  add column if not exists yt_video_id     text,          -- o vídeo enviado (o yt_broadcast_id é só de live)
  add column if not exists yt_status       text not null default 'nenhum'
    check (yt_status in ('nenhum', 'enviando', 'enviado', 'erro')),
  add column if not exists yt_upload       jsonb,         -- { session, offset, total }
  add column if not exists yt_erro         text,
  add column if not exists yt_lock_ate     timestamptz,   -- trava da rodada que está enviando
  add column if not exists cortes_live_id  uuid;          -- linha em producao_lives que acompanha os cortes

create index if not exists agenda_episodios_yt_fila_idx
  on public.agenda_episodios (yt_status);

-- Frames do vídeo viram material da arte.
alter table public.agenda_materiais drop constraint if exists agenda_materiais_tipo_check;
alter table public.agenda_materiais add constraint agenda_materiais_tipo_check
  check (tipo in ('foto', 'apresentador', 'logo', 'referencia', 'frame', 'outro'));

-- Relógio do envio: a cada 5 min, cada rodada empurra uns 4 min de vídeo.
-- Usa o mesmo cron_secret do Vault criado na 014.
select cron.schedule(
  'agenda-video-upload',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://www.pfctv.com.br/api/cron/agenda-video',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);
