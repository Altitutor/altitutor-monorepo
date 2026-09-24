\set ON_ERROR_STOP on

-- Keep the database cron and Edge Function on the same least-privilege shared
-- secret. The value is supplied by CI as a psql variable and is never stored in
-- the repository or printed by this script.
SELECT vault.update_secret(
  secret.id,
  :'dispatch_secret',
  'ucat_email_dispatch_secret',
  'Shared authentication for the UCAT transactional email dispatcher'
)
FROM vault.secrets AS secret
WHERE secret.name = 'ucat_email_dispatch_secret';

SELECT vault.create_secret(
  :'dispatch_secret',
  'ucat_email_dispatch_secret',
  'Shared authentication for the UCAT transactional email dispatcher'
)
WHERE NOT EXISTS (
  SELECT 1
  FROM vault.secrets AS secret
  WHERE secret.name = 'ucat_email_dispatch_secret'
);
