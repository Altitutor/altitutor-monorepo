"""Run selected monorepo apps against an owned, disposable local Supabase stack.

Keep `run` in a terminal or a harness-tracked background session. Ctrl+C or
`stop` ends the apps and removes only this session's database. Python 3.9+.
"""
import argparse
from contextlib import ExitStack, contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import stat
import subprocess
import sys
import tempfile
import time
import uuid

import owned_database as db

WEB_APPS = ('admin-web', 'student-web', 'tutor-web', 'marketing-web', 'ucat-web')
NATIVE_APPS = {'student-app': 'student-web', 'ucat-app': 'ucat-web'}
ROOT = Path(__file__).resolve().parents[1]


def private_json(path, data):
    temporary = path.with_suffix('.tmp')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump(data, output, indent=2)
        output.write('\n')
    os.replace(temporary, path)


def control_directory(repository):
    identity = hashlib.sha256(str(repository).encode()).hexdigest()[:16]
    path = Path(tempfile.gettempdir()) / ('altitutor-dev-' + str(os.getuid()) + '-' + identity)
    path.mkdir(mode=0o700, exist_ok=True)
    info = path.lstat()
    if path.is_symlink() or info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise db.Blocked('Development control directory must be private and owned by this user')
    return path.resolve()


def process_identity(pid):
    # Receipts are compared across callers whose sanitized environments may
    # have different timezones/locales. Keep ps's birth timestamp canonical.
    result = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart=,command='],
                            env=dict(os.environ, TZ='UTC', LC_ALL='C'),
                            capture_output=True, text=True, check=True)
    return result.stdout.strip()


def same_process(pid, identity):
    try:
        return bool(identity) and process_identity(pid) == identity
    except subprocess.CalledProcessError:
        return False


def load_session(control, repository):
    data = json.loads((control / 'session.json').read_text())
    data['runtime'] = str(Path(data['runtime']).resolve())
    if (data['repository'] != str(repository) or Path(data['runtime']).parent.parent != control
            or Path(data['runtime']).name != 'stack'):
        raise db.Blocked('Development session belongs to another checkout')
    manifest = Path(data['runtime']) / 'ownership.json'
    _, project = db.owned_manifest(str(manifest), repository, check_source=False)
    if project != data['project_id']:
        raise db.Blocked('Development project identity changed')
    return data


def selected_apps(value):
    apps = list(WEB_APPS) if value == 'all' else list(dict.fromkeys(value.split(',')))
    for app in list(apps):
        if app not in (*WEB_APPS, *NATIVE_APPS):
            raise db.Blocked('Unknown app: ' + app + '; use app directory names or all')
        if app in NATIVE_APPS and NATIVE_APPS[app] not in apps:
            apps.append(NATIVE_APPS[app])
    return apps


