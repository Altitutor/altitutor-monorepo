#!/usr/bin/env python3
"""Reject unowned targets before the generation integration suite sends HTTP."""
import fcntl
import json
import os
from pathlib import Path
import sys
from urllib.parse import urlparse

import owned_database as db
import worktree_dev as dev


def verify(repository, target):
    manifest = os.environ.get('ALTITUTOR_WORKTREE_DEV_MANIFEST') or os.environ.get('ALTITUTOR_TEST_DB_MANIFEST')
    workdir, project = db.owned_manifest(manifest, repository)
    if db.container(workdir, project) != tuple(json.loads((workdir / 'containers.json').read_text())):
        raise db.Blocked('Study-plan test containers changed')
    _, _, _, api_port = db.configuration(workdir)
    url = urlparse(target)
    if url.scheme != 'http' or url.hostname not in {'localhost', '127.0.0.1'} or str(url.port) != api_port:
        raise db.Blocked('Study-plan test target does not match the owned API port')
    lock = workdir / 'lifecycle.lock'
    if os.environ.get('ALTITUTOR_WORKTREE_DEV_MANIFEST'):
        session = dev.load_session(dev.control_directory(repository), repository)
        if (Path(session['runtime']) != workdir or session['phase'] != 'ready'
                or not dev.same_process(session['pid'], session['identity'])):
            raise db.Blocked('Study-plan development session is not ready')
        lock = workdir / 'executions.lock'
    # The outer owned runner/dev exec must retain its lease while Jest runs.
    with lock.open('r+') as stream:
        try:
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        raise db.Blocked('Study-plan tests must run inside the owned execution lease')


if __name__ == '__main__':
    try:
        verify(Path(__file__).resolve().parent.parent, sys.argv[1])
    except (db.Blocked, OSError, ValueError, KeyError, IndexError) as error:
        sys.exit('Study-plan integration blocked: ' + str(error))
