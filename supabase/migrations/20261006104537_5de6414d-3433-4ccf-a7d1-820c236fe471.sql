-- retention-1006: pg_cron schedules (parent go 2026-10-06). SHADOW while the DB modes are shadow and SEND_ENABLED=false: runs only write would_send/skipped rows.
-- send-reminders hourly at :05; autopay-notice daily at 16:10 UTC (11:10 AM CDT / 10:10 AM CST). The SQL re-checks the 10:00-18:59 CT window.
-- Auth: Bearer = existing Vault anon key (cashapp_sweep_anon_key, same as the Cash App sweep) + x-cron-token (Vault retention_email_cron_token).
SELECT cron.schedule('retention-send-reminders', '5 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cashapp_sweep_anon_key'),
      'x-cron-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'retention_email_cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
$job$);
SELECT cron.schedule('retention-autopay-notice', '10 16 * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/autopay-notice',
    headers := jsonb_build_object('Content-Type','application/json',
      'Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cashapp_sweep_anon_key'),
      'x-cron-token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'retention_email_cron_token')),
    body := '{}'::jsonb, timeout_milliseconds := 55000);
$job$);