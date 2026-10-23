"""CLI lifecycle contracts with real processes/ports and fixture Docker/CLI adapters."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import sys
import time
import unittest
from unittest.mock import patch

import worktree_dev

spec = importlib.util.spec_from_file_location('owned_tests', Path(__file__).with_name('owned_database.test.py'))
owned_tests = importlib.util.module_from_spec(spec)
spec.loader.exec_module(owned_tests)

APP = r"""
if name=='pnpm' and '--port' in args:
 from http.server import BaseHTTPRequestHandler, HTTPServer
 port=int(args[args.index('--port')+1]);app=args[args.index('--dir')+1].split('/')[-1]
 base=state.parent
 if (base/'fail-app').exists():sys.exit(8)
 (base/(app+'.env.json')).write_text(json.dumps(dict(os.environ)))
 class Handler(BaseHTTPRequestHandler):
  def do_GET(self):
   self.send_response(200);self.end_headers();self.wfile.write(b'isolated app')
  def log_message(self,*args):pass
 HTTPServer(('127.0.0.1',port),Handler).serve_forever()
"""


class WorktreeDevelopmentTests(unittest.TestCase):
    def test_process_receipts_are_independent_of_caller_timezone(self):
        for identity in (worktree_dev.process_identity, worktree_dev.group_identity):
            with self.subTest(identity=identity.__name__):
                with patch.dict(os.environ, TZ='UTC', LC_ALL='C'):
                    original = identity(os.getpid())
                with patch.dict(os.environ, TZ='Australia/Adelaide', LC_ALL='C'):
                    self.assertEqual(identity(os.getpid()), original)

    def setUp(self):
        self.fixture = owned_tests.OwnedDatabaseTests()
        self.fixture.setUp()
        self.addCleanup(self.fixture.tearDown)
        self.repo = self.fixture.repo
        self.script = self.repo / 'scripts/worktree_dev.py'
        shutil.copy2(Path(__file__).with_name('worktree_dev.py'), self.script)
        (self.repo / 'node_modules').mkdir()
        (self.repo / 'node_modules/.modules.yaml').write_text('fixture')
        for app in ['admin-web', 'ucat-web', 'ucat-app']:
            directory = self.repo / 'apps' / app
            directory.mkdir(parents=True)
            (directory / '.env.local').write_text('NEXT_PUBLIC_SUPABASE_URL=https://remote.invalid\nSTRIPE_SECRET_KEY=must-be-blank\n')
        # Fake command adapters know their fixture paths without inheriting
        # deployment or test-specific environment variables into app processes.
        defaults = ('import os\nos.environ.setdefault("FIXTURE_STATE", ' + repr(str(self.fixture.state)) + ')\n'
                    'os.environ.setdefault("FIXTURE_LOG", ' + repr(str(self.fixture.log)) + ')\n')
        for name in ['docker', 'supabase', 'pnpm', 'git']:
            target = self.fixture.bin / name
            fake = owned_tests.FAKE.replace("elif name=='pnpm' and 'next' in args:", 'elif False:')
            target.write_text('#!' + sys.executable + '\n' + defaults + fake + APP)
            target.chmod(0o700)
        (self.repo / 'node_modules/.bin').mkdir()
        (self.repo / 'node_modules/.bin/supabase').symlink_to(self.fixture.bin / 'supabase')
        self.environment = dict(self.fixture.env, STRIPE_SECRET_KEY='inherited-must-be-removed')
        self.processes = []
        self.addCleanup(self.cleanup_processes)

    def command(self, *args):
        return [sys.executable, str(self.script), '--repository', str(self.repo), *args]

    def call(self, *args):
        return subprocess.run(self.command(*args), env=self.environment, capture_output=True, text=True, timeout=15)

    def start(self, *args):
        process = subprocess.Popen(self.command(*args), env=self.environment,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.processes.append(process)
        return process

    def wait_ready(self, process):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if process.poll() is not None:
                output, error = process.communicate()
                self.fail('Startup exited: ' + output + error)
            result = self.call('status')
            if result.returncode == 0:
                data = json.loads(result.stdout)
                if data['phase'] == 'ready':
                    return data
            time.sleep(.1)
        self.fail('Environment never became ready')

    def cleanup_processes(self):
        for process in self.processes:
            if process.poll() is None:
                process.send_signal(signal.SIGTERM)
            try:
                process.communicate(timeout=12)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate()
        # Normal stop can also safely recover a killed supervisor fixture.
        self.call('stop')

    def test_selected_apps_share_only_their_own_database_and_cleanup(self):
        process = self.start('--apps', 'admin-web,ucat-web')
        data = self.wait_ready(process)
        self.assertNotEqual(data['apps']['admin-web'], data['apps']['ucat-web'])
        environment = json.loads((self.fixture.base / 'admin-web.env.json').read_text())
        self.assertEqual(environment['NEXT_PUBLIC_SUPABASE_URL'], data['api_url'])
        self.assertEqual(environment['STRIPE_SECRET_KEY'], '')
        self.assertEqual(environment['NEXT_PUBLIC_UCAT_URL'], data['apps']['ucat-web'])
        self.assertEqual(environment['UCAT_APP_ORIGIN'], data['apps']['ucat-web'])
        self.assertEqual(environment['NEXT_PUBLIC_AUTH_COOKIE_NAME'], data['project_id'] + '-admin-web')
        self.assertEqual(environment['SENTRY_DISABLED'], 'true')
        result = self.call('exec', '--', sys.executable, '-c',
                           'import os;print(os.environ["NEXT_PUBLIC_SUPABASE_URL"])')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), data['api_url'])
        self.assertNotIn('SERVICE_ROLE_KEY', self.call('status').stdout)
        stopped = self.call('stop')
        self.assertEqual(stopped.returncode, 0, stopped.stderr)
        process.communicate(timeout=12)
        self.assertTrue(json.loads(self.fixture.state.read_text())['stopped'])
        self.assertEqual(json.loads(self.call('status').stdout)['phase'], 'stopped')
        self.assertFalse(Path(data['runtime']).exists())

    def test_native_app_includes_its_backend_and_gets_matching_url(self):
        process = self.start('--apps', 'ucat-app')
        data = self.wait_ready(process)
        self.assertEqual(set(data['apps']), {'ucat-app', 'ucat-web'})
        environment = json.loads((self.fixture.base / 'ucat-app.env.json').read_text())
        self.assertEqual(environment['EXPO_PUBLIC_UCAT_WEB_URL'], data['apps']['ucat-web'])

    def test_duplicate_worktree_session_is_rejected_without_stopping_first(self):
        process = self.start()
        first = self.wait_ready(process)
        second = self.call()
        self.assertNotEqual(second.returncode, 0)
        self.assertEqual(json.loads(self.call('status').stdout)['project_id'], first['project_id'])
        self.assertIsNone(process.poll())

    def test_app_startup_failure_stops_only_the_owned_database(self):
        (self.fixture.base / 'fail-app').touch()
        process = self.start()
        _, error = process.communicate(timeout=12)
        self.assertNotEqual(process.returncode, 0, error)
        self.assertTrue(json.loads(self.fixture.state.read_text())['stopped'])
        self.assertEqual(json.loads(self.fixture.state.read_text())['normal_database'], 'untouched')

    def test_schema_edits_during_development_do_not_prevent_owned_cleanup(self):
        process = self.start()
        self.wait_ready(process)
        (self.repo / 'supabase/seed/test-ucat/new.sql').write_text('SELECT 1;')
        stopped = self.call('stop')
        self.assertEqual(stopped.returncode, 0, stopped.stderr)
        process.communicate(timeout=12)
        self.assertTrue(json.loads(self.fixture.state.read_text())['stopped'])

    def test_killed_supervisor_can_be_recovered_from_exact_receipts(self):
        self.environment['TZ'] = 'UTC'
        process = self.start()
        self.wait_ready(process)
        self.environment['TZ'] = 'Australia/Adelaide'
        process.kill()
        process.communicate(timeout=5)
        self.assertEqual(json.loads(self.call('status').stdout)['phase'], 'interrupted')
        result = self.call('stop')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(self.fixture.state.read_text())['stopped'])

    def test_unknown_app_fails_before_any_database_commands(self):
        result = self.call('--apps', '../foreign')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.fixture.calls(), [])

    def test_two_worktrees_serve_concurrently_without_shared_ports_or_database(self):
        other = WorktreeDevelopmentTests()
        other.setUp()
        self.addCleanup(other.doCleanups)
        first = self.wait_ready(self.start('--apps', 'admin-web,ucat-web'))
        second = other.wait_ready(other.start('--apps', 'admin-web,ucat-web'))
        self.assertNotEqual(first['project_id'], second['project_id'])
        self.assertNotEqual(first['api_url'], second['api_url'])
        self.assertTrue(set(first['apps'].values()).isdisjoint(second['apps'].values()))
        self.assertEqual(self.call('stop').returncode, 0)
        self.assertEqual(json.loads(other.call('status').stdout)['phase'], 'ready')

    def test_stop_joins_exec_consumer_before_removing_database(self):
        self.environment['TZ'] = 'UTC'
        process = self.start()
        self.wait_ready(process)
        self.environment['TZ'] = 'Australia/Adelaide'
        marker = self.fixture.base / 'exec-running'
        observed = self.fixture.base / 'exec-stopped-before-database'
        consumer = self.fixture.base / 'consumer.py'
        consumer.write_text(
            'import json,signal,time\nfrom pathlib import Path\n'
            'def stop(*args):\n'
            ' data=json.loads(Path(' + repr(str(self.fixture.state)) + ').read_text())\n'
            ' Path(' + repr(str(observed)) + ').write_text(str(not data["stopped"]))\n'
            ' raise SystemExit(0)\n'
            'signal.signal(signal.SIGTERM,stop)\n'
            'Path(' + repr(str(marker)) + ').touch()\n'
            'while True:time.sleep(.1)\n')
        client = self.start('exec', '--', sys.executable, str(consumer))
        deadline = time.monotonic() + 5
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(.05)
        self.assertTrue(marker.exists())
        result = self.call('stop')
        self.assertEqual(result.returncode, 0, result.stderr)
        client.communicate(timeout=10)
        self.assertEqual(observed.read_text(), 'True', 'Exec process must receive termination before the DB is removed')
        self.assertTrue(json.loads(self.fixture.state.read_text())['stopped'])


if __name__ == '__main__':
    unittest.main()
