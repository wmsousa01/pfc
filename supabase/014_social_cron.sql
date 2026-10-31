-- =====================================================================
-- MARKETING: relógio da fila de publicação (a cada 5 min)
--
-- O Vercel Cron no plano Hobby só roda uma vez por dia, e post agendado
-- precisa sair na hora. O pg_cron do Supabase chama /api/cron/social com o
-- mesmo CRON_SECRET da Vercel, guardado no Vault.
--
-- Antes de rodar: troque COLE_O_CRON_SECRET pelo valor de CRON_SECRET.
-- Rodar de novo é seguro (o schedule com o mesmo nome é substituído).
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret('COLE_O_CRON_SECRET', 'cron_secret');
  end if;
end $$;

select cron.schedule(
  'social-publish',
  '*/5 * * * *',
  $$
  select net.http_get(
    url := 'https://www.pfctv.com.br/api/cron/social',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);
