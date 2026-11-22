"""Exercise both heartbeat/deletion orderings through the real round command.

Run only inside dev:isolated exec. The owned runtime supplies and verifies the
local target; fixture records are disposable with that runtime.
"""
import json
import os
from pathlib import Path
import subprocess
import uuid
from urllib.parse import unquote, urlparse

url = urlparse(os.environ['DATABASE_URL'])
if url.hostname not in ('127.0.0.1', 'localhost') or not os.environ.get('ALTITUTOR_WORKTREE_DEV_MANIFEST'):
    raise SystemExit('This probe requires the verified owned local development runtime')
environment = dict(os.environ, PGHOST=url.hostname, PGPORT=str(url.port),
                   PGUSER=unquote(url.username), PGPASSWORD=unquote(url.password), PGDATABASE=url.path.lstrip('/'),
                   PGOPTIONS='-c statement_timeout=10000')
psql = ['psql', '-X', '-At', '-v', 'ON_ERROR_STOP=1']
actor = '00000000-0000-0000-0000-000000000010'
claims = "SELECT set_config('request.jwt.claims','" + json.dumps({'sub': actor, 'role': 'authenticated'}) + "',false);"


def run(sql, timeout=15):
    return subprocess.run(psql, input=sql, env=environment, text=True, capture_output=True, timeout=timeout)


def command(round_id, kind):
    if kind == 'assessmentLock':
        return "SELECT id FROM public.interview_rounds WHERE id='" + round_id + "' FOR NO KEY UPDATE;"
    body = {'type': 'heartbeat' if kind == 'adminHeartbeat' else kind, 'roundId': round_id, 'commandId': str(uuid.uuid4())}
    if kind == 'deleteRound':
        preview = run(claims + "SELECT jsonb_build_object('expectedVersion',data->'version','expectedAttemptVersions',"
                      "(SELECT jsonb_agg(jsonb_build_object('id',a->'id','version',a->'version')) "
                      "FROM jsonb_array_elements(data->'attempts') a)) "
                      "FROM public.vtutor_interview_rounds WHERE id='" + round_id + "';")
        if preview.returncode:
            raise AssertionError(preview.stderr)
        body.update(json.loads(preview.stdout.splitlines()[-1]))
    caller = "(SELECT user_id FROM public.staff WHERE role='ADMINSTAFF' AND status='ACTIVE' LIMIT 1)" if kind == 'adminHeartbeat' else "'" + actor + "'"
    return "SELECT public.interview_command(" + caller + ",$request$" + json.dumps(body) + "$request$::jsonb);"


# The same command-created fixture used by the SQL boundary tests, committed
# here because the two competing clients must both see it.
source = Path(__file__).with_name('interview_round_deletion_test.sql').read_text()
prefix = source.split("SELECT pg_temp.create_round('e4940000-0000-4000-8000-000000000010');")[0]
fixture_prefix = 'e494' + uuid.uuid4().hex[:4]
prefix = prefix.replace('e4940000', fixture_prefix)
rounds = [fixture_prefix + '-0000-4000-8000-' + str(20 + index).zfill(12) for index in range(5)]
setup = run(prefix + ''.join("SELECT pg_temp.create_round('" + target + "');" for target in rounds) + 'COMMIT;')
if setup.returncode:
    raise AssertionError(setup.stderr)


def ordering(round_id, first_kind, second_kind, expected_error):
    # Capture the deletion preview before either client takes a lock.
    first_command = command(round_id, first_kind)
    second_command = command(round_id, second_kind)
    first = subprocess.Popen(psql, env=environment, text=True, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        first.stdin.write(claims + 'BEGIN;' + first_command + "SELECT 'lock-held';SELECT pg_sleep(2);COMMIT;\n")
        first.stdin.close()
        while first.stdout.readline().strip() != 'lock-held':
            if first.poll() is not None:
                raise AssertionError('First command failed: ' + first.stderr.read())
        second = run(claims + second_command, timeout=1 if expected_error is None else 15)
        first.wait(timeout=10)
        if first.returncode:
            raise AssertionError(first.stderr.read())
        if expected_error is None:
            assert second.returncode == 0, second.stderr
        else:
            assert second.returncode != 0 and expected_error in second.stderr, second.stdout + second.stderr
        print(first_kind + ' before ' + second_kind + ': passed')
    finally:
        if first.poll() is None:
            first.terminate()
            first.wait(timeout=5)


ordering(rounds[0], 'heartbeat', 'deleteRound', 'Someone is still in this interview')
ordering(rounds[1], 'deleteRound', 'heartbeat', 'Round not found')
ordering(rounds[2], 'adminHeartbeat', 'deleteRound', 'Someone is still in this interview')
ordering(rounds[3], 'deleteRound', 'adminHeartbeat', 'Round not found')
ordering(rounds[4], 'assessmentLock', 'heartbeat', None)
