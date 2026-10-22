"""Disposable Supabase ownership and independent runtime consumer leases.

Ordinary Docker/Supabase with per-runtime locks; no daemon or network customization.
Unproven targets fail closed.
Python 3.9+; only the project's literal identity/port fields are parsed here.
"""
import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import signal
import socket
import time
import stat
import subprocess
import sys
import tempfile
import uuid
from urllib.parse import urlparse

PREVIEW_LOCK = Path('/tmp/altitutor-prototype-preview.lock')
PREFIX = 'altitutor-agent-test-'
ROOT = Path(__file__).resolve().parents[1]


class Blocked(RuntimeError):
    pass


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def tree_digest(root):
    result = hashlib.sha256()
    for path in sorted(root.rglob('*')):
        if any(part in {'.temp', '.branches'} for part in path.relative_to(root).parts):
            continue
        if path.is_symlink():
            raise Blocked('Disposable Supabase source must not contain symlinks')
        if path.is_file() and not path.name.startswith('.env'):
            result.update(str(path.relative_to(root)).encode() + b'\0' + path.read_bytes())
    return result.hexdigest()


def configuration(workdir):
    path = workdir / 'supabase/config.toml'
    text = path.read_text()
    project = re.findall(r'^project_id\s*=\s*"([a-zA-Z0-9_-]+)"\s*(?:#.*)?$', text, re.M)
    db = re.search(r'^\[db\]\s*\n(.*?)(?=^\[|\Z)', text, re.M | re.S)
    api = re.search(r'^\[api\]\s*\n(.*?)(?=^\[|\Z)', text, re.M | re.S)
    if len(project) != 1 or not db or not api:
        raise Blocked('Exact literal project_id, [api] and [db] configuration required')
    def port(section):
        values = re.findall(r'^port\s*=\s*(\d+)\s*(?:#.*)?$', section[1], re.M)
        if len(values) != 1:
            raise Blocked('Exact literal database/API port required')
        return values[0]
    return path, project[0], port(db), port(api)


def free_ports(count, excluded=()):
    """Keep all probes bound until the complete set has been allocated."""
    probes = []
    ports = []
    try:
        while len(ports) < count:
            probe = socket.socket()
            probe.bind(('127.0.0.1', 0))
            probes.append(probe)
            port = probe.getsockname()[1]
            if port not in excluded:
                ports.append(port)
        return ports
    finally:
        for probe in probes:
            probe.close()


def configured_ports(workdir):
    text = (workdir / 'supabase/config.toml').read_text()
    return [int(value) for value in re.findall(
        r'^(?:port|shadow_port|inspector_port)\s*=\s*(\d+)\s*(?:#.*)?$', text, re.M)
        if int(value) != 587]  # External SMTP destination, not a local listener.


@contextmanager
def claim_ports(ports):
    """Independent kernel leases prevent our runtimes sharing a listener."""
    from contextlib import ExitStack
    with ExitStack() as leases:
        for port in sorted(ports):
            leases.enter_context(exclusive(Path(tempfile.gettempdir()) /
                ('altitutor-local-port-' + str(port) + '.lock'), wait=False))
            with socket.socket() as probe:
                try:
                    probe.bind(('127.0.0.1', port))
                except OSError as error:
                    raise Blocked('Allocated port occupied; retry with a fresh runtime: ' + str(port)) from error
        yield


