-- =====================================================================
-- 028 — Corte automático das lives guiado pela agenda
--
-- Antes, o cron diário da Vercel (23h, seg–sex) procurava lives encerradas
-- todo dia, houvesse transmissão ou não. Agora /api/cron/cortes roda a cada
-- 15 min e só consulta o YouTube e o Contenta depois do fim previsto de um
-- episódio ao vivo de agenda_episodios que ainda não foi cortado (até 24 h
-- depois). Nos outros horários a rota sai sem fazer nada.
-- Usa o mesmo cron_secret do Vault criado na 014.
-- =====================================================================

select cron.schedule(
  'producao-cortes-agenda',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://www.pfctv.com.br/api/cron/cortes',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 120000
  );
  $$
);
