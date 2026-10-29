// Run only via: pnpm dev:isolated exec -- node apps/teaching-ipad/Verification/owned-api.mjs
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
const owned = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(process.env.SUPABASE_URL, owned.SUPABASE_URL);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, owned.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
const origin = owned.NEXT_PUBLIC_TUTOR_WEB_URL;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
// Local CLI stacks initialize storage after migrations; their dashboard-managed policies are absent.
// Install only the repository's existing tutor resource SELECT contract in this proven disposable stack.
const { spawnSync } = await import('node:child_process');
const database = new URL(owned.DATABASE_URL);
assert.equal(database.hostname, '127.0.0.1');
const policy = spawnSync('psql', ['-XAt', '-v', 'ON_ERROR_STOP=1', '-c', `
DO $fixture$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Teaching fixture tutor read') THEN
    CREATE POLICY "Teaching fixture tutor read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'resources' AND (SELECT public.can_tutor_read_file(name)));
  END IF;
END $fixture$;`], { encoding: 'utf8', env: { ...process.env, PGHOST: database.hostname, PGPORT: database.port,
  PGDATABASE: database.pathname.slice(1), PGUSER: database.username, PGPASSWORD: decodeURIComponent(database.password) } });
assert.equal(policy.status, 0, 'Could not prepare owned storage fixture: ' + policy.stderr);