def prepare(repository, workdir):
    if workdir.exists() or workdir == repository or repository in workdir.parents:
        raise Blocked('Use a fresh disposable runtime directory outside the checkout')
    workdir.mkdir(mode=0o700, parents=True)
    shutil.copytree(repository / 'supabase', workdir / 'supabase',
                    ignore=shutil.ignore_patterns('.temp', '.branches', '.env*'))
    # Edge Function imports outside supabase must also exist in the runtime.
    for relative in ['packages/shared/src/observability/sentry-collection.ts',
                     'packages/shared/src/supabase/generated.ts']:
        source = repository / relative
        if source.is_file():
            target = workdir / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, target)
    path = workdir / 'supabase/config.toml'
    text = re.sub(r'^project_id\s*=.*$', 'project_id = "' + PREFIX + uuid.uuid4().hex[:8] + '"',
                  path.read_text(), count=1, flags=re.M)
    # Allocate every host listener, including the Edge inspector. SMTP's 587
    # is an outbound destination and must not be rewritten.
    listeners = re.findall(r'^(?:port|shadow_port|inspector_port)\s*=\s*(\d+)\s*(?:#.*)?$', text, re.M)
    ports = iter(free_ports(sum(int(value) != 587 for value in listeners)))
    text = re.sub(r'^((?:port|shadow_port|inspector_port)\s*=\s*)(\d+)(\s*(?:#.*)?)$',
                  lambda match: match[1] + (str(next(ports)) if int(match[2]) != 587 else match[2]) + match[3],
                  text, flags=re.M)
    path.write_text(text)
    _, project, _, _ = configuration(workdir)
    manifest = dict(role='disposable-test', repository=str(repository), workdir=str(workdir),
                    project_id=project, config_sha256=digest(path),
                    source_tree_sha256=tree_digest(repository / 'supabase'),
                    prepared_tree_sha256=tree_digest(workdir / 'supabase'))
    target = workdir / 'ownership.json'
    target.write_text(json.dumps(manifest, indent=2) + '\n')
    return target


def owned_manifest(manifest_path, repository, *, check_source=True):
    if not manifest_path:
        raise Blocked('Database work requires a disposable ALTITUTOR_TEST_DB_MANIFEST; shared DB is forbidden')
    path = Path(manifest_path).resolve()
    data = json.loads(path.read_text())
    workdir = Path(data['workdir']).resolve()
    config, project, _, _ = configuration(workdir)
    if (data.get('role') != 'disposable-test' or not project.startswith(PREFIX)
            or len(project) > 31 or data.get('project_id') != project
            or workdir == repository or repository in workdir.parents
            or path.parent != workdir or data.get('repository') != str(repository)
            or digest(config) != data.get('config_sha256')
            or (check_source and tree_digest(repository / 'supabase') != data.get('source_tree_sha256'))
            or tree_digest(workdir / 'supabase') != data.get('prepared_tree_sha256')):
        raise Blocked('Disposable ownership manifest/config/schema does not match this checkout')
    return workdir, project


@contextmanager
def exclusive(path, *, wait=True):
    descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(descriptor)
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid():
            raise Blocked('Database lock must be a regular file owned by this user')
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            if not wait:
                raise Blocked('Consumer already owns the common lifecycle lock (' + path.name + ')')
            print('Waiting for this runtime\'s database lock', file=sys.stderr, flush=True)
            fcntl.flock(descriptor, fcntl.LOCK_EX)
        yield descriptor
    finally:
        os.close(descriptor)


def inspect_container(name):
    result = subprocess.run(['docker', 'inspect', name], capture_output=True, text=True)
    if result.returncode:
        raise Blocked('Exact owned container unavailable; start the owned disposable stack first')
    data = json.loads(result.stdout)
    if len(data) != 1:
        raise Blocked('Ambiguous owned container identity')
    return data[0]


def container(workdir, project, *, ci=False):
    _, configured, db_port, api_port = configuration(workdir)
    if configured != project or (not ci and not project.startswith(PREFIX)):
        raise Blocked('Shared development project cannot be used for disposable tests')
    ids = []
    for service, internal, expected in [('db', '5432/tcp', db_port), ('kong', '8000/tcp', api_port)]:
        name = 'supabase_' + service + '_' + project
        record = inspect_container(name)
        bindings = record.get('NetworkSettings', {}).get('Ports', {}).get(internal) or []
        if (record.get('Name') != '/' + name or not record.get('Id')
                or not record.get('State', {}).get('Running')
                or record.get('Config', {}).get('Labels', {}).get('com.supabase.cli.project') != project
                or not bindings or any(binding.get('HostPort') != expected for binding in bindings)):
            raise Blocked('Exact owned container/project/port verification failed')
        ids.append(record['Id'])
    if not ci:
        result = subprocess.check_output(['docker', 'ps', '--filter', 'label=com.supabase.cli.project=' + project,
                                          '--format', '{{.ID}}'], text=True)
        for identifier in result.split():
            record = inspect_container(identifier)
            if record.get('Config', {}).get('Labels', {}).get('com.supabase.cli.project') != project:
                raise Blocked('Container project ownership changed')
            if record.get('Id') not in ids:
                ids.append(record.get('Id'))
    return tuple(ids[:2] + sorted(ids[2:]))


