#!/usr/bin/env bash
# Gate shell commands that mutate remote Supabase / linked projects.
set -euo pipefail

input=$(cat)
command=$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("command",""))')

python3 - "$command" <<'PY'
import json, re, sys

command = sys.argv[1]
patterns = [
    r"supabase\s+db\s+push",
    r"supabase\s+db\s+reset\s+--linked",
    r"supabase\s+migration\s+up\b.*--linked",
    r"supabase\s+functions\s+deploy",
    r"supabase\s+db\s+execute\b",
    r"supabase\s+sql\b",
]

blocked = any(re.search(p, command, re.I) for p in patterns)
# allow local-only reset without --linked
if re.search(r"supabase\s+db\s+reset(?!\s+--linked)", command, re.I):
    blocked = False

if blocked:
    print(json.dumps({
        "permission": "ask",
        "user_message": "This command may mutate a remote/linked Supabase project. Approve only if you explicitly want that.",
        "agent_message": "Remote DB / linked Supabase mutation requires explicit user approval. Prefer CI/CD for migrations and function deploys. Do not proceed unless the user asked for a remote change.",
    }))
else:
    print(json.dumps({"permission": "allow"}))
PY
