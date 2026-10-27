"""Run actual inbound HTTP contracts only inside an owned disposable DB lease."""
import os
from pathlib import Path
import subprocess
import owned_database

ROOT = Path(__file__).resolve().parents[1]
owned_database.verify_inner(ROOT, os.environ.get("ALTITUTOR_TEST_DB_MANIFEST"))
subprocess.run([
    "deno", "run", "--config", "supabase/functions/deno.json",
    "--allow-env", "--allow-net", "--allow-read", "scripts/test-imessage-inbound.ts",
], cwd=ROOT, check=True)
