// Current log corrections/retirement must revoke links; run only in the owned runtime.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID, randomBytes } from 'node:crypto';
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(process.env.SUPABASE_URL, owned.SUPABASE_URL);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, owned.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
const native = JSON.parse(fs.readFileSync(process.argv[2]));
const shared = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[2]), 'shared-lesson-fixture.json')));
assert.equal(native.project, proof.project_id); assert.equal(shared.project, proof.project_id);
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, options);
function data(result) { if (result.error) throw new Error(result.error.message); return result.data; }
async function identity(person) {
  const client = createClient(owned.SUPABASE_URL, owned.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
  return data(await client.auth.signInWithPassword({ email: person.email, password: person.password })).session.access_token;
}
const studentToken = await identity(shared.assignedStudent), tutorToken = await identity(native.first);
async function status(audience, id=shared.documentID) {
  return (await fetch((audience === 'student' ? shared.studentOrigin : shared.tutorOrigin) + '/api/lesson-documents/' + id,
    { headers: { Authorization: 'Bearer ' + (audience === 'student' ? studentToken : tutorToken) } })).status;
}
assert.equal(await status('student'), 200); assert.equal(await status('tutor'), 200);
const document = data(await admin.from('teaching_documents').select('tutor_log_id,canonical_topics_file_id').eq('id', shared.documentID).single());
const detail = data(await admin.from('tutor_logs_topics_files').select('id').eq('tutor_log_id', document.tutor_log_id).eq('topics_files_id', document.canonical_topics_file_id).single());
const student = data(await admin.from('students').select('id').eq('email', shared.assignedStudent.email).single());
const assignment = data(await admin.from('tutor_logs_topics_files_students').select('*').eq('tutor_logs_topics_files_id', detail.id).eq('student_id', student.id).single());
try {
  data(await admin.from('tutor_logs_topics_files_students').delete().eq('tutor_logs_topics_files_id', detail.id).eq('student_id', student.id));
  assert.equal(await status('student'), 404, 'removing canonical assignment revokes its paired annotation');
  assert.equal(await status('tutor'), 200, 'session tutor retains log access');
} finally { data(await admin.from('tutor_logs_topics_files_students').insert(assignment)); }
assert.equal(await status('student'), 200);
// Use the real retirement commands; direct deleted_at changes are intentionally guarded.
const email = 'lesson-retention-admin-' + randomUUID() + '@example.test', password = randomBytes(24).toString('hex');
const actor = data(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
data(await admin.from('staff').insert({ id: randomUUID(), user_id: actor.id, email, first_name: 'Fictional', last_name: 'Retention reviewer', role: 'ADMINSTAFF', status: 'ACTIVE' }));
const command = createClient(owned.SUPABASE_URL, owned.NEXT_PUBLIC_SUPABASE_ANON_KEY, options);
data(await command.auth.signInWithPassword({ email, password }));
const originalSession = data(await admin.from('sessions').select('end_at').eq('id', shared.sessionID).single());
try {
  data(await admin.from('sessions').update({ end_at: new Date(Date.now() - 60000).toISOString() }).eq('id', shared.sessionID));
  assert.equal(await status('student'), 200); assert.equal(await status('tutor'), 200);
  for (const [kind, id] of [['tutor_log', document.tutor_log_id], ['session', shared.sessionID]]) {
    try {
      data(await command.rpc('retire_business_record', { p_kind: kind, p_id: id }));
      assert.equal(await status('student'), 404, 'retiring ' + kind + ' revokes student download');
      assert.equal(await status('tutor'), 404, 'retiring ' + kind + ' revokes tutor download');
    } finally { data(await command.rpc('restore_business_record', { p_kind: kind, p_id: id })); }
  }
} finally { data(await admin.from('sessions').update(originalSession).eq('id', shared.sessionID)); }
assert.equal(await status('student'), 200); assert.equal(await status('tutor'), 200);
console.log(JSON.stringify({ ownedProject: proof.project_id, canonicalCorrectionRevokesStudent: true, retiredLogRevokesBoth: true, retiredSessionRevokesBoth: true, restoredAccess: true }));