def ci_owned(repository):
    return (sys.platform == 'linux' and os.environ.get('GITHUB_ACTIONS') == 'true'
            and os.environ.get('RUNNER_ENVIRONMENT') == 'github-hosted'
            and os.environ.get('GITHUB_RUN_ID') and os.environ.get('GITHUB_WORKSPACE') == str(repository)
            and Path(os.environ.get('RUNNER_WORKSPACE', '/nonexistent')).resolve() in repository.parents)


def verify_inner(repository, manifest_path):
    workdir, project = owned_manifest(manifest_path, repository)
    descriptor = int(os.environ.get('ALTITUTOR_DB_LOCK_FD', '-1'))
    inherited, current = os.fstat(descriptor), (workdir / 'lifecycle.lock').stat()
    if (inherited.st_dev, inherited.st_ino) != (current.st_dev, current.st_ino):
        raise Blocked('Missing exact inherited lifecycle lock')
    fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
    if Path(shutil.which('supabase') or '').resolve() != workdir / 'bin/supabase':
        raise Blocked('Supabase CLI must use the owned-workdir wrapper')
    if container(workdir, project) != tuple(json.loads((workdir / 'containers.json').read_text())):
        raise Blocked("Owned database container replaced; fresh ownership readback required")
    return workdir, project


def reset(repository, manifest_path):
    workdir, project = verify_inner(repository, manifest_path)
    # Supabase resets legitimately recreate API service containers. Only this
    # successful, locked reset can advance the identity receipt.
    executable = os.environ['ALTITUTOR_SUPABASE_EXECUTABLE']
    subprocess.run([executable, '--workdir', str(workdir), 'db', 'reset', '--local'], check=True,
                   env=supabase_environment())
    owned_manifest(manifest_path, repository)
    identifiers = container(workdir, project)
    (workdir / 'containers.json').write_text(json.dumps(identifiers))