function data(result, label) {
  if (result.error) throw new Error(label + ': ' + result.error.message);
  return result.data;
}
async function call(endpoint, token, body) {
  const response = await fetch(origin + '/api/teaching/' + endpoint, {
    signal: AbortSignal.timeout(120000),
    method: body ? 'POST' : 'GET', headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let result; try { result = JSON.parse(text); } catch { throw new Error(endpoint.split('?')[0] + ' returned non-JSON HTTP ' + response.status); }
  return { status: response.status, body: result };
}
async function tutor(name) {
  const email = 'teaching-' + randomUUID() + '@example.test', password = randomBytes(24).toString('hex');
  const user = data(await admin.auth.admin.createUser({ email, password, email_confirm: true }), 'create fixture identity').user;
  const id = randomUUID();
  data(await admin.from('staff').insert({ id, user_id: user.id, email, first_name: name, last_name: 'Preview', role: 'TUTOR', status: 'ACTIVE' }), 'create fixture tutor');
  const signed = await call('auth', null, { action: 'signIn', email, password });
  assert.equal(signed.status, 200, 'native sign-in: ' + signed.body.error);
  return { id, email, password, token: signed.body.credentials.accessToken, refreshToken: signed.body.credentials.refreshToken };
}
const first = await tutor('Alex'), second = await tutor('Taylor');
const subject = randomUUID(), topic = randomUUID(), student = randomUUID();
data(await admin.from('subjects').insert({ id: subject, name: 'Mathematics preview', short_name: 'PREVIEW-' + subject.slice(0, 8), year_level: 12 }), 'subject');
data(await admin.from('staff_subjects').insert({ staff_id: first.id, subject_id: subject }), 'tutor subject');
data(await admin.from('topics').insert({ id: topic, subject_id: subject, name: 'Differentiation', index: 1, code: 'PREV' + topic.slice(0, 6) }), 'topic');
data(await admin.from('students').insert({ id: student, first_name: 'Casey', last_name: 'Learner', status: 'ACTIVE', account_class: 'internal_test' }), 'student');
const primary = randomUUID(), solution = randomUUID();
const buckets = data(await admin.storage.listBuckets(), 'list local buckets');
const bucket = 'resources';
if (!buckets.some(b => b.id === bucket)) data(await admin.storage.createBucket(bucket, { public: false }), 'fixture bucket');
for (const [id, filename, isSolution] of [[primary, 'worksheet.pdf', false], [solution, 'solutions.pdf', true]]) {
  const bytes = fs.readFileSync('/private/tmp/' + filename), file = randomUUID(), key = subject + '/' + topic + '/' + file + '.pdf';
  data(await admin.storage.from(bucket).upload(key, bytes, { contentType: 'application/pdf' }), 'fixture PDF upload');
  data(await admin.from('files').insert({ id: file, filename: isSolution ? 'Worked solutions.pdf' : 'Differentiation practice.pdf', mimetype: 'application/pdf', size_bytes: bytes.length, bucket, storage_path: key, storage_provider: 'supabase', created_by: first.id }), 'fixture file');
  data(await admin.from('topics_files').insert({ id, topic_id: topic, file_id: file, type: 'PRACTICE_QUESTIONS', index: 1, code: isSolution ? 'SOLUTION' : 'PRACTICE', is_solutions: isSolution, is_solutions_of_id: isSolution ? primary : null }), 'fixture resource');
}
async function session(type = 'DRAFTING', role = 'MAIN_TUTOR', actor = first.id) {
  const id = randomUUID(), start = new Date(Date.now() - 3600000), end = new Date(Date.now() - 1800000);
  data(await admin.from('sessions').insert({ id, type, status: 'ACTIVE', subject_id: type === 'DRAFTING' ? subject : null, start_at: start.toISOString(), end_at: end.toISOString(), room: 'Preview room' }), 'fixture session');
  data(await admin.from('sessions_staff').insert({ session_id: id, staff_id: actor, type: role }), 'fixture assignment');
  if (type === 'DRAFTING') data(await admin.from('sessions_students').insert({ session_id: id, student_id: student }), 'fixture student assignment');
  return id;
}
const preview = await session(), verification = await session(), checkIn = await session('CHECK_IN', 'CHECK_IN_RECEIVER', second.id);
const homework = await session('HOMEWORK_HELP');
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Adelaide', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
fs.writeFileSync('/private/tmp/dev219-native-fixture.json', JSON.stringify({ origin, project: proof.project_id, day, previewSession: preview, verificationSession: verification, first, second, resource: primary, solution }), { mode: 0o600 });
assert.equal((await call('profile')).status, 401, 'cookie-less requests must sign in');
assert.equal((await call('profile', 'forged')).status, 401, 'forged tokens must fail');
const sessions = await call('sessions?day=' + day, first.token);
assert.equal(sessions.status, 200, sessions.body.error);
assert.ok(sessions.body.some(s => s.id === preview && s.kind === 'DRAFTING'), 'all assigned session kinds visible');
const otherSessions = await call('sessions?day=' + day, second.token);
assert.ok(!otherSessions.body.some(s => s.id === preview), 'other tutor cannot see first tutor lesson');
const catalog = await call('resources?subjectID=' + subject.toUpperCase(), first.token);
assert.equal(catalog.status, 200, catalog.body.error);
assert.equal(catalog.body.resources.find(r => r.id === primary)?.solutions?.id, solution);
const exact = await call('resources?resourceID=' + primary, first.token);
assert.deepEqual(exact.body.resources.map(r => r.id), [primary], 'fresh copy reloads current resource metadata');
assert.equal((await call('students?sessionID=' + homework + '&query=Casey', second.token)).status, 403, 'student search requires lesson assignment');
const candidates = await call('students?sessionID=' + homework + '&query=Casey', first.token);
assert.equal(candidates.status, 200, candidates.body.error);
assert.ok(candidates.body.some(s => s.id === student), 'Homework Help can find a drop-in');
assert.equal((await call('students', first.token, {sessionId: homework, studentId: student})).status, 200, 'drop-in can join Homework Help');
assert.equal((await call('documents/' + primary, second.token)).status, 404, 'other subject resource is inaccessible');
const download = await call('documents/' + primary, first.token);
assert.equal(download.status, 200, download.body.error);
assert.equal((await fetch(download.body.url)).status, 200, 'caller-scoped signed download works');
const input = { sessionId: verification, staffAttendance: [{ staffId: first.id, type: 'MAIN_TUTOR', attended: true }], studentAttendance: [{ studentId: student, attended: true }], parentAttendance: [], topics: [{ topicId: topic, studentIds: [student] }], topicFiles: [{ topicsFilesId: primary, topicId: topic, studentIds: [student] }], notes: ['Synthetic API verification only.'] };
assert.equal((await call('logs', first.token, { ...input, createdBy: second.id })).status, 400, 'cannot choose another submitter');
assert.equal((await call('logs', second.token, input)).status, 403, 'unassigned tutor cannot submit');
assert.equal((await call('logs', first.token, { ...input, studentAttendance: [{ studentId: randomUUID(), attended: true }] })).status, 409, 'foreign roster is rejected');
const nativeInput = JSON.parse(JSON.stringify(input).replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, value => value.toUpperCase()));
const logged = await call('logs', first.token, nativeInput);
assert.equal(logged.status, 200, logged.body.error);
assert.equal((await call('logs', first.token, input)).status, 409, 'duplicate submission is rejected');
const readLog = await call('logs/' + verification, first.token);
assert.equal(readLog.body.created_by, first.id, 'authenticated submitter is preserved');
assert.equal(readLog.body.files.length, 1, 'confirmed worksheet is in log');
const checkInput = { sessionId: checkIn, staffAttendance: [{ staffId: second.id, type: 'CHECK_IN_RECEIVER', attended: true }], studentAttendance: [], parentAttendance: [], topics: [], topicFiles: [], notes: [] };
assert.equal((await call('logs', second.token, checkInput)).status, 403, 'receiving tutor cannot submit Check-in log');
const refreshed = await call('auth', null, { action: 'refresh', refreshToken: first.refreshToken });
assert.equal(refreshed.status, 200, 'native token refresh works');
const receipt = { origin, project: proof.project_id, day, previewSession: preview, verificationSession: verification, first, second, resource: primary, solution };
fs.writeFileSync('/private/tmp/dev219-native-fixture.json', JSON.stringify(receipt), { mode: 0o600 });
console.log(JSON.stringify({ ownedProject: proof.project_id, nativeSignIn: true, tokenRefresh: true, assignedKinds: true, isolatedSessions: true, resourceACL: true, signedDownloads: true, serverSubmitter: true, rosterValidation: true, duplicateProtection: true, checkInRole: true, previewSession: preview }));
