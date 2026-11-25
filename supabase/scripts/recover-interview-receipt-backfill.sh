#!/usr/bin/env bash
set -euo pipefail

database_url="${1:?Expected a passwordless migration database URL}"
psql_migration() {
  psql "$database_url" -XqAt --set=ON_ERROR_STOP=1 "$@"
}

# The trigger must already prevent new legacy receipts. Once Supabase records
# the backfill, ordinary deploys can skip this recovery entirely.
pending="$(psql_migration <<'SQL'
SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_history
\gset
\if :has_history
SELECT EXISTS (
  SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261122132752'
) AND NOT EXISTS (
  SELECT 1 FROM supabase_migrations.schema_migrations WHERE version = '20261122132753'
);
\endif
SQL
)"
if [[ "$pending" != t ]]; then
  exit 0
fi

echo "Preparing pending interview receipt backfill migration in batches."
actor_id=''
command_id=''
updated_total=0
while true; do
  # Walk the primary key so each transaction examines at most 500 receipts.
  # A failed batch rolls back independently. Restarting skips compact receipts.
  batch="$(psql_migration --field-separator='|' --set=actor_id="$actor_id" --set=command_id="$command_id" <<'SQL'
SET statement_timeout = '1min';
SET lock_timeout = '5s';

WITH batch AS MATERIALIZED (
  SELECT actor_user_id, command_id
  FROM public.interview_command_receipts
  WHERE :'actor_id' = ''
    OR (actor_user_id, command_id) > (nullif(:'actor_id', '')::uuid, nullif(:'command_id', '')::uuid)
  ORDER BY actor_user_id, command_id
  LIMIT 500
), updated AS (
  UPDATE public.interview_command_receipts AS receipt
  SET command = private.interview_command_payload_hash(receipt.command)
  FROM batch
  WHERE (receipt.actor_user_id, receipt.command_id) = (batch.actor_user_id, batch.command_id)
    AND receipt.command ? 'commandId'
  RETURNING 1
)
SELECT actor_user_id, command_id, (SELECT count(*) FROM updated)
FROM batch
ORDER BY actor_user_id DESC, command_id DESC
LIMIT 1;
SQL
)"
  if [[ -z "$batch" ]]; then
    break
  fi
  IFS='|' read -r actor_id command_id updated_count <<< "$batch"
  updated_total=$((updated_total + updated_count))
done

echo "Prepared ${updated_total} historical interview receipts."