def run_child(command, repository, environment, descriptor, *, quiet=False):
    child = subprocess.Popen(command, cwd=repository, env=environment, pass_fds=(descriptor,), start_new_session=True,
                             stdout=subprocess.DEVNULL if quiet else None)
    def cancel(_number, _frame):
        raise KeyboardInterrupt
    old = {number: signal.signal(number, cancel) for number in (signal.SIGINT, signal.SIGTERM)}
    try:
        result = child.wait()
        if result:
            raise Blocked('Owned database consumer failed (exit ' + str(result) + ')')
    finally:
        # Descendant app servers must end before the DB lease is released,
        # even when their immediate shell has already exited.
        try:
            os.killpg(child.pid, signal.SIGTERM)
            child.wait(timeout=5)
            for _ in range(50):
                try:
                    os.killpg(child.pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(.02)
            else:
                os.killpg(child.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        except subprocess.TimeoutExpired:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait()
        for number, handler in old.items():
            signal.signal(number, handler)


def supabase_environment():
    # CLI metadata must not require writes outside the disposable workspace.
    return dict(os.environ, SUPABASE_TELEMETRY_DISABLED='1')


def clean_environment():
    environment = dict(os.environ)
    prefixes = ('DATABASE_URL', 'UCAT_E2E_', 'ADMIN_E2E_', 'STUDENT_E2E_', 'TUTOR_E2E_', 'MARKETING_E2E_', 'SUPABASE_', 'NEXT_PUBLIC_SUPABASE_', 'EXPO_PUBLIC_SUPABASE_',
                'SENTRY_', 'NEXT_PUBLIC_SENTRY_', 'EXPO_PUBLIC_SENTRY_', 'POSTHOG_',
                'NEXT_PUBLIC_POSTHOG_', 'EXPO_PUBLIC_POSTHOG_')
    for key in list(environment):
        if key.startswith(prefixes):
            environment.pop(key)
    environment.update(SENTRY_DISABLED='true', NEXT_PUBLIC_SENTRY_DISABLED='true',
                       EXPO_PUBLIC_SENTRY_DISABLED='true', NEXT_TELEMETRY_DISABLED='1',
                       SUPABASE_TELEMETRY_DISABLED='1')
    return environment


def bind_database_environment(environment, url, public_key, service_key):
    environment.update(NEXT_PUBLIC_SUPABASE_URL=url, SUPABASE_URL=url,
                       NEXT_PUBLIC_SUPABASE_ANON_KEY=public_key, SUPABASE_ANON_KEY=public_key,
                       SUPABASE_SERVICE_ROLE_KEY=service_key, SUPABASE_SECRET_KEY=service_key,
                       EXPO_PUBLIC_SUPABASE_URL=url, EXPO_PUBLIC_SUPABASE_ANON_KEY=public_key,
                       UCAT_E2E_SUPABASE_URL=url, UCAT_E2E_PUBLIC_KEY=public_key,
                       UCAT_E2E_SERVICE_ROLE_KEY=service_key)
    for app in ['ADMIN', 'STUDENT', 'TUTOR', 'MARKETING']:
        environment.update({app + '_E2E_SUPABASE_URL': url,
                            app + '_E2E_PUBLIC_KEY': public_key,
                            app + '_E2E_SERVICE_ROLE_KEY': service_key})


def preview(repository, app, manifest_path):
    if app not in {'admin-web', 'student-web', 'tutor-web', 'marketing-web', 'ucat-web'}:
        raise Blocked('Select an existing web app for the normal foreground preview')
    if not (repository / 'apps' / app).is_dir():
        raise Blocked('Selected preview app is absent')
    command = ['pnpm', '--dir', 'apps/' + app, 'exec', 'next', 'dev',
               '--hostname', '127.0.0.1', '--port', '57340']
    with exclusive(PREVIEW_LOCK, wait=False) as descriptor:
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 57340))
        if manifest_path:
            consumer(repository, manifest_path, command)
        else:
            environment = clean_environment()
            bind_database_environment(environment, 'http://127.0.0.1:1', 'synthetic-preview', 'synthetic-preview')
            run_child(command, repository, environment, descriptor)


def project_containers(project):
    result = subprocess.run(['docker', 'ps', '-a', '--filter',
                             'label=com.supabase.cli.project=' + project,
                             '--format', '{{.ID}}'], capture_output=True, text=True, check=True)
    records = [inspect_container(identifier) for identifier in result.stdout.split()]
    for record in records:
        if (record.get('Config', {}).get('Labels', {}).get('com.supabase.cli.project') != project
                or not record.get('Name', '').startswith('/supabase_')
                or not record.get('Name', '').endswith('_' + project)):
            raise Blocked('Disposable project container ownership mismatch')
    return records


def verify_cleanup_receipt(workdir, records):
    """Exact IDs remain proof even when an owned service has stopped/crashed."""
    expected = json.loads((workdir / 'containers.json').read_text())
    actual = [record.get('Id') for record in records]
    if len(actual) != len(expected) or set(actual) != set(expected):
        raise Blocked('Owned database container replaced; cleanup requires fresh ownership proof')


