#!/usr/bin/env bash
# Exact owned container only; never select the first database on this host.
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
exec python3 scripts/owned_database.py seed
