import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Exercise the actual shell script with fake deployment endpoints and fixture secrets.
// No live credentials or network are used.
test('targeted reporting deployment sends distinct credentials only to admin-web and leaves other secrets untouched', () => {
  const root = mkdtempSync(join(tmpdir(), 'admin-secret-routing-'));
  try {
    const scripts = join(root, 'secrets/scripts');
    const bin = join(root, 'bin');
    mkdirSync(scripts, { recursive: true });
    mkdirSync(bin);
    for (const name of ['deploy-vercel.sh', 'common.sh']) {
      copyFileSync(fileURLToPath(new URL(name, import.meta.url)), join(scripts, name));
    }
    for (const environment of ['development', 'production']) {
      writeFileSync(join(root, `secrets/.env.${environment}`), `ADMIN_REPORTING_DATABASE_URL=postgres://admin_reporting_reader:${environment}@example.test/postgres?sslmode=verify-full\nOPENROUTER_API_KEY=must-not-deploy\n`);
    }
    writeFileSync(join(root, 'secrets/.env.shared'), 'VERCEL_TOKEN=fixture-only\n');
    writeFileSync(join(bin, 'vercel'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
    writeFileSync(join(bin, 'jq'), `#!/usr/bin/env node
let input=''; process.stdin.on('data', chunk => input+=chunk); process.stdin.on('end', () => console.log(JSON.parse(input).id || ''));
`, { mode: 0o755 });
    writeFileSync(join(bin, 'curl'), `#!/usr/bin/env node
const fs=require('node:fs');const args=process.argv.slice(2);const url=args.at(-1);
if(args.includes('-X')) {
 const payload=JSON.parse(args[args.indexOf('-d')+1]);
 fs.appendFileSync(process.env.TEST_REQUEST_LOG, JSON.stringify({url,payload})+'\\n');
 console.log(JSON.stringify({created:true}));
} else {
 if(!url.includes('/projects/altitutor-admin-web?')) process.exit(99);
 console.log(JSON.stringify({id:'admin-project'}));
}
`, { mode: 0o755 });
    const log = join(root, 'requests.jsonl');
    const result = spawnSync('bash', [join(scripts, 'deploy-vercel.sh'), '--only', 'ADMIN_REPORTING_DATABASE_URL'], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, TEST_REQUEST_LOG: log, VERCEL_TOKEN: 'fixture-only', DEBUG_VERCEL: '' },
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const requests = readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests.map(r => r.payload.target), [['preview'], ['production']]);
    assert.deepEqual(requests.map(r => r.payload.value), [
      'postgres://admin_reporting_reader:development@example.test/postgres?sslmode=verify-full',
      'postgres://admin_reporting_reader:production@example.test/postgres?sslmode=verify-full',
    ]);
    for (const request of requests) {
      assert.match(request.url, /\/projects\/admin-project\/env\?/);
      assert.equal(request.payload.key, 'ADMIN_REPORTING_DATABASE_URL');
      assert.equal(request.payload.type, 'encrypted');
      assert.ok(!result.stdout.includes(request.payload.value));
    }
    for (const environment of ['development', 'production']) {
      assert.ok(!readFileSync(join(root, `secrets/.env.${environment}`), 'utf8').includes('CRON_SECRET'));
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