def consumer(repository, manifest_path, command=None, *, on_ready=None, before_cleanup=None):
    workdir, project = owned_manifest(manifest_path, repository)
    with exclusive(workdir / 'lifecycle.lock') as descriptor, claim_ports(configured_ports(workdir)):
        owned_manifest(manifest_path, repository)
        installed = repository / 'node_modules/.bin/supabase'
        executable = str(installed) if installed.is_file() else shutil.which('supabase')
        if not executable:
            raise Blocked('Supabase CLI missing')
        shim = workdir / 'bin'
        shim.mkdir(exist_ok=True)
        wrapper = shim / 'supabase'
        wrapper.write_text('#!/bin/sh\n'
                           'if [ "$*" = "db reset --local" ]; then\n'
                           '  exec ' + shlex.quote(sys.executable) + ' ' + shlex.quote(str(Path(__file__).resolve())) +
                           ' reset --repository ' + shlex.quote(str(repository)) + '\nfi\n'
                           'exec ' + shlex.quote(executable) + ' --workdir ' + shlex.quote(str(workdir)) + ' "$@"\n')
        wrapper.chmod(0o700)
        environment = clean_environment()
        environment.update(PATH=str(shim) + os.pathsep + environment['PATH'],
                           ALTITUTOR_TEST_DB_MANIFEST=str(Path(manifest_path).resolve()),
                           ALTITUTOR_DB_LOCK_FD=str(descriptor), ALTITUTOR_OWNED_DB_INNER='1',
                           ALTITUTOR_SUPABASE_EXECUTABLE=executable,
                           SENTRY_DISABLED='true', NEXT_PUBLIC_SENTRY_DISABLED='true',
                           EXPO_PUBLIC_SENTRY_DISABLED='true', NEXT_TELEMETRY_DISABLED='1')
        identifier = None
        # Refuse to adopt a leftover stack, even if its project name matches.
        if project_containers(project):
            raise Blocked('Disposable project already exists; inspect the interrupted run before recovery')
        try:
            run_child([executable, '--workdir', str(workdir), 'start', '--exclude',
                       'studio,imgproxy,logflare,vector,postgres-meta,mailpit'], repository,
                      environment, descriptor, quiet=True)
            identifier = container(workdir, project)
            (workdir / 'containers.json').write_text(json.dumps(identifier))
            # Bind every app/E2E consumer to this verified API; never inherit a
            # deployment URL or allow .env files to choose another database.
            status_result = subprocess.run([executable, '--workdir', str(workdir), 'status', '-o', 'env'],
                                           capture_output=True, text=True, check=True, env=environment)
            values = {}
            for line in status_result.stdout.splitlines():
                if '=' in line:
                    key, value = line.split('=', 1)
                    values[key.strip()] = value.strip().strip('"')
            url = values.get('API_URL', '')
            parsed = urlparse(url)
            _, _, _, api_port = configuration(workdir)
            if (parsed.scheme != 'http' or parsed.hostname not in {'127.0.0.1', 'localhost', '::1'}
                    or str(parsed.port) != api_port or parsed.username or parsed.password
                    or parsed.query or parsed.fragment):
                raise Blocked('Owned API status URL must match the verified loopback port')
            public_key = values.get('ANON_KEY') or values.get('PUBLISHABLE_KEY')
            service_key = values.get('SERVICE_ROLE_KEY') or values.get('SECRET_KEY')
            if not public_key or not service_key:
                raise Blocked('Owned API status missing local test keys')
            bind_database_environment(environment, url, public_key, service_key)
            database_url = values.get('DB_URL', '')
            database = urlparse(database_url)
            if (database.scheme not in {'postgres', 'postgresql'}
                    or database.hostname not in {'127.0.0.1', 'localhost', '::1'}
                    or str(database.port) != configuration(workdir)[2]
                    or database.path != '/postgres' or database.query or database.fragment):
                raise Blocked('Owned database status URL must match the verified loopback DB port')
            environment['DATABASE_URL'] = database_url
            if on_ready:
                on_ready(environment, descriptor, workdir, project)
            else:
                run_child(command, repository, environment, descriptor)
        finally:
            if before_cleanup:
                before_cleanup()
            # Never adopt a replacement/foreign stack merely because its name matches.
            # Development agents may edit migrations while a snapshot is live.
            # Cleanup proves the runtime, not equality with the edited source.
            owned_manifest(manifest_path, repository, check_source=False)
            records = project_containers(project)
            if identifier is not None:
                verify_cleanup_receipt(workdir, records)
            if records:
                run_child([executable, '--workdir', str(workdir), 'stop',
                           '--project-id', project, '--no-backup'], repository,
                          environment, descriptor, quiet=True)


def seed(repository, workdir, project, *, ci=False):
    identifier = container(workdir, project, ci=ci)[0]
    files = sorted((repository / 'supabase/seed/test-ucat').glob('*.sql'))
    if not files:
        raise Blocked('No UCAT fixture files found')
    for path in files:
        if container(workdir, project, ci=ci)[0] != identifier:
            raise Blocked('Owned database container replaced during seed')
        with path.open('rb') as source:
            subprocess.run(['docker', 'exec', '-i', identifier, 'psql', '-U', 'postgres', '-d', 'postgres',
                            '-v', 'ON_ERROR_STOP=1', '-q'], stdin=source, check=True)


