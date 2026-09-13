create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Supabase Dashboard Vault에 app_base_url과 cron_secret을 먼저 등록해요.
select cron.schedule(
  'tournament-poller',
  '0 */6 * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_base_url')
           || '/api/cron/tournament-poller',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 60000
  );
  $$
);
