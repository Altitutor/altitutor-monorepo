// Run through pnpm dev:isolated exec; argument is the owned native fixture receipt.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash, randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(process.env.SUPABASE_URL, owned.SUPABASE_URL);
assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
const fixture = JSON.parse(fs.readFileSync(process.argv[2]));
assert.equal(fixture.project, proof.project_id);
assert.equal(fixture.origin, owned.NEXT_PUBLIC_TUTOR_WEB_URL);
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(fixture.origin).hostname));
async function call(endpoint, token, body) {
  const response = await fetch(fixture.origin + '/api/teaching/' + endpoint, {
    signal: AbortSignal.timeout(120000), method: body ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  return { status: response.status, body: result };
}
async function signIn(tutor) {
  const signed = await call('auth', null, { action: 'signIn', email: tutor.email, password: tutor.password });
  assert.equal(signed.status, 200, 'owned tutor sign-in');
  return signed.body.credentials.accessToken;
}
const token = await signIn(fixture.first), otherToken = await signIn(fixture.second);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, owned.SUPABASE_SERVICE_ROLE_KEY);
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function data(result) { if (result.error) throw new Error(result.error.message); return result.data; }
const template = (await call('sessions?day=' + fixture.day, token)).body.find(row => row.id === fixture.previewSession);
const catalogResource = (await call('resources?resourceID=' + fixture.resource, token)).body.resources[0];
const peerStudentID = randomUUID();
data(await admin.from('students').insert({ id: peerStudentID, first_name: 'Jordan', last_name: 'Preview', status: 'ACTIVE', account_class: 'internal_test' }));
const testSessionID = randomUUID();
data(await admin.from('sessions').insert({ id: testSessionID, type: 'DRAFTING', status: 'ACTIVE', subject_id: catalogResource.subjectID,
  start_at: new Date(Date.now() - 60000).toISOString(), end_at: new Date(Date.now() + 1740000).toISOString(), room: 'Fictional document API test' }));
data(await admin.from('sessions_staff').insert(template.staff.map(person => ({ session_id: testSessionID, staff_id: person.id, type: person.type }))));
data(await admin.from('sessions_students').insert([...template.students.map(person => ({ session_id: testSessionID, student_id: person.id })), { session_id: testSessionID, student_id: peerStudentID }]));
const bytes = fs.readFileSync(path.join(path.dirname(process.argv[2]), 'worksheet.pdf'));
const uploadInput = { sessionID: testSessionID, documentID: randomUUID(), purpose: 'print',
  filename: 'Lesson print.pdf', sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
const staging = await Promise.all([call('uploads', token, uploadInput), call('uploads', token, uploadInput)]);
assert.equal(staging[0].body.id, staging[1].body.id, 'concurrent staging keeps one immutable identity');
const staged = staging[0];
assert.equal(staged.status, 201, 'assigned tutor can stage a private PDF snapshot');
assert.equal(typeof staged.body.id, 'string');
assert.equal(typeof staged.body.uploadURL, 'string');
assert.equal((await call('uploads/' + staged.body.id + '/complete', token, {})).status, 409, 'incomplete upload cannot be verified');
const uploaded = await fetch(staged.body.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes });
assert.equal(uploaded.status, 200, 'signed upload accepts the exact PDF bytes');
const completions = await Promise.all(Array.from({ length: 8 }, () => call('uploads/' + staged.body.id + '/complete', token, {})));
assert.ok(completions.every(result => result.status === 200), 'concurrent verification requests all recover the same completed upload: ' + completions.map(result => result.status));
const completed = completions[0];
assert.equal(completed.status, 200, 'owner can verify the uploaded PDF snapshot');
assert.equal(completed.body.id, staged.body.id);
assert.equal(completed.body.state, 'ready');
assert.equal((await call('uploads', null, uploadInput)).status, 401, 'staging requires authentication');
assert.equal((await call('uploads', otherToken, uploadInput)).status, 403, 'other tutors cannot stage into this lesson');
assert.equal((await call('uploads/' + staged.body.id + '/complete', otherToken, {})).status, 404, 'verification is private to the uploader');
assert.equal((await call('uploads', token, { ...uploadInput, purpose: 'lesson', canonicalResourceID: fixture.solution })).status, 403, 'solution snapshots are not shareable');
const settings = data(await admin.from('office_print_settings').select('tutor_access').eq('singleton', true).single());
const connectorID = 'teaching-documents-test-' + randomUUID();
let jobID;
try {
  data(await admin.from('print_connector_state').insert({ connector_id: connectorID, status: 'healthy', last_heartbeat_at: new Date().toISOString() }));
  data(await admin.from('office_print_settings').update({ tutor_access: 'unrestricted' }).eq('singleton', true));
  const printAttempts = await Promise.all([call('prints', token, { artifactID: staged.body.id, copies: 2 }), call('prints', token, { artifactID: staged.body.id, copies: 2 })]);
  assert.deepEqual(printAttempts.map(result => result.status).sort(), [201, 400], 'concurrent enqueue creates exactly one print job');
  const queued = printAttempts.find(result => result.status === 201);
  assert.equal(queued.status, 201, 'verified local PDF can use the existing office queue');
  jobID = queued.body.id;
  assert.equal(queued.body.status, 'queued');
  assert.equal(queued.body.copies, 2);
  assert.equal((await call('prints/' + jobID, otherToken)).status, 404, 'print status remains requester-private');
  assert.equal((await call('prints', token, { artifactID: staged.body.id, copies: 2 })).status, 400, 'duplicate print is suppressed');
} finally {
  if (jobID) data(await admin.from('print_jobs').update({ status: 'cancelled', completed_at: new Date().toISOString() }).eq('id', jobID));
  data(await admin.from('office_print_settings').update({ tutor_access: settings.tutor_access }).eq('singleton', true));
  data(await admin.from('print_connector_state').delete().eq('connector_id', connectorID));
}
const lessonInput = { ...uploadInput, documentID: randomUUID(), purpose: 'lesson', canonicalResourceID: fixture.resource };
const lessonUpload = await call('uploads', token, lessonInput);
assert.equal(lessonUpload.status, 201);
assert.equal((await fetch(lessonUpload.body.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf', 'x-upsert': 'false' }, body: bytes })).status, 200);
assert.equal((await call('uploads/' + lessonUpload.body.id + '/complete', token, {})).status, 200);
const localInput = { ...uploadInput, documentID: randomUUID(), purpose: 'lesson', filename: 'Imported lesson notes.pdf' };
const badUpload = await call('uploads', token, localInput);
assert.equal(badUpload.status, 201);
assert.equal((await fetch(badUpload.body.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.concat([bytes, Buffer.from('wrong')]) })).status, 200);
assert.equal((await call('uploads/' + badUpload.body.id + '/complete', token, {})).status, 400, 'mismatched uploaded bytes are rejected');
const localUpload = await call('uploads', token, localInput);
assert.equal(localUpload.status, 201);
assert.notEqual(localUpload.body.id, badUpload.body.id, 'quarantined bytes cannot trap a correct retry');
assert.equal((await fetch(localUpload.body.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes })).status, 200);
assert.equal((await call('uploads/' + localUpload.body.id + '/complete', token, {})).status, 200);
const session = (await call('sessions?day=' + fixture.day, token)).body.find(row => row.id === testSessionID);
const resource = (await call('resources?resourceID=' + fixture.resource, token)).body.resources[0];
const studentIDs = session.students.map(student => student.id);
const logInput = { sessionId: session.id, submissionID: randomUUID(),
  staffAttendance: session.staff.map(person => ({ staffId: person.id, type: person.type, attended: true })),
  studentAttendance: studentIDs.map(studentId => ({ studentId, attended: true })), parentAttendance: [],
  topics: [{ topicId: resource.topicID, studentIds: studentIDs }],
  topicFiles: [{ topicsFilesId: fixture.resource, topicId: resource.topicID, studentIds: studentIDs }],
  notes: ['Synthetic annotated-file publishing verification.'],
  annotatedFiles: [lessonUpload, localUpload].map(upload => ({ artifactID: upload.body.id, studentIds: template.students.map(person => person.id) })),
};
const privateBeforeSubmit = await call('lesson-documents?sessionID=' + session.id, token);
assert.deepEqual(privateBeforeSubmit.body, [], 'staged PDFs are not published');
const missingCanonical = await call('logs', token, { ...logInput, topicFiles: [] });
assert.equal(missingCanonical.status, 400, 'annotation requires its canonical selection');
assert.equal((await call('logs/' + session.id, token)).status, 404, 'failed publication does not leave a partial tutor log');
const publications = await Promise.all([call('logs', token, logInput), call('logs', token, logInput)]);
assert.ok(publications.every(result => result.status === 200), 'concurrent identical log submissions succeed idempotently');
const published = publications[0];
assert.equal(published.status, 200, 'a verified annotation publishes atomically with the confirmed tutor log');
assert.equal(published.body.success, true);
const shared = await call('lesson-documents?sessionID=' + session.id, token);
assert.equal(shared.status, 200);
assert.equal(shared.body.find(row => row.id === lessonUpload.body.id)?.canonicalResourceID, fixture.resource);
assert.equal(shared.body.find(row => row.id === localUpload.body.id)?.canonicalResourceID, null, 'local notes publish without any catalog identity');
const link = await call('lesson-documents/' + lessonUpload.body.id, token);
assert.equal(link.status, 200, 'authorized tutor can open the submitted PDF');
assert.deepEqual(Buffer.from(await (await fetch(link.body.url)).arrayBuffer()), bytes);
assert.equal((await call('lesson-documents/' + lessonUpload.body.id, otherToken)).status, 404, 'unrelated tutor cannot download the submitted PDF');
assert.equal((await call('logs', token, logInput)).status, 200, 'same submission is idempotent after a lost response');
assert.equal((await call('logs', token, { ...logInput, notes: ['Changed after submission'] })).status, 409, 'different payload cannot overwrite a saved submission');
const restaged = await call('uploads', token, lessonInput);
assert.equal(restaged.body.id, lessonUpload.body.id, 're-upload retry keeps the published immutable snapshot identity');
assert.equal(restaged.body.uploadURL, null);
assert.equal((await call('uploads/' + restaged.body.id + '/complete', token, {})).status, 200);
async function studentIdentity(studentID) {
  const email = 'lesson-student-' + randomUUID() + '@example.test', password = randomBytes(24).toString('hex');
  const user = data(await admin.auth.admin.createUser({ email, password, email_confirm: true })).user;
  data(await admin.from('students').update({ user_id: user.id, email }).eq('id', studentID));
  const client = createClient(owned.SUPABASE_URL, owned.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = data(await client.auth.signInWithPassword({ email, password }));
  return { client, token: signed.session.access_token, email, password };
}
const assignedStudent = await studentIdentity(template.students[0].id), unassignedAttendee = await studentIdentity(peerStudentID);
async function studentCall(endpoint, studentToken) {
  const response = await fetch(owned.NEXT_PUBLIC_STUDENT_WEB_URL + '/api/lesson-documents' + endpoint, {
    signal: AbortSignal.timeout(120000), headers: studentToken ? { Authorization: 'Bearer ' + studentToken } : {},
  });
  return { status: response.status, body: await response.json() };
}
assert.equal((await studentCall('/' + lessonUpload.body.id)).status, 401, 'student downloads require authentication');
const studentLink = await studentCall('/' + lessonUpload.body.id, assignedStudent.token);
assert.equal(studentLink.status, 200, 'assigned attendee can download the submitted snapshot');
assert.deepEqual(Buffer.from(await (await fetch(studentLink.body.url)).arrayBuffer()), bytes);
assert.deepEqual(data(await assignedStudent.client.from('vstudent_topics_files').select('id').eq('id', fixture.resource)), [], 'fixture has no general catalog entitlement');
assert.equal((await studentCall('/' + localUpload.body.id, assignedStudent.token)).status, 200, 'assigned attendee can access imported lesson notes');
assert.equal((await studentCall('/' + lessonUpload.body.id, unassignedAttendee.token)).status, 404, 'attendance alone does not grant this PDF');
assert.deepEqual((await studentCall('?sessionID=' + session.id, unassignedAttendee.token)).body, [], 'unassigned attendee sees no shared PDF metadata');
const originalExpiry = data(await admin.from('teaching_documents').select('expires_at').eq('id', lessonUpload.body.id).single()).expires_at;
data(await admin.from('teaching_documents').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('id', lessonUpload.body.id));
assert.equal((await studentCall('/' + lessonUpload.body.id, assignedStudent.token)).status, 410, 'expiry revokes downloads immediately');
assert.equal((await studentCall('?sessionID=' + session.id, assignedStudent.token)).body.find(row => row.id === lessonUpload.body.id)?.available, false, 'expired reference is shown without a download');
data(await admin.from('teaching_documents').update({ expires_at: originalExpiry }).eq('id', lessonUpload.body.id));
fs.writeFileSync(path.join(path.dirname(process.argv[2]), 'shared-lesson-fixture.json'), JSON.stringify({ project: proof.project_id,
  tutorOrigin: fixture.origin, studentOrigin: owned.NEXT_PUBLIC_STUDENT_WEB_URL, sessionID: session.id,
  documentID: lessonUpload.body.id, assignedStudent: { email: assignedStudent.email, password: assignedStudent.password },
}), { mode: 0o600 });
console.log(JSON.stringify({ ownedProject: proof.project_id, privateUploadStaging: true, verifiedPrivateSnapshot: true, localOfficePrint: true, atomicLogPublication: true, publicationRetries: true, studentRecipients: true, independentOfCatalog: true, immediateExpiry: true, realPrinterUsed: false }));
