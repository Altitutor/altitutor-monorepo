"""Run registration route contracts against an owned disposable Auth/database."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import owned_database as owned  # noqa: E402


def run_tests(environment):
    subprocess.run(
        ["node", "apps/student-web/node_modules/jest/bin/jest.js", "--config",
         "apps/student-web/jest.config.js", "--runInBand", "--runTestsByPath",
         "apps/student-web/src/app/api/register/complete/route.integration.test.ts"],
        cwd=ROOT, env=dict(environment, ALTITUTOR_REGISTRATION_DB_TEST="1"), check=True,
    )


def main():
    if os.environ.get("ALTITUTOR_OWNED_DB_INNER") == "1":
        owned.verify_inner(ROOT, os.environ.get("ALTITUTOR_TEST_DB_MANIFEST"))
        run_tests(os.environ)
    elif owned.ci_owned(ROOT):
        _, project, _, port = owned.configuration(ROOT)
        with owned.exclusive(Path(tempfile.gettempdir()) / ("altitutor-ci-" + project + ".lock")):
            owned.container(ROOT, project, ci=True)
            result = subprocess.run(
                ["supabase", "status", "-o", "env"], cwd=ROOT,
                env=owned.supabase_environment(), capture_output=True, text=True, check=True,
            )
            values = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
            values = {key.strip(): value.strip().strip('"') for key, value in values.items()}
            url = values.get("API_URL", "")
            parsed = urlparse(url)
            if (parsed.scheme != "http" or parsed.hostname not in {"127.0.0.1", "localhost", "::1"}
                    or str(parsed.port) != port or parsed.username or parsed.password
                    or parsed.query or parsed.fragment):
                raise owned.Blocked("Registration tests require the verified local API")
            public_key = values.get("ANON_KEY") or values.get("PUBLISHABLE_KEY")
            service_key = values.get("SERVICE_ROLE_KEY") or values.get("SECRET_KEY")
            if not public_key or not service_key:
                raise owned.Blocked("Registration tests require local test keys")
            environment = owned.clean_environment()
            owned.bind_database_environment(environment, url, public_key, service_key)
            run_tests(environment)
    else:
        subprocess.run(
            [sys.executable, str(ROOT / "scripts/owned_database.py"), "run", "--",
             sys.executable, str(Path(__file__).resolve())], cwd=ROOT, check=True,
        )


if __name__ == "__main__":
    main()
