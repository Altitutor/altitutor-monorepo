#!/usr/bin/env bash
# Gate MCP tools that apply migrations or write to remote DBs.
set -euo pipefail

input=$(cat)

printf '%s' "$input" | python3 -c '
import json, sys

payload = json.load(sys.stdin)
tool = (payload.get("tool_name") or "").lower()
raw_input = payload.get("tool_input") or {}
if isinstance(raw_input, str):
    try:
        tool_input = json.loads(raw_input) if raw_input.strip() else {}
    except json.JSONDecodeError:
        tool_input = {"_raw": raw_input}
else:
    tool_input = raw_input

dangerous_tools = {
    "apply_migration",
    "deploy_edge_function",
}

mutating_sql = False
if tool == "execute_sql":
    query = str(tool_input.get("query") or tool_input.get("sql") or "").lower()
    mutating_sql = any(
        kw in query
        for kw in (
            "insert ", "update ", "delete ", "drop ", "alter ", "create ",
            "truncate ", "grant ", "revoke ", "vacuum ", "refresh ",
        )
    )

if tool in dangerous_tools or mutating_sql:
    print(json.dumps({
        "permission": "ask",
        "user_message": f"MCP `{tool}` may change a remote database. Approve only if you explicitly requested a remote change.",
        "agent_message": (
            "Remote Supabase MCP write blocked pending approval. "
            "By default migrations/functions go through CI/CD. "
            "Only continue if the user explicitly instructed a remote DB change."
        ),
    }))
else:
    print(json.dumps({"permission": "allow"}))
'
