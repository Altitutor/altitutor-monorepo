"""Command-level ownership, contention and cancellation tests; no real DB writes."""
import json
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import unittest

SCRIPT = Path(__file__).with_name('owned_database.py').resolve()
CONFIG = 'project_id = "altitutor-admin-app"\n[api]\nport = 55321\n[db]\nport = 55322\nshadow_port = 55320\n'
FAKE = r"""import json,os,re,sys,time
from pathlib import Path
state=Path(os.environ['FIXTURE_STATE']);data=json.loads(state.read_text());args=sys.argv[1:];name=Path(sys.argv[0]).name
with open(os.environ['FIXTURE_LOG'],'a') as output: output.write(json.dumps([name,args])+'\n')
if name=='docker':
 if args[0]=='inspect':
  record=data['records'].get(args[1]);
  if not record:sys.exit(1)
  print(json.dumps([record]))
 elif args[0]=='ps':
  if data.get('started'):print('owned-db\nowned-api')
 elif args[:2]==['network','ls']:
  print('\n'.join(data.get('networks',{})))
 elif args[:2]==['network','inspect']:
  record=data.get('networks',{}).get(args[2])
  if not record:sys.exit(1)
  print(json.dumps([record]))
 elif args[:2]==['network','rm']:
  assert args[2]=='owned-network', 'foreign or replacement network removal'
  del data['networks'][args[2]];state.write_text(json.dumps(data))
 elif args[:2]==['volume','ls']:
  print('\n'.join(data.get('volumes',[])))
 elif args[0]=='exec':
  assert args[2]=='owned-db', 'foreign container seed';sys.stdin.read()
elif name=='pnpm' and 'next' in args:
 assert os.environ['NEXT_PUBLIC_SUPABASE_URL']==('http://127.0.0.1:'+data['api_port'] if os.environ.get('ALTITUTOR_OWNED_DB_INNER') else 'http://127.0.0.1:1')
 if os.environ.get('FIXTURE_PREVIEW_SLEEP'):time.sleep(30)
elif name=='supabase':
 if os.environ.get('FIXTURE_REQUIRE_NO_TELEMETRY') and os.environ.get('SUPABASE_TELEMETRY_DISABLED')!='1':
  print('Telemetry-state write would escape the workspace',file=sys.stderr);sys.exit(79)
 if args[2]=='start':
  workdir=Path(args[1]);manifest=json.loads((workdir/'ownership.json').read_text())
  assert manifest['role']=='disposable-test'
  project=manifest['project_id'];data['workdir']=str(workdir)
  config=(workdir/'supabase/config.toml').read_text()
  data['api_port']=re.search(r'\[api\]\nport = (\d+)',config)[1]
  data['db_port']=re.search(r'\[db\]\nport = (\d+)',config)[1]
  records={}
  for identifier in ['owned-db','owned-api']:
   record=data['records'][identifier];service='db' if identifier=='owned-db' else 'kong'
   record['Name']='/supabase_'+service+'_'+project
   record['Config']['Labels']['com.supabase.cli.project']=project
   internal='5432/tcp' if service=='db' else '8000/tcp'
   record['NetworkSettings']['Ports'][internal][0]['HostPort']=data['db_port'] if service=='db' else data['api_port']
   records[identifier]=record;records['supabase_'+service+'_'+project]=record
  data['records']=records
 assert args[:2]==['--workdir',data['workdir']], 'foreign workdir'
 args=args[2:]
 if args[0]=='start':
  data['networks']={'owned-network':{'Id':'owned-network','Name':'supabase_network_'+project,'Labels':{'com.supabase.cli.project':project},'Containers':{}}}
  data['started']=True;data['stopped']=False;state.write_text(json.dumps(data))
  if os.environ.get('FIXTURE_START_FAIL'):sys.exit(9)
 elif args[0]=='status':
  database_url=os.environ.get('FIXTURE_DB_URL_OVERRIDE','postgresql://postgres:postgres@127.0.0.1:'+data['db_port']+'/postgres')
  print('API_URL="http://127.0.0.1:'+data['api_port']+'"\nDB_URL="'+database_url+'"\nANON_KEY="synthetic-public"\nSERVICE_ROLE_KEY="synthetic-service"')
 elif args[:2]==['db','reset'] and os.environ.get('FIXTURE_RESET_REPLACE'):
  for record in data['records'].values():
   if record['Id']=='owned-api':record['Id']='reset-api'
  state.write_text(json.dumps(data))
 elif args[0]=='gen':
  if os.environ.get('FIXTURE_GEN_FAIL'):sys.exit(9)
  print('// fixture generated types')
 elif args[0]=='stop':
  data['started']=False;data['stopped']=True
  if os.environ.get('FIXTURE_STOP_NETWORK_CONTENTION'):
   if os.environ.get('FIXTURE_STOP_LEFT_VOLUME'):data['volumes']=['supabase_db_'+project]
   if os.environ.get('FIXTURE_STOP_LEFT_CONTAINER'):data['started']=True
   if os.environ.get('FIXTURE_STOP_REPLACE_NETWORK'):
    record=data['networks'].pop('owned-network');record['Id']='replacement-network';data['networks']['replacement-network']=record
   if os.environ.get('FIXTURE_STOP_ATTACHED_NETWORK'):data['networks']['owned-network']['Containers']={'foreign':'endpoint'}
   state.write_text(json.dumps(data))
   print('failed to prune networks: Error response from daemon: a prune operation is already running',file=sys.stderr);sys.exit(1)
  data['networks']={};state.write_text(json.dumps(data))
  if os.environ.get('FIXTURE_STOP_OTHER_ERROR'):
   print('failed to stop container: daemon unavailable',file=sys.stderr);sys.exit(1)
"""

class OwnedDatabaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.base = Path(self.temp.name).resolve()
        self.repo = self.base / 'repo'
        (self.repo / 'supabase/seed/test-ucat').mkdir(parents=True)
        (self.repo / 'supabase/config.toml').write_text(CONFIG)
        (self.repo / 'supabase/seed/test-ucat/fixture.sql').write_text('SELECT 1;\n')
        (self.repo / 'packages/shared/src/supabase').mkdir(parents=True)
        (self.repo / 'scripts').mkdir()
        # Keep the single routed preview lock inside this fixture. Database
        # locks are already scoped to each independently prepared runtime.
        helper=SCRIPT.read_text().replace("Path('/tmp/altitutor-prototype-preview.lock')", "Path("+repr(str(self.base/'preview.lock'))+")")
        # Keep synthetic preview tests away from a real human review server.
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            preview_port = probe.getsockname()[1]
        helper = helper.replace("'--port', '57340'", "'--port', '" + str(preview_port) + "'").replace("('127.0.0.1', 57340)", "('127.0.0.1', " + str(preview_port) + ")")
        (self.repo/'scripts/owned_database.py').write_text(helper)
        shutil.copy2(SCRIPT.with_name('checkall.sh'), self.repo / 'scripts/checkall.sh')
        (self.repo / 'supabase/scripts').mkdir()
        shutil.copy2(SCRIPT.parents[1] / 'supabase/scripts/apply-ucat-test-seed.sh', self.repo / 'supabase/scripts/apply-ucat-test-seed.sh')
        # Simulate HTTP consumers while retaining their real lease checks.
        for relative_path, event, root_parent in [
            ('supabase/scripts/test-student-registration.py', 'student-registration', 2),
            ('scripts/test-imessage-inbound.py', 'imessage-inbound', 1),
            ('supabase/scripts/test-interview-station-upgrade.py', 'interview-station-upgrade', 2),
            ('supabase/scripts/test-interview-concurrency.py', 'interview-concurrency', 2),
        ]:
            (self.repo / relative_path).write_text(
                'import json, os, subprocess, sys\nfrom pathlib import Path\n'
                f'root = Path(__file__).resolve().parents[{root_parent}]\n'
                'subprocess.run([sys.executable, str(root / "scripts/owned_database.py"), "verify-inner"], '
                'check=True, pass_fds=(int(os.environ["ALTITUTOR_DB_LOCK_FD"]),))\n'
                'with open(os.environ["FIXTURE_LOG"], "a") as output:\n'
                f'    output.write(json.dumps([{event!r}, []]) + "\\n")\n'
            )
        self.runtime = self.base / 'runtime'
        result = self.call('prepare', '--workdir', str(self.runtime))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.manifest = self.runtime / 'ownership.json'
        self.project = json.loads(self.manifest.read_text())['project_id']
        self.bin = self.base / 'bin'; self.bin.mkdir()
        for name in ['docker', 'supabase', 'pnpm', 'git']:
            path = self.bin / name
            path.write_text('#!' + sys.executable + '\n' + FAKE)
            path.chmod(0o700)
        def record(service, internal, port, identifier):
            return {'Name': '/supabase_' + service + '_' + self.project, 'Id': identifier,
                    'State': {'Running': True}, 'Config': {'Labels': {'com.supabase.cli.project': self.project}},
                    'NetworkSettings': {'Ports': {internal: [{'HostIp': '127.0.0.1', 'HostPort': port}]}}}
        db=record('db','5432/tcp','57322','owned-db');api=record('kong','8000/tcp','57321','owned-api')
        self.state=self.base/'state.json';self.log=self.base/'log.jsonl'
        self.state.write_text(json.dumps({'workdir':str(self.runtime),'records':{
            'supabase_db_'+self.project:db,'supabase_kong_'+self.project:api,'owned-db':db,'owned-api':api},
            'normal_database':'untouched','stopped':False}))
        self.env=dict(os.environ, PATH=str(self.bin)+os.pathsep+os.environ['PATH'],
                      FIXTURE_STATE=str(self.state),FIXTURE_LOG=str(self.log))
        for key in ['ALTITUTOR_TEST_DB_MANIFEST','ALTITUTOR_DB_LOCK_FD','ALTITUTOR_OWNED_DB_INNER']:
            self.env.pop(key,None)

    def tearDown(self):
        self.temp.cleanup()

    def command(self, action, *args):
        return [sys.executable,str(self.repo/'scripts/owned_database.py'),action,'--repository',str(self.repo),*args]

    def call(self, action, *args, **kwargs):
        return subprocess.run(self.command(action,*args),capture_output=True,text=True,env=getattr(self,'env',None),**kwargs)

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def test_local_cli_lifecycle_works_without_home_telemetry_writes(self):
        self.env['FIXTURE_REQUIRE_NO_TELEMETRY'] = '1'
        self.env['SUPABASE_TELEMETRY_DISABLED'] = '0'
        for action in ['gate', 'types', 'committypes']:
            with self.subTest(action=action):
                result = self.call(action, '--manifest', str(self.manifest))
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertTrue(json.loads(self.state.read_text())['stopped'])
                self.assertEqual(json.loads(self.state.read_text())['normal_database'], 'untouched')

    def test_completed_owned_cleanup_recovers_only_network_prune_contention(self):
        self.env['FIXTURE_STOP_NETWORK_CONTENTION'] = '1'
        result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, '-c', 'pass')
        self.assertEqual(result.returncode, 0, result.stderr)
        data = json.loads(self.state.read_text())
        self.assertFalse(data['started'])
        self.assertEqual(data['networks'], {})
        self.assertEqual(data['normal_database'], 'untouched')

    def test_network_prune_recovery_rejects_incomplete_or_replaced_resources(self):
        self.env['FIXTURE_STOP_NETWORK_CONTENTION'] = '1'
        for fault in ['FIXTURE_STOP_LEFT_VOLUME', 'FIXTURE_STOP_LEFT_CONTAINER',
                      'FIXTURE_STOP_REPLACE_NETWORK', 'FIXTURE_STOP_ATTACHED_NETWORK']:
            with self.subTest(fault=fault):
                self.env[fault] = '1'
                result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, '-c', 'pass')
                self.assertNotEqual(result.returncode, 0)
                self.assertFalse(any(name == 'docker' and args[:2] == ['network', 'rm']
                                     for name, args in self.calls()))
                self.assertEqual(json.loads(self.state.read_text())['normal_database'], 'untouched')
                del self.env[fault]
                data = json.loads(self.state.read_text())
                data['started'] = False
                data['volumes'] = []
                self.state.write_text(json.dumps(data))
                self.log.unlink()

    def test_unrelated_stop_error_remains_failure_even_after_resources_are_gone(self):
        self.env['FIXTURE_STOP_OTHER_ERROR'] = '1'
        result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, '-c', 'pass')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('daemon unavailable', result.stderr)
        self.assertEqual(json.loads(self.state.read_text())['normal_database'], 'untouched')

    def test_network_replaced_before_cleanup_is_not_adopted(self):
        consumer = self.base / 'replace-network.py'
        consumer.write_text('import json,os\nfrom pathlib import Path\np=Path(os.environ["FIXTURE_STATE"])\nd=json.loads(p.read_text())\nr=d["networks"].pop("owned-network")\nr["Id"]="replacement-network"\nd["networks"][r["Id"]]=r\np.write_text(json.dumps(d))\n')
        result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, str(consumer))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('network replaced', result.stderr.lower())
        self.assertFalse(any(name == 'supabase' and 'stop' in args for name, args in self.calls()))

    def test_normal_development_manifest_is_rejected_before_any_command(self):
        data=json.loads(self.manifest.read_text());data['workdir']=str(self.repo);data['project_id']='altitutor-admin-app'
        bad=self.repo/'ownership.json';bad.write_text(json.dumps(data))
        result=self.call('seed','--manifest',str(bad))
        self.assertNotEqual(result.returncode,0)
        self.assertIn('disposable',result.stderr.lower())
        self.assertEqual(self.calls(),[])

    def test_missing_manifest_prepares_fresh_target_instead_of_using_normal_stack(self):
        result=self.call('seed')
        self.assertEqual(result.returncode,0,result.stderr)
        starts=[args for name,args in self.calls() if name=='supabase' and 'start' in args]
        self.assertEqual(len(starts),1)
        self.assertNotEqual(starts[0][1],str(self.repo))
        self.assertNotEqual(starts[0][1],str(self.runtime))
        self.assertFalse(Path(starts[0][1]).exists(),'successful automatic runtime should be removed')
        self.assertEqual(json.loads(self.state.read_text())['normal_database'],'untouched')

    def test_normal_docker_bindings_are_accepted_for_owned_stack(self):
        data=json.loads(self.state.read_text())
        data['records']['supabase_db_'+self.project]['NetworkSettings']['Ports']['5432/tcp'][0]['HostIp']='0.0.0.0'
        self.state.write_text(json.dumps(data))
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue(json.loads(self.state.read_text())['stopped'])

    def test_seed_selects_exact_owned_container_and_cleans_only_owned_stack(self):
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertEqual(result.returncode,0,result.stderr)
        writes=[args for name,args in self.calls() if name=='docker' and args[0]=='exec']
        self.assertEqual(writes[0][2],'owned-db')
        self.assertTrue(json.loads(self.state.read_text())['stopped'])
        self.assertEqual(json.loads(self.state.read_text())['normal_database'],'untouched')

    def test_gate_runs_database_and_browser_consumer_inside_owned_lifetime(self):
        result=self.call('gate','--manifest',str(self.manifest))
        self.assertEqual(result.returncode,0,result.stderr)
        actions=[(name,args[2:] if name=='supabase' else args) for name,args in self.calls()]
        self.assertIn(('supabase',['db','reset','--local']),actions)
        self.assertIn(('supabase',['test','db']),actions)
        self.assertIn(('student-registration',[]),actions)
        self.assertIn(('pnpm',['--filter','ucat-web','test:e2e:critical']),actions)
        self.assertIn(('imessage-inbound',[]),actions)
        self.assertIn(('interview-concurrency',[]),actions)
        self.assertIn(('interview-station-upgrade',[]),actions)
        self.assertLess(actions.index(('supabase',['test','db'])),actions.index(('student-registration',[])))
        self.assertLess(actions.index(('student-registration',[])),actions.index(('imessage-inbound',[])))
        self.assertLess(actions.index(('imessage-inbound',[])),actions.index(('interview-station-upgrade',[])))
        self.assertLess(actions.index(('interview-station-upgrade',[])),actions.index(('interview-concurrency',[])))
        self.assertLess(actions.index(('supabase',['test','db'])),actions.index(('interview-concurrency',[])))
        self.assertLess(actions.index(('interview-concurrency',[])),actions.index(('pnpm',['--filter','ucat-web','test:e2e:critical'])))
        self.assertEqual(actions[-1],('supabase',['stop','--project-id',self.project,'--no-backup']))

    def test_type_commands_use_owned_stack_and_preserve_existing_output_on_failure(self):
        for action in ['types','committypes']:
            result=self.call(action,'--manifest',str(self.manifest))
            self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual((self.repo/'packages/shared/src/supabase/generated.ts').read_text(),'// fixture generated types\n')
        self.assertEqual(json.loads(self.state.read_text())['normal_database'],'untouched')
        self.env['FIXTURE_GEN_FAIL']='1'
        failed=self.call('types','--manifest',str(self.manifest))
        self.assertNotEqual(failed.returncode,0)
        self.assertEqual((self.repo/'packages/shared/src/supabase/generated.ts').read_text(),'// fixture generated types\n')

    def test_waiting_consumer_runs_after_cancellation_and_cleanup(self):
        consumer=self.base/'consumer.py';ready=self.base/'ready'
        consumer.write_text('from pathlib import Path\nimport time\nPath('+repr(str(ready))+').write_text("ready")\ntime.sleep(30)\n')
        process=subprocess.Popen(self.command('run','--manifest',str(self.manifest),'--',sys.executable,str(consumer)),env=self.env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        second=None
        try:
            for _ in range(100):
                if ready.exists():break
                time.sleep(.03)
            self.assertTrue(ready.exists(),'consumer never started')
            second=subprocess.Popen(self.command('seed','--manifest',str(self.manifest)),env=self.env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            time.sleep(.3)
            self.assertIsNone(second.poll(),'second consumer should wait')
            non_db=subprocess.run([sys.executable,'-c','print("non-DB work completed")'],capture_output=True,text=True,timeout=2)
            self.assertEqual(non_db.returncode,0)
            process.send_signal(signal.SIGTERM)
            _,error=process.communicate(timeout=8)
            self.assertEqual(process.returncode,130,error)
            _,error=second.communicate(timeout=8)
            self.assertEqual(second.returncode,0,error)
            self.assertTrue(json.loads(self.state.read_text())['stopped'])
        finally:
            for child in [process,second]:
                if child is not None:
                    if child.poll() is None:child.kill()
                    child.communicate()

    def test_failure_cleans_owned_stack_and_overrides_remote_consumer_environment(self):
        consumer=self.base/'consumer.py'
        consumer.write_text('import json,os,sys\nfrom pathlib import Path\nport=json.loads(Path(os.environ["FIXTURE_STATE"]).read_text())["api_port"]\nassert os.environ["NEXT_PUBLIC_SUPABASE_URL"]=="http://127.0.0.1:"+port\nassert os.environ["UCAT_E2E_SUPABASE_URL"]=="http://127.0.0.1:"+port\nassert os.environ["STUDENT_E2E_SUPABASE_URL"]=="http://127.0.0.1:"+port\nassert os.environ["ADMIN_E2E_SUPABASE_URL"]=="http://127.0.0.1:"+port\nassert os.environ["TUTOR_E2E_SUPABASE_URL"]=="http://127.0.0.1:"+port\nsys.exit(7)\n')
        self.env.update(NEXT_PUBLIC_SUPABASE_URL='https://remote.example',UCAT_E2E_SUPABASE_URL='https://remote.example', STUDENT_E2E_SUPABASE_URL='https://remote.example', ADMIN_E2E_SUPABASE_URL='https://remote.example', TUTOR_E2E_SUPABASE_URL='https://remote.example')
        result=self.call('run','--manifest',str(self.manifest),'--',sys.executable,str(consumer))
        self.assertNotEqual(result.returncode,0)
        self.assertIn('exit 7',result.stderr)
        self.assertTrue(json.loads(self.state.read_text())['stopped'])

    def test_preview_serializes_shared_port_and_binds_owned_database_for_its_lifetime(self):
        (self.repo/'apps/ucat-web').mkdir(parents=True)
        self.env['FIXTURE_PREVIEW_SLEEP']='1'
        process=subprocess.Popen(self.command('preview','--app','ucat-web','--manifest',str(self.manifest)),env=self.env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        try:
            for _ in range(100):
                if any(name=='pnpm' and 'next' in args for name,args in self.calls()):break
                time.sleep(.03)
            self.assertTrue(any(name=='pnpm' and 'next' in args for name,args in self.calls()))
            second=self.call('preview','--app','ucat-web','--manifest',str(self.manifest))
            self.assertNotEqual(second.returncode,0)
            self.assertIn('common lifecycle lock',second.stderr)
            self.assertFalse(json.loads(self.state.read_text())['stopped'])
            process.send_signal(signal.SIGTERM)
            process.communicate(timeout=8)
            self.assertTrue(json.loads(self.state.read_text())['stopped'])
        finally:
            if process.poll() is None:process.kill()
            process.communicate()

    def test_synthetic_preview_uses_no_database_and_clears_deployment_values(self):
        (self.repo/'apps/ucat-web').mkdir(parents=True)
        self.env.update(NEXT_PUBLIC_SUPABASE_URL='https://remote.example',UCAT_E2E_SUPABASE_URL='https://remote.example', STUDENT_E2E_SUPABASE_URL='https://remote.example', ADMIN_E2E_SUPABASE_URL='https://remote.example', TUTOR_E2E_SUPABASE_URL='https://remote.example')
        result=self.call('preview','--app','ucat-web')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertFalse(any(name in {'docker','supabase'} for name,args in self.calls()))
        self.assertFalse(json.loads(self.state.read_text())['stopped'])

    def test_additional_normal_docker_binding_is_accepted(self):
        data=json.loads(self.state.read_text())
        data['records']['owned-api']['NetworkSettings']['Ports']['9000/tcp']=[{'HostIp':'0.0.0.0','HostPort':'57340'}]
        self.state.write_text(json.dumps(data))
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertEqual(result.returncode,0,result.stderr)

    def test_replaced_owned_container_is_not_mutated_or_stopped(self):
        consumer=self.base/'replace.py'
        consumer.write_text('import json,os\nfrom pathlib import Path\np=Path(os.environ["FIXTURE_STATE"])\nd=json.loads(p.read_text())\nfor record in d["records"].values():\n if record["Id"]=="owned-db":record["Id"]="replacement-db"\np.write_text(json.dumps(d))\n')
        result=self.call('run','--manifest',str(self.manifest),'--',sys.executable,str(consumer))
        self.assertNotEqual(result.returncode,0)
        self.assertIn('replaced',result.stderr)
        self.assertFalse(json.loads(self.state.read_text())['stopped'])
        self.assertFalse(any(name=='supabase' and 'stop' in args for name,args in self.calls()))

    def test_guarded_reset_accepts_its_own_service_replacements(self):
        self.env['FIXTURE_RESET_REPLACE']='1'
        result=self.call('gate','--manifest',str(self.manifest))
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue(json.loads(self.state.read_text())['stopped'])
        self.assertEqual(json.loads(self.state.read_text())['normal_database'],'untouched')

    def test_partial_start_failure_cleans_only_the_owned_project(self):
        self.env['FIXTURE_START_FAIL']='1'
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertNotEqual(result.returncode,0)
        self.assertTrue(json.loads(self.state.read_text())['stopped'])
        self.assertEqual(json.loads(self.state.read_text())['normal_database'],'untouched')

    def test_existing_disposable_project_is_not_adopted_or_stopped(self):
        data=json.loads(self.state.read_text());data['started']=True
        self.state.write_text(json.dumps(data))
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertNotEqual(result.returncode,0)
        self.assertIn('already exists',result.stderr)
        self.assertFalse(any(name=='supabase' for name,args in self.calls()))
        self.assertFalse(json.loads(self.state.read_text())['stopped'])

    def test_changed_schema_blocks_before_commands(self):
        (self.repo/'supabase/seed/test-ucat/fixture.sql').write_text('SELECT 2;\n')
        result=self.call('seed','--manifest',str(self.manifest))
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(self.calls(),[])

    def test_independent_runtimes_run_concurrently_on_distinct_ports(self):
        other = OwnedDatabaseTests()
        other.setUp()
        processes = []
        try:
            markers = []
            for fixture in [self, other]:
                marker = fixture.base / 'running'
                markers.append(marker)
                command = 'from pathlib import Path;import time;Path(' + repr(str(marker)) + ').touch();time.sleep(30)'
                processes.append(subprocess.Popen(fixture.command('run', '--manifest', str(fixture.manifest),
                    '--', sys.executable, '-c', command), env=fixture.env,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True))
            deadline = time.monotonic() + 6
            while not all(marker.exists() for marker in markers) and time.monotonic() < deadline:
                time.sleep(.05)
            self.assertTrue(all(marker.exists() for marker in markers), 'Independent database consumers must overlap')
            first = json.loads(self.state.read_text())
            second = json.loads(other.state.read_text())
            self.assertNotEqual(first['api_port'], second['api_port'])
            self.assertNotEqual(first['db_port'], second['db_port'])
            self.assertNotEqual(self.project, other.project)
        finally:
            for process in processes:
                if process.poll() is None:
                    process.terminate()
                process.communicate(timeout=8)
            other.tearDown()

    def test_occupied_allocated_port_fails_before_starting_or_stopping_a_stack(self):
        import re
        api_port = int(re.search(r'\[api\]\nport = (\d+)',
            (self.runtime / 'supabase/config.toml').read_text())[1])
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', api_port))
            result = self.call('seed', '--manifest', str(self.manifest))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('port occupied', result.stderr)
        self.assertEqual(self.calls(), [])

    def test_stopped_owned_service_can_still_be_cleaned_using_exact_container_ids(self):
        command = ('import json,os;from pathlib import Path;'
                   'p=Path(os.environ["FIXTURE_STATE"]);d=json.loads(p.read_text());'
                   '[record["State"].update(Running=False) for record in d["records"].values()];'
                   'p.write_text(json.dumps(d))')
        result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, '-c', command)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(self.state.read_text())['stopped'])

    def test_nonlocal_database_status_connection_is_rejected_before_consumer(self):
        self.env['FIXTURE_DB_URL_OVERRIDE'] = 'postgresql://postgres:password@remote.invalid:5432/postgres'
        marker = self.base / 'consumer-must-not-run'
        result = self.call('run', '--manifest', str(self.manifest), '--', sys.executable, '-c',
                           'from pathlib import Path;Path(' + repr(str(marker)) + ').touch()')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('verified loopback DB port', result.stderr)
        self.assertFalse(marker.exists())
        self.assertTrue(json.loads(self.state.read_text())['stopped'])

if __name__=='__main__':
    unittest.main()
