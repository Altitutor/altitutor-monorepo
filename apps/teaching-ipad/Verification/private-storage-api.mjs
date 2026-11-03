// Exercise legacy permissive Storage policies only inside the proven disposable runtime.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(owned.SUPABASE_URL, process.env.SUPABASE_URL);
assert.equal(owned.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
const db = new URL(owned.DATABASE_URL);
assert.equal(db.hostname, '127.0.0.1'); assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
const native = JSON.parse(fs.readFileSync(process.argv[2]));
const shared = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[2]), 'shared-lesson-fixture.json')));
assert.equal(native.project, proof.project_id); assert.equal(shared.project, proof.project_id);
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, options);
const unrelated = createClient(owned.SUPABASE_URL, owned.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const signed = await unrelated.auth.signInWithPassword({ email: native.second.email, password: native.second.password });
assert.equal(signed.error, null);
const artifact = await admin.from('teaching_documents').select('bucket,storage_path').eq('id', shared.documentID).single();
assert.equal(artifact.error, null);
function sql(statement) {
  const result = spawnSync('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-c', statement], { encoding: 'utf8', env: { ...process.env,
    PGHOST: db.hostname, PGPORT: db.port, PGDATABASE: db.pathname.slice(1), PGUSER: db.username, PGPASSWORD: decodeURIComponent(db.password) } });
  assert.equal(result.status, 0, 'Owned policy fixture failed: ' + result.stderr);
}
try {
  sql(`CREATE POLICY "Teaching legacy permissive fixture" ON storage.objects FOR ALL TO authenticated
       USING (bucket_id IN ('teaching-print','teaching-lessons')) WITH CHECK (bucket_id IN ('teaching-print','teaching-lessons'));`);
  assert.ok((await unrelated.storage.from(artifact.data.bucket).download(artifact.data.storage_path)).error,
    'unrelated tutor cannot directly read a private lesson snapshot even with a permissive legacy policy');
  const bytes = fs.readFileSync(path.join(path.dirname(process.argv[2]), 'worksheet.pdf'));
  assert.ok((await unrelated.storage.from('teaching-print').upload('forged-' + randomUUID() + '.pdf', bytes, { contentType: 'application/pdf' })).error,
    'authenticated client cannot bypass server staging and write private objects directly');
  assert.equal((await admin.storage.from(artifact.data.bucket).download(artifact.data.storage_path)).error, null, 'server access remains available');
} finally { sql('DROP POLICY IF EXISTS "Teaching legacy permissive fixture" ON storage.objects;'); }
// Deploy ordering is fail-closed: no signed upload is issued without the guard.
assert.equal((await admin.rpc('teaching_private_storage_ready')).data, true);
const first = createClient(owned.SUPABASE_URL, owned.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
const owner = await first.auth.signInWithPassword({ email: native.first.email, password: native.first.password });
assert.equal(owner.error, null);
const snapshot = fs.readFileSync(path.join(path.dirname(process.argv[2]), 'worksheet.pdf'));
sql('DROP POLICY teaching_private_server_only ON storage.objects;');
try {
  const response = await fetch(native.origin + '/api/teaching/uploads', { method: 'POST',
    headers: { Authorization: 'Bearer ' + owner.data.session.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionID: shared.sessionID, documentID: randomUUID(), purpose: 'print', filename: 'Guard verification.pdf',
      sizeBytes: snapshot.length, sha256: createHash('sha256').update(snapshot).digest('hex') }),
  });
  assert.equal(response.status, 503, 'missing private guard prevents issuing an upload URL');
} finally { sql(fs.readFileSync('supabase/scripts/teaching-private-storage.sql', 'utf8')); }
assert.equal((await admin.rpc('teaching_private_storage_ready')).data, true);
console.log(JSON.stringify({ ownedProject: proof.project_id, legacyPolicyReadDenied: true, directWriteDenied: true, serviceReadAllowed: true, missingGuardFailsClosed: true }));
