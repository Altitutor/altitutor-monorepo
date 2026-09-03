#!/usr/bin/env bash
# Apply the UCAT study-plan golden fixtures that are excluded from automatic
# seed. Required for database contracts and UCAT browser journeys.
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

if ! supabase status >/dev/null 2>&1; then
  echo "Local Supabase is not running. Start it with: supabase start" >&2
  exit 1
fi

db_container="$(docker ps --format '{{.Names}}' | grep -E '^supabase_db_' | head -n 1 || true)"
if [ -z "$db_container" ]; then
  echo "Could not find the local Supabase Postgres container." >&2
  exit 1
fi

shopt -s nullglob
files=("$root"/supabase/seed/test-ucat/*.sql)
if [ "${#files[@]}" -eq 0 ]; then
  echo "No UCAT test seed files found in supabase/seed/test-ucat" >&2
  exit 1
fi

for file in "${files[@]}"; do
  echo "Applying ${file#"$root/"}..."
  docker exec -i "$db_container" \
    psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
    < "$file"
done
