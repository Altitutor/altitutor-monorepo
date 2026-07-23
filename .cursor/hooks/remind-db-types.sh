#!/usr/bin/env bash
# Remind agent to regenerate DB types after editing migration SQL.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("file_path",""))')

case "$file_path" in
  */supabase/migrations/*.sql)
    python3 -c 'import json; print(json.dumps({
      "additional_context": "Migration SQL edited. After local verification (`supabase db reset` if needed), run `pnpm db:types`. Do not apply this migration to remote/dev/prod unless the user explicitly asked — CI/CD only by default."
    }))'
    ;;
  *)
    echo '{}'
    ;;
esac