def local_environment(repository):
    # Do not copy deployment credentials into a fresh worktree. Blank keys
    # declared in local .env files as well, since Next/Expo load those themselves.
    allowed = {'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'LANG', 'TERM',
               'COLORTERM', 'SYSTEMROOT', 'DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_CONFIG'}
    environment = {key: value for key, value in os.environ.items()
                   if key in allowed or key.startswith('LC_')}
    directories = [repository] + list((repository / 'apps').iterdir())
    for directory in directories:
        for path in directory.glob('.env*'):
            if path.is_file():
                for key in re.findall(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', path.read_text(), re.M):
                    environment[key] = ''
    environment.update(SENTRY_DISABLED='true', NEXT_PUBLIC_SENTRY_DISABLED='true',
                       EXPO_PUBLIC_SENTRY_DISABLED='true', NEXT_TELEMETRY_DISABLED='1',
                       SUPABASE_TELEMETRY_DISABLED='1', EXPO_NO_TELEMETRY='1',
                       EXPO_NO_DOTENV='1', CI='1', NODE_ENV='development')
    return environment


def app_origin(app, port):
    # NextRequest canonicalizes numeric loopback hosts to localhost. Publish
    # that same web host so auth redirects keep each app's host-only cookie.
    host = 'localhost' if app in WEB_APPS else '127.0.0.1'
    return 'http://' + host + ':' + str(port)


def app_environment(environment, app_ports):
    for app in WEB_APPS:
        name = app.removesuffix('-web').upper()
        origin = app_origin(app, app_ports.get(app, 1))
        environment['NEXT_PUBLIC_' + name + '_URL'] = origin
        environment['NEXT_PUBLIC_' + name + '_PORTAL_URL'] = origin
        environment['NEXT_PUBLIC_' + name + '_WEB_URL'] = origin
        environment['EXPO_PUBLIC_' + name + '_WEB_URL'] = origin
    environment['UCAT_APP_ORIGIN'] = environment['NEXT_PUBLIC_UCAT_URL']
    environment['NEXT_PUBLIC_UCAT_APP_ORIGIN'] = environment['NEXT_PUBLIC_UCAT_URL']
    return environment


@contextmanager
def execution_lock(runtime, *, shared=False):
    descriptor = os.open(runtime / 'executions.lock', os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
            raise db.Blocked('Execution lock must be a regular owned file')
        deadline = time.monotonic() + 15
        while True:
            try:
                fcntl.flock(descriptor, (fcntl.LOCK_SH if shared else fcntl.LOCK_EX) | fcntl.LOCK_NB)
                break
            except BlockingIOError:
                if time.monotonic() >= deadline:
                    raise db.Blocked('Execution consumers did not release their runtime lease; resources retained')
                time.sleep(.1)
        yield
    finally:
        os.close(descriptor)


def group_identity(pid):
    return subprocess.check_output(['ps', '-p', str(pid), '-o', 'lstart=,pgid='],
                                   env=dict(os.environ, TZ='UTC', LC_ALL='C'), text=True).strip()


def finish_executions(control, data):
    runtime = Path(data['runtime'])
    data['phase'] = 'stopping'
    private_json(control / 'session.json', data)
    consumers = runtime / 'consumers'
    for path in consumers.glob('*.json'):
        try:
            record = json.loads(path.read_text())
        except FileNotFoundError:
            continue  # A completing client removed its receipt under SH.
        if same_process(record['pid'], record['identity']):
            continue  # Live clients see stopping and terminate under their SH lease.
        child = record.get('child')
        if not child:
            raise db.Blocked('Interrupted exec startup needs ownership inspection: ' + str(path))
        try:
            identity = group_identity(child['pid'])
        except subprocess.CalledProcessError:
            try:
                os.killpg(child['pid'], 0)
            except ProcessLookupError:
                path.unlink(missing_ok=True)
                continue
            raise db.Blocked('Cannot prove orphan exec process group ownership: ' + str(path))
        if identity != child['identity']:
            raise db.Blocked('Exec process identity changed; retained ownership evidence: ' + str(path))
        os.killpg(child['pid'], signal.SIGTERM)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            try:
                os.killpg(child['pid'], 0)
            except ProcessLookupError:
                break
            time.sleep(.1)
        else:
            os.killpg(child['pid'], signal.SIGKILL)
        path.unlink(missing_ok=True)
    with execution_lock(runtime):
        if list(consumers.glob('*.json')):
            raise db.Blocked('Execution ownership receipts remain; database retained for inspection')


def stop_group(child):
    try:
        os.killpg(child.pid, signal.SIGTERM)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            child.poll()
            try:
                os.killpg(child.pid, 0)
            except ProcessLookupError:
                break
            time.sleep(.05)
        else:
            os.killpg(child.pid, signal.SIGKILL)
        child.wait(timeout=5)
    except ProcessLookupError:
        child.wait()


def run(repository, apps, skip_install):
    control = control_directory(repository)
    with db.exclusive(control / 'session.lock', wait=False):
        if (control / 'session.json').exists():
            raise db.Blocked('Session already recorded; use status or stop before starting again')
        environment = local_environment(repository)
        if not (repository / 'node_modules/.modules.yaml').is_file():
            if skip_install:
                raise db.Blocked('Dependencies absent; run pnpm install --frozen-lockfile')
            subprocess.run(['pnpm', 'install', '--frozen-lockfile'], cwd=repository, env=environment, check=True)
        # Workspace libraries publish dist entrypoints; build before starting apps.
        subprocess.run(['pnpm', 'turbo', 'run', 'build', '--filter=./packages/*'],
                       cwd=repository, env=environment, check=True)
        renderer = repository / 'supabase/scripts/render-email-templates.sh'
        if renderer.is_file():
            subprocess.run(['bash', str(renderer)], cwd=repository, env=environment, check=True)
        temporary = Path(tempfile.mkdtemp(prefix='runtime-', dir=control))
        runtime = temporary / 'stack'
        manifest = db.prepare(repository, runtime)
        app_ports = dict(zip(apps, db.free_ports(len(apps), db.configured_ports(runtime))))
        app_environment(environment, app_ports)
        config = runtime / 'supabase/config.toml'
        text = config.read_text()
        origins = [app_origin(app, port) for app, port in app_ports.items() if app in WEB_APPS]
        text = re.sub(r'^site_url\s*=.*$', 'site_url = ' + json.dumps(origins[0]), text, flags=re.M)
        redirects = [origin + suffix for origin in origins for suffix in ('/**', '/auth/callback')]
        text = re.sub(r'^additional_redirect_urls\s*=.*$', 'additional_redirect_urls = ' + json.dumps(redirects), text, flags=re.M)
        config.write_text(text)
        proof = json.loads(manifest.read_text())
        proof.update(config_sha256=db.digest(config), prepared_tree_sha256=db.tree_digest(runtime / 'supabase'))
        private_json(manifest, proof)
        data = dict(repository=str(repository), runtime=str(runtime), project_id=proof['project_id'],
                    pid=os.getpid(), identity=process_identity(os.getpid()), phase='starting',
                    apps={app: app_origin(app, port) for app, port in app_ports.items()})
        # load_session confines the runtime beneath its control directory.
        # The temporary parent holds only this session's logs and runtime.
        data['runtime_parent'] = str(temporary)
        private_json(control / 'session.json', data)
        children = []

        def canceled(_number, _frame):
            raise KeyboardInterrupt

        handlers = {number: signal.signal(number, canceled) for number in (signal.SIGTERM, signal.SIGINT)}
        try:
            def ready(database_environment, _descriptor, workdir, project):
                db.bind_database_environment(environment, database_environment['SUPABASE_URL'],
                    database_environment['SUPABASE_ANON_KEY'], database_environment['SUPABASE_SERVICE_ROLE_KEY'])
                environment['DATABASE_URL'] = database_environment['DATABASE_URL']
                environment['ALTITUTOR_WORKTREE_DEV_MANIFEST'] = str(manifest)
                db.seed(repository, workdir, project)
                with ExitStack() as files:
                    for app, port in app_ports.items():
                        output = files.enter_context((temporary / (app + '.log')).open('w'))
                        command = (['pnpm', '--dir', 'apps/' + app, 'exec', 'next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', str(port)]
                                   if app in WEB_APPS else
                                   ['pnpm', '--dir', 'apps/' + app, 'exec', 'expo', 'start', '--go', '--localhost', '--port', str(port)])
                        app_env = dict(environment, PORT=str(port),
                                       NEXT_DIST_DIR='.next-isolated',
                                       NEXT_PUBLIC_AUTH_COOKIE_NAME=project + '-' + app,
                                       NEXT_PUBLIC_APP_ORIGIN=data['apps'][app],
                                       NEXT_PUBLIC_SITE_URL=data['apps'][app], NEXT_PUBLIC_APP_URL=data['apps'][app])
                        if app in NATIVE_APPS:
                            # Metro's localhost listener must match our IPv4 port leases/URLs.
                            app_env['NODE_OPTIONS'] = '--dns-result-order=ipv4first'
                        child = subprocess.Popen(command, cwd=repository, env=app_env,
                                                 stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
                        children.append(child)
                        files.callback(stop_group, child)
                        data['children'] = [dict(pid=item.pid, identity=process_identity(item.pid)) for item in children]
                        private_json(control / 'session.json', data)
                    deadline = time.monotonic() + 180
                    pending = set(app_ports)
                    while pending:
                        if any(child.poll() is not None for child in children):
                            raise db.Blocked('App exited during startup; logs: ' + str(temporary))
                        for app in list(pending):
                            try:
                                with socket.create_connection(('127.0.0.1', app_ports[app]), timeout=.2):
                                    pending.remove(app)
                            except OSError:
                                pass
                        if time.monotonic() > deadline:
                            raise db.Blocked('Apps did not become ready; logs: ' + str(temporary))
                        time.sleep(.1)
                    data.update(phase='ready', api_url=environment['SUPABASE_URL'], logs=str(temporary))
                    # Executable wrappers may exec into their real runtime
                    # after Popen; record the identity after listeners are live.
                    data['children'] = [dict(pid=item.pid, identity=process_identity(item.pid)) for item in children]
                    private_json(runtime / 'environment.json', environment)
                    private_json(control / 'session.json', data)
                    print(json.dumps({key: data[key] for key in ('phase', 'project_id', 'apps', 'api_url', 'logs')}, indent=2), flush=True)
                    print('Ready. Keep this session running; Ctrl+C or pnpm dev:isolated stop cleans it up.', flush=True)
                    while all(child.poll() is None for child in children):
                        time.sleep(.25)
                    raise db.Blocked('App exited; stopping the isolated environment. Logs: ' + str(temporary))

            with db.claim_ports(app_ports.values()):
                # Pass the sanitized environment to the shared Supabase helper.
                # It supplies only verified local database credentials to ready().
                old_environment = dict(os.environ)
                try:
                    os.environ.clear()
                    os.environ.update(environment)
                    db.consumer(repository, str(manifest), on_ready=ready,
                                before_cleanup=lambda: finish_executions(control, data))
                finally:
                    os.environ.clear()
                    os.environ.update(old_environment)
        finally:
            for number, handler in handlers.items():
                signal.signal(number, handler)
            # Retain evidence if the shared consumer refused scoped cleanup.
            if not list((runtime / 'consumers').glob('*.json')) and not db.project_containers(proof['project_id']):
                (control / 'session.json').unlink(missing_ok=True)
                shutil.rmtree(runtime)
                # Startup/app logs remain available after a failure or shutdown.
            else:
                print('Resources retained; inspect with pnpm dev:isolated status. Proof: ' + str(manifest), file=sys.stderr)


def status(control, repository):
    if not (control / 'session.json').exists():
        return {'phase': 'stopped', 'repository': str(repository)}
    data = load_session(control, repository)
    if not same_process(data['pid'], data['identity']):
        data['phase'] = 'interrupted'
    elif data['phase'] == 'ready':
        runtime = Path(data['runtime'])
        try:
            if db.container(runtime, data['project_id']) != tuple(json.loads((runtime / 'containers.json').read_text())):
                raise db.Blocked('Development containers changed')
        except (db.Blocked, subprocess.CalledProcessError) as error:
            data.update(phase='unhealthy', reason=str(error))
    return {key: value for key, value in data.items() if key not in {'identity'}}


def stop(control, repository):
    if not (control / 'session.json').exists():
        return
    data = load_session(control, repository)
    if same_process(data['pid'], data['identity']):
        os.kill(data['pid'], signal.SIGTERM)
        deadline = time.monotonic() + 90
        while (control / 'session.json').exists() and time.monotonic() < deadline:
            time.sleep(.2)
        if (control / 'session.json').exists():
            raise db.Blocked('Shutdown did not complete; retained ownership evidence: ' + data['runtime'])
        return
    # SIGKILL cannot run finally blocks. Recover only from the private receipt,
    # exact process birth/command identities and unchanged container IDs.
    with db.exclusive(control / 'session.lock', wait=False):
        runtime = Path(data['runtime'])
        with db.exclusive(runtime / 'lifecycle.lock', wait=False):
            finish_executions(control, data)
            for child in data.get('children', []):
                pid = child['pid']
                if not same_process(pid, child['identity']):
                    try:
                        os.killpg(pid, 0)
                    except ProcessLookupError:
                        continue
                    raise db.Blocked('Cannot prove an orphan process group belongs to this session: ' + str(pid))
                os.killpg(pid, signal.SIGTERM)
                deadline = time.monotonic() + 5
                while same_process(pid, child['identity']) and time.monotonic() < deadline:
                    time.sleep(.1)
                try:
                    os.killpg(pid, 0)
                except ProcessLookupError:
                    continue
                os.killpg(pid, signal.SIGKILL)
            records = db.project_containers(data['project_id'])
            if records:
                receipt = runtime / 'containers.json'
                if not receipt.exists():
                    raise db.Blocked('Interrupted container ownership is unproven; retained evidence: ' + str(runtime))
                db.verify_cleanup_receipt(runtime, records)
                executable = repository / 'node_modules/.bin/supabase'
                subprocess.run([str(executable), '--workdir', str(runtime), 'stop',
                                '--project-id', data['project_id'], '--no-backup'],
                               env=local_environment(repository), stdout=subprocess.DEVNULL, check=True)
            (control / 'session.json').unlink()
            shutil.rmtree(runtime)


def execute(control, repository, command):
    data = load_session(control, repository)
    runtime = Path(data['runtime'])
    with execution_lock(runtime, shared=True):
        data = load_session(control, repository)  # Recheck after joining the lease.
        if data['phase'] != 'ready' or not same_process(data['pid'], data['identity']):
            raise db.Blocked('Start an isolated development session before exec')
        if db.container(runtime, data['project_id']) != tuple(json.loads((runtime / 'containers.json').read_text())):
            raise db.Blocked('Owned development containers changed')
        environment = json.loads((runtime / 'environment.json').read_text())
        consumers = runtime / 'consumers'
        consumers.mkdir(exist_ok=True)
        receipt = consumers / (uuid.uuid4().hex + '.json')
        record = dict(pid=os.getpid(), identity=process_identity(os.getpid()), child=None)
        private_json(receipt, record)
        child = None
        def canceled(_number, _frame):
            raise KeyboardInterrupt
        handlers = {number: signal.signal(number, canceled) for number in (signal.SIGTERM, signal.SIGINT)}
        try:
            child = subprocess.Popen(command, cwd=repository, env=environment, start_new_session=True)
            record['child'] = dict(pid=child.pid, identity=group_identity(child.pid))
            private_json(receipt, record)
            while child.poll() is None:
                current = json.loads((control / 'session.json').read_text())
                if current['phase'] != 'ready' or not same_process(data['pid'], data['identity']):
                    raise db.Blocked('Development session stopped during exec')
                time.sleep(.2)
            return child.returncode
        finally:
            if child:
                stop_group(child)
            receipt.unlink(missing_ok=True)
            for number, handler in handlers.items():
                signal.signal(number, handler)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['run', 'status', 'stop', 'exec'], nargs='?', default='run')
    parser.add_argument('--apps', default='ucat-web', help='Comma-separated app directories; all selects all web apps. Native apps include their web backend.')
    parser.add_argument('--skip-install', action='store_true', help='Fail instead of installing missing dependencies')
    parser.add_argument('--repository', default=str(ROOT))
    argv = sys.argv[1:]
    separator = argv.index('--') if '--' in argv else len(argv)
    args = parser.parse_args(argv[:separator])
    repository = Path(args.repository).resolve()
    control = control_directory(repository)
    if args.action == 'run':
        run(repository, selected_apps(args.apps), args.skip_install)
    elif args.action == 'status':
        print(json.dumps(status(control, repository), indent=2))
    elif args.action == 'stop':
        stop(control, repository)
    else:
        command = argv[separator + 1:]
        if not command:
            raise db.Blocked('exec requires -- followed by a command')
        return execute(control, repository, command)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print('Isolated development session stopped; owned cleanup attempted.', file=sys.stderr)
        sys.exit(130)
    except (db.Blocked, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print('Isolated development blocked: ' + str(error), file=sys.stderr)
        sys.exit(1)
