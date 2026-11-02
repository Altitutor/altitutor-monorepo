"""Two-connection regression; run only through dev:isolated exec on its owned DB."""
import concurrent.futures
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.parse
import uuid


manifest = Path(os.environ['ALTITUTOR_WORKTREE_DEV_MANIFEST']).resolve()
proof = json.loads(manifest.read_text())
assert proof['project_id'].startswith('altitutor-agent-test-')
assert Path(proof['repository']).resolve() == Path.cwd().resolve()
assert Path(proof['workdir']).resolve() == manifest.parent
owned = json.loads((manifest.parent / 'environment.json').read_text())
assert os.environ['DATABASE_URL'] == owned['DATABASE_URL']
url = urllib.parse.urlsplit(os.environ['DATABASE_URL'])
assert url.hostname == '127.0.0.1' and url.port
env = dict(os.environ, PGHOST=url.hostname, PGPORT=str(url.port),
           PGDATABASE=url.path.lstrip('/'), PGUSER=url.username, PGPASSWORD=url.password)


def query(sql):
    return subprocess.run(['psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-c', sql],
                          env=env, capture_output=True, text=True, check=True).stdout.strip()


class Connection:
    def __init__(self, name):
        self.process = subprocess.Popen(['psql', '-XAt'], env=dict(env, PGAPPNAME=name),
                                        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.execute("SET statement_timeout='8s'; SET lock_timeout='6s';")

    def execute(self, sql):
        marker = 'done_' + uuid.uuid4().hex
        self.process.stdin.write(sql + '\n\\echo ' + marker + '\n')
        self.process.stdin.flush()
        lines = []
        for line in self.process.stdout:
            if line.strip() == marker:
                return ''.join(lines)
            lines.append(line)
        raise AssertionError('Database connection ended unexpectedly')

    def close(self):
        self.process.stdin.close()
        self.process.wait(timeout=10)


def check_interleaving(first_absence):
    student, session, participant = (str(uuid.uuid4()) for _ in range(3))
    name = 'retirement_race_' + uuid.uuid4().hex
    query(f"""
      BEGIN;
      SELECT set_config('request.jwt.claims','{{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}}',true);
      INSERT INTO public.students(id,first_name,last_name,status) VALUES('{student}','Synthetic','Race',NULL);
      INSERT INTO public.sessions(id,type,status,start_at,end_at) VALUES('{session}','TRIAL_SESSION','ACTIVE',now()-interval '2 days',now()-interval '2 days'+interval '1 hour');
      INSERT INTO public.sessions_students(id,student_id,session_id,planned_absence) VALUES('{participant}','{student}','{session}',true);
      SELECT public.retire_student('{student}');
      COMMIT;
    """)
    absence = f"UPDATE public.sessions_students SET planned_absence=false WHERE id='{participant}';"
    activate = f"UPDATE public.sessions SET start_at=now()+interval '2 days',end_at=now()+interval '2 days 1 hour' WHERE id='{session}';"
    first, second = Connection(name + '_first'), Connection(name)
    try:
        assert 'ERROR:' not in first.execute('BEGIN; ' + (absence if first_absence else activate))
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            pending = pool.submit(second.execute, 'BEGIN; ' + (activate if first_absence else absence))
            blocked = False
            deadline = time.monotonic() + 3
            while time.monotonic() < deadline and not pending.done():
                blocked = query(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{name}' AND wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0") == '1'
                if blocked:
                    break
                time.sleep(0.03)
            first.execute('COMMIT;')
            result = pending.result(timeout=10)
            second.execute('COMMIT;')
        assert blocked, 'Concurrent transition did not serialize on the Session row'
        assert 'Restore this Student before starting new activity' in result, result
        assert query(f"SELECT count(*) FROM public.sessions_students p JOIN public.sessions s ON s.id=p.session_id JOIN public.students st ON st.id=p.student_id WHERE p.id='{participant}' AND NOT p.planned_absence AND s.status='ACTIVE' AND s.start_at>now() AND st.deleted_at IS NOT NULL") == '0'
    finally:
        first.execute('ROLLBACK;')
        second.execute('ROLLBACK;')
        first.close()
        second.close()
        query(f"DELETE FROM public.sessions_students WHERE id='{participant}'; DELETE FROM public.sessions WHERE id='{session}'; DELETE FROM public.student_deletion_history WHERE student_id='{student}'; DELETE FROM public.students WHERE id='{student}';")


check_interleaving(True)
check_interleaving(False)
print(json.dumps({'ownedDatabase': True, 'absenceFirstSerialized': True, 'sessionFirstSerialized': True}))
