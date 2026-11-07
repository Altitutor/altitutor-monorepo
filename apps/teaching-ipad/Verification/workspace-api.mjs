// Run only via pnpm dev:isolated exec with the owned Teaching fixture receipt.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const fixturePath = process.argv[2];
const fixture = JSON.parse(readFileSync(fixturePath));
const manifest = process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST;
const proof = JSON.parse(readFileSync(manifest));
const owned = JSON.parse(readFileSync(join(dirname(manifest), 'environment.json')));
assert.equal(proof.repository, process.cwd());
assert.equal(proof.project_id, fixture.project);
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(owned.NEXT_PUBLIC_TUTOR_WEB_URL, fixture.origin);
assert.equal(process.env.SUPABASE_URL, owned.SUPABASE_URL);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, owned.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(new URL(owned.SUPABASE_URL).hostname, '127.0.0.1');
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(fixture.origin).hostname));
const { createClient } = createRequire(join(process.cwd(), 'apps/tutor-web/package.json'))('@supabase/supabase-js');
const admin = createClient(owned.SUPABASE_URL, owned.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function data(result) {
  assert.equal(result.error, null, result.error?.message);
  return result.data;
}
async function call(endpoint, token, payload) {
  const response = await fetch(fixture.origin + '/api/teaching/' + endpoint, {
    method: payload ? 'POST' : 'GET',
    headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(60_000),
  });
  return { status: response.status, body: await response.json() };
}
async function signIn({ email, password }) {
  const result = await call('auth', null, { action: 'signIn', email, password });
  assert.equal(result.status, 200, result.body.error);
  return result.body.credentials.accessToken;
}
const first = await signIn(fixture.first), secondDevice = await signIn(fixture.first);
const coTutor = await signIn(fixture.second);
assert.notEqual(first, secondDevice, 'the same tutor signs in on two independent devices');
const source = (await call('resources?resourceID=' + fixture.resource, first)).body.resources[0];
assert.equal(source.resourceType, 'PRACTICE_QUESTIONS');
assert.equal(source.resourceIndex, 1);

const classID = randomUUID();
data(await admin.from('classes').insert({
  id: classID, subject_id: source.subjectID, day_of_week: 1, start_time: '16:00', end_time: '17:30',
  status: 'ACTIVE', session_start_date: '2026-01-01', session_end_date: '2026-12-31',
  long_name: 'Fictional document sync class',
}));
async function classSession(hoursAgo) {
  const id = randomUUID();
  const start = Date.now() - hoursAgo * 3_600_000;
  data(await admin.from('sessions').insert({
    id, class_id: classID, subject_id: source.subjectID, type: 'CLASS', status: 'ACTIVE',
    start_at: new Date(start).toISOString(), end_at: new Date(start + 1_800_000).toISOString(),
  }));
  data(await admin.from('sessions_staff').insert([
    { session_id: id, staff_id: fixture.first.id, type: 'MAIN_TUTOR' },
    { session_id: id, staff_id: fixture.second.id, type: 'SECONDARY_TUTOR' },
  ]));
  return id;
}
const previous = await classSession(24), current = await classSession(0);
const workspace = id => 'workspace?sessionID=' + id;
const previousLesson = 'previous-lesson?sessionID=' + current;
assert.deepEqual((await call(workspace(current), first)).body, []);
assert.equal((await call(workspace(current))).status, 401);
assert.equal((await call('previous-lesson?sessionID=' + fixture.previewSession, first)).body, null, 'sessions without a class have no previous section');

async function upload(documentID, filename, bytes) {
  const staged = await call('uploads', first, {
    sessionID: previous, documentID, purpose: 'workspace', filename, sizeBytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
  assert.equal(staged.status, 201, staged.body.error);
  assert.equal((await fetch(staged.body.uploadURL, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: bytes })).status, 200);
  const complete = await call('uploads/' + staged.body.id + '/complete', first, {});
  assert.equal(complete.status, 200, complete.body.error);
  return staged.body.id;
}
const worksheetBytes = readFileSync(join(dirname(fixturePath), 'worksheet.pdf'));
const solutionBytes = readFileSync(join(dirname(fixturePath), 'solutions.pdf'));
const item = { id: randomUUID(), resource: source,
  worksheet: { id: randomUUID(), source: source.worksheet },
  solutions: { id: randomUUID(), source: source.solutions },
};
const worksheetArtifactID = await upload(item.worksheet.id, 'Worksheet original.pdf', worksheetBytes);
const solutionsArtifactID = await upload(item.solutions.id, 'Solutions original.pdf', solutionBytes);
const registration = { sessionID: previous, item, worksheetArtifactID, solutionsArtifactID };
assert.equal((await call('workspace', coTutor, registration)).status, 403, 'even a co-assigned tutor cannot register another owner’s artifacts');
for (const result of await Promise.all([call('workspace', first, registration), call('workspace', secondDevice, registration)])) {
  assert.equal(result.status, 201, result.body.error);
}
assert.deepEqual((await call(workspace(previous), secondDevice)).body, [{ item, worksheetArtifactID, solutionsArtifactID }]);
assert.deepEqual((await call(workspace(previous), coTutor)).body, []);
assert.equal((await call('workspace/' + worksheetArtifactID, coTutor)).status, 404);
for (const [id, expected] of [[worksheetArtifactID, worksheetBytes], [solutionsArtifactID, solutionBytes]]) {
  const result = await call('workspace/' + id, secondDevice);
  assert.equal(result.status, 200, result.body.error);
  const response = await fetch(result.body.url);
  assert.equal(response.status, 200);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected, 'the second iPad receives byte-identical originals');
}
const history = (await call(previousLesson, secondDevice)).body;
assert.equal(history.sessionID, previous);
assert.equal(history.workspace[0].item.id, item.id);
assert.deepEqual((await call(previousLesson, coTutor)).body.workspace, []);
assert.equal((await call('prints', first, { artifactID: worksheetArtifactID, copies: 1 })).status, 403, 'workspace assets cannot be repurposed as print artifacts');
console.log(JSON.stringify({ ownedProject: proof.project_id, previousClassSession: true, twoTutorSessions: true, coTutorIsolation: true, exactOriginals: true, atomicRetry: true }));