def generate_types(repository):
    target = repository / 'packages/shared/src/supabase/generated.ts'
    result = subprocess.run(['supabase', 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
                            capture_output=True, check=True, env=supabase_environment())
    temporary = target.with_suffix('.ts.owned-tmp')
    temporary.write_bytes(result.stdout)
    os.replace(temporary, target)
    subprocess.run(['pnpm', 'turbo', 'run', 'build', '--filter=@altitutor/shared'], cwd=repository, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['prepare', 'gate', 'seed', 'types', 'committypes', 'verify-inner', 'run', 'preview', 'reset'])
    parser.add_argument('--repository', default=str(ROOT))
    parser.add_argument('--manifest', default=os.environ.get('ALTITUTOR_TEST_DB_MANIFEST'))
    parser.add_argument('--workdir')
    parser.add_argument('--app')
    argv = sys.argv[1:]
    separator = argv.index('--') if '--' in argv else len(argv)
    command_arguments = argv[separator + 1:]
    args = parser.parse_args(argv[:separator])
    repository = Path(args.repository).resolve()
    if args.action == 'prepare':
        if not args.workdir:
            raise Blocked('Fresh --workdir required for disposable preparation')
        print(prepare(repository, Path(args.workdir).resolve()))
        return
    if args.action == 'preview':
        preview(repository, args.app, args.manifest)
        return
    inner = os.environ.get('ALTITUTOR_OWNED_DB_INNER') == '1'
    if args.action == 'verify-inner' or inner:
        workdir, project = verify_inner(repository, args.manifest)
        if args.action == 'reset':
            reset(repository, args.manifest)
        elif args.action == 'seed':
            seed(repository, workdir, project)
        elif args.action in {'types', 'committypes'}:
            if args.action == 'committypes':
                reset(repository, args.manifest)
                container(workdir, project)
                subprocess.run(['supabase', 'db', 'lint', '--local', '--level=error', '--fail-on', 'error'], check=True,
                               env=supabase_environment())
            generate_types(repository)
            if args.action == 'committypes':
                subprocess.run(['git', 'add', 'packages/shared/src/supabase/generated.ts'], cwd=repository, check=True)
                if subprocess.run(['git', 'diff', '--cached', '--quiet', '--', 'packages/shared/src/supabase/generated.ts'], cwd=repository).returncode:
                    subprocess.run(['git', 'commit', '-m', 'chore: regenerate types', '--', 'packages/shared/src/supabase/generated.ts'], cwd=repository, check=True)
        elif args.action != 'verify-inner':
            raise Blocked('Nested database consumer is not supported')
        return
    if args.action == 'reset':
        raise Blocked('Reset requires the inherited owned database lock')
    if args.action in {'seed', 'types'} and ci_owned(repository):
        _, project, _, _ = configuration(repository)
        with exclusive(Path(tempfile.gettempdir()) / ('altitutor-ci-' + project + '.lock')):
            container(repository, project, ci=True)
            if args.action == 'seed':
                seed(repository, repository, project, ci=True)
            else:
                generate_types(repository)
        return
    command = ([ 'bash', 'scripts/checkall.sh', '--database-only'] if args.action == 'gate' else
               [sys.executable, str(Path(__file__).resolve()), args.action, '--repository', str(repository)])
    if args.action == 'run':
        command = command_arguments
        if not command:
            raise Blocked('Foreground owned database consumer command required')
    if args.manifest:
        consumer(repository, args.manifest, command)
    else:
        # Each invocation supplies its own current source, identity and ports.
        temporary = Path(tempfile.mkdtemp(prefix='altitutor-db-'))
        manifest = prepare(repository, temporary / 'runtime')
        try:
            consumer(repository, str(manifest), command)
        except BaseException:
            print('Retained disposable ownership proof: ' + str(manifest), file=sys.stderr)
            raise
        else:
            shutil.rmtree(temporary)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('Owned database consumer canceled; cleanup attempted under lock', file=sys.stderr)
        sys.exit(130)
    except (Blocked, OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print('Database work blocked: ' + str(error), file=sys.stderr)
        sys.exit(1)
