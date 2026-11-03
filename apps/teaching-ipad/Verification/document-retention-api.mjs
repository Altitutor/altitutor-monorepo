// Run through dev:isolated exec after documents-api.mjs; all clock fixtures are disposable.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(owned.SUPABASE_URL, process.env.SUPABASE_URL);
assert.equal(owned.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
const native = JSON.parse(fs.readFileSync(process.argv[2]));
const shared = JSON.parse(fs.readFileSync(path.join(path.dirname(process.argv[2]), 'shared-lesson-fixture.json')));
assert.equal(native.project, proof.project_id); assert.equal(shared.project, proof.project_id);
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const { expireTeachingDocuments } = require('@altitutor/shared/teaching/server');
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function data(result) { if (result.error) throw new Error(result.error.message); return result.data; }
const bytes = fs.readFileSync(path.join(path.dirname(process.argv[2]), 'worksheet.pdf'));
const original = data(await admin.from('teaching_documents').select('tutor_log_id,canonical_topics_file_id').eq('id', shared.documentID).single());
const ago = hours => new Date(Date.now() - hours * 3600000).toISOString();
async function oldArtifact(purpose) {
  const id = randomUUID(), bucket = purpose === 'print' ? 'teaching-print' : 'teaching-lessons';
  const storagePath = native.first.id + '/' + id + '.pdf';
  data(await admin.storage.from(bucket).upload(storagePath, bytes, { contentType: 'application/pdf' }));
  data(await admin.from('teaching_documents').insert({ id, owner_staff_id: native.first.id, session_id: shared.sessionID,
    document_id: randomUUID(), purpose, filename: 'Fictional retention PDF.pdf', size_bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'), bucket, storage_path: storagePath,
    created_at: ago(72), verified_at: ago(72), expires_at: ago(48), state: purpose === 'print' ? 'ready' : 'published',
    ...(purpose === 'lesson' ? { tutor_log_id: original.tutor_log_id, canonical_topics_file_id: original.canonical_topics_file_id, published_at: ago(366 * 24) } : {}),
  }));
  return { id, bucket, storagePath };
}
const expiredLesson = await oldArtifact('lesson'), queuedPrint = await oldArtifact('print');
const fileID = randomUUID(), jobID = randomUUID();
data(await admin.from('files').insert({ id: fileID, filename: 'Fictional retention PDF.pdf', mimetype: 'application/pdf',
  size_bytes: bytes.length, bucket: queuedPrint.bucket, storage_path: queuedPrint.storagePath, storage_provider: 'supabase', created_by: native.first.id }));
data(await admin.from('teaching_documents').update({ file_id: fileID }).eq('id', queuedPrint.id));
data(await admin.from('print_jobs').insert({ id: jobID, file_id: fileID, bucket: queuedPrint.bucket, storage_path: queuedPrint.storagePath,
  filename: 'Fictional retention PDF.pdf', copies: 1, requested_by_staff_id: native.first.id, status: 'queued', created_at: ago(72) }));
async function exists(artifact) { return !(await admin.storage.from(artifact.bucket).download(artifact.storagePath)).error; }
assert.equal(await exists(expiredLesson), true); assert.equal(await exists(queuedPrint), true);
await expireTeachingDocuments(admin);
assert.equal(await exists(expiredLesson), false, 'expired lesson PDF bytes are deleted through Storage API');
assert.equal(await exists(queuedPrint), true, 'queued print bytes never expire');
data(await admin.from('print_jobs').update({ status: 'claimed', claimed_at: new Date().toISOString() }).eq('id', jobID));
await expireTeachingDocuments(admin);
assert.equal(await exists(queuedPrint), true, 'in-progress print bytes never expire');
data(await admin.from('print_jobs').update({ status: 'succeeded', completed_at: ago(23) }).eq('id', jobID));
await expireTeachingDocuments(admin);
assert.equal(await exists(queuedPrint), true, 'terminal job retains bytes for the full 24 hours');
data(await admin.from('print_jobs').update({ completed_at: ago(25) }).eq('id', jobID));
await expireTeachingDocuments(admin);
assert.equal(await exists(queuedPrint), false, 'terminal print bytes expire after 24 hours');
const audit = data(await admin.from('print_jobs').select('id,status,filename').eq('id', jobID).single());
assert.equal(audit.status, 'succeeded', 'print audit survives blob cleanup');
console.log(JSON.stringify({ ownedProject: proof.project_id, expiredLessonDeleted: true, queuedRetained: true, claimedRetained: true, full24HourGrace: true, printAuditRetained: true }));
