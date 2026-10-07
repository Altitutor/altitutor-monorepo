#!/usr/bin/env python3
"""Reproduce OAuth refresh after portal logout against disposable LOCAL fixtures.

Requires the local supabase_auth_altitutor-admin-app Docker container. Starts a
second Auth instance with OAuth enabled on loopback port 59999, reusing its local
DB and signing configuration. Creates and deletes only its own test user/client;
never reads production credentials or prints tokens. Run from the repository:

    python3 scripts/diagnostics/oauth-refresh-logout.py
"""
import base64
import hashlib
import hmac
import http.client
import json
import os
import secrets
import subprocess
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
NAME = 'altitutor-oauth-refresh-probe-' + secrets.token_hex(4)
BASE = 'http://127.0.0.1:59999'

def docker(*args):
    p = subprocess.run(['docker', *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError('Docker operation failed: ' + args[0])
    return p.stdout

class NoRedirect(urllib.request.HTTPRedirectHandler):

    def redirect_request(self, *args):
        return None
opener = urllib.request.build_opener(NoRedirect)

def req(path, data=None, token=None, form=False, method=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    if data is not None:
        headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
        data = urllib.parse.urlencode(data).encode() if form else json.dumps(data).encode()
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        resp = opener.open(r, timeout=10)
        status = resp.status
    except urllib.error.HTTPError as e:
        resp = e
        status = e.code
    body = resp.read().decode()
    try:
        body = json.loads(body) if body else {}
    except ValueError:
        body = {}
    return (status, body, resp.headers)

def b64(v):
    return base64.urlsafe_b64encode(v).decode().rstrip('=')
d = json.loads(docker('inspect', 'supabase_auth_altitutor-admin-app'))[0]
env = dict((v.split('=', 1) for v in d['Config']['Env']))
env.update({'GOTRUE_OAUTH_SERVER_ENABLED': 'true', 'GOTRUE_OAUTH_SERVER_AUTHORIZATION_PATH': '/oauth/consent', 'API_EXTERNAL_URL': BASE, 'GOTRUE_SITE_URL': BASE, 'GOTRUE_URI_ALLOW_LIST': BASE + '/**', 'GOTRUE_DB_CLEANUP_ENABLED': 'false'})
network = next(iter(d['NetworkSettings']['Networks']))
head = b64(json.dumps({'alg': 'HS256', 'typ': 'JWT'}).encode())
claims = b64(json.dumps({'role': 'service_role', 'iss': 'supabase', 'exp': int(time.time()) + 600}).encode())
admin = head + '.' + claims + '.' + b64(hmac.new(env['GOTRUE_JWT_SECRET'].encode(), (head + '.' + claims).encode(), hashlib.sha256).digest())
user = None
client = None
envpath = None
container_started = False
try:
    with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
        envpath = f.name
        os.chmod(envpath, 0o600)
        for k, v in env.items():
            f.write(k + '=' + v + '\n')
    docker('run', '--detach', '--name', NAME, '--network', network, '--publish', '127.0.0.1:59999:9999', '--env-file', envpath, d['Config']['Image'])
    container_started = True
    os.unlink(envpath)
    envpath = None
    for _ in range(30):
        try:
            if req('/health')[0] == 200:
                break
        except (urllib.error.URLError, TimeoutError, http.client.HTTPException):
            time.sleep(0.2)
    else:
        raise RuntimeError('Temporary local Auth instance did not become healthy')
    email = 'oauth-probe-' + secrets.token_hex(6) + '@example.invalid'
    password = secrets.token_urlsafe(24)
    status, data, _ = req('/admin/users', {'email': email, 'password': password, 'email_confirm': True}, admin)
    assert status in (200, 201), ('create fixture user', status, data.get('msg'))
    user = data['id']
    status, data, _ = req('/admin/oauth/clients', {'client_name': 'Temporary OAuth refresh probe', 'redirect_uris': [BASE + '/callback'], 'grant_types': ['authorization_code', 'refresh_token'], 'client_type': 'public', 'token_endpoint_auth_method': 'none'}, admin)
    assert status in (200, 201), ('register client', status, data.get('msg'))
    client = data.get('client_id', data.get('id'))
    assert client
    for scope in ['global', 'local']:
        status, portal, _ = req('/token?grant_type=password', {'email': email, 'password': password})
        assert status == 200, ('portal login', status)
        verifier = secrets.token_urlsafe(48)
        params = {'response_type': 'code', 'client_id': client, 'redirect_uri': BASE + '/callback', 'code_challenge': b64(hashlib.sha256(verifier.encode()).digest()), 'code_challenge_method': 'S256', 'scope': 'email'}
        status, data, headers = req('/oauth/authorize?' + urllib.parse.urlencode(params))
        assert status in (302, 303), ('authorize', status, data.get('msg'))
        authorization = urllib.parse.parse_qs(urllib.parse.urlparse(headers['Location']).query)['authorization_id'][0]
        status, data, _ = req('/oauth/authorizations/' + authorization, token=portal['access_token'])
        assert status == 200, ('authorization details', status, data.get('msg'))
        if not data.get('redirect_url'):
            status, data, _ = req('/oauth/authorizations/' + authorization + '/consent', {'action': 'approve'}, portal['access_token'])
            assert status == 200, ('consent', status, data.get('msg'))
        code = urllib.parse.parse_qs(urllib.parse.urlparse(data['redirect_url']).query)['code'][0]
        status, oauth, _ = req('/oauth/token', {'grant_type': 'authorization_code', 'code': code, 'client_id': client, 'redirect_uri': BASE + '/callback', 'code_verifier': verifier}, form=True)
        assert status == 200, ('code exchange', status, oauth.get('error'))
        status, oauth, _ = req('/oauth/token', {'grant_type': 'refresh_token', 'refresh_token': oauth['refresh_token'], 'client_id': client}, form=True)
        assert status == 200, ('baseline refresh', status, oauth.get('error'))
        print(scope + ': OAuth code exchange and baseline refresh PASS', flush=True)
        status, data, _ = req('/logout' + ('' if scope == 'global' else '?scope=local'), token=portal['access_token'], data={})
        assert status == 204, ('logout', status)
        status, data, _ = req('/oauth/token', {'grant_type': 'refresh_token', 'refresh_token': oauth['refresh_token'], 'client_id': client}, form=True)
        print(scope + ': refresh after portal logout = ' + str(status) + ' ' + str(data.get('error_code', data.get('error', 'OK'))), flush=True)
        assert status == (400 if scope == 'global' else 200), ('post logout refresh', scope, status)
    print('PASS: default logout reproduces OAuth refresh failure; local logout preserves OAuth refresh', flush=True)
finally:
    if user:
        try:
            req('/admin/users/' + user, token=admin, method='DELETE')
        except (urllib.error.URLError, TimeoutError, http.client.HTTPException):
            print('WARNING: local fixture cleanup request failed', flush=True)
    if client:
        try:
            req('/admin/oauth/clients/' + client, token=admin, method='DELETE')
        except (urllib.error.URLError, TimeoutError, http.client.HTTPException):
            print('WARNING: local fixture cleanup request failed', flush=True)
    if envpath:
        os.unlink(envpath)
    if container_started:
        subprocess.run(['docker', 'rm', '--force', NAME], capture_output=True)
