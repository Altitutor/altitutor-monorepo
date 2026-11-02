// Run via dev:isolated exec, passing the owned-api receipt for the tutor on screen.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(path.join(process.cwd(), 'apps/tutor-web/package.json'));
const { createClient } = require('@supabase/supabase-js');
const manifest = fs.realpathSync(process.env.ALTITUTOR_WORKTREE_DEV_MANIFEST);
const proof = JSON.parse(fs.readFileSync(manifest));
const environment = JSON.parse(fs.readFileSync(path.join(path.dirname(manifest), 'environment.json')));
assert.equal(fs.realpathSync(proof.repository), fs.realpathSync(process.cwd()));
assert.equal(fs.realpathSync(proof.workdir), path.dirname(manifest));
assert.ok(proof.project_id.startsWith('altitutor-agent-test-'));
assert.equal(process.env.SUPABASE_URL, environment.SUPABASE_URL);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, environment.SUPABASE_SERVICE_ROLE_KEY);
assert.equal(new URL(environment.SUPABASE_URL).hostname, '127.0.0.1');
const receipt = JSON.parse(fs.readFileSync(process.argv[2] ?? '/private/tmp/dev219-native-fixture.json'));
assert.equal(receipt.project, proof.project_id);
assert.equal(receipt.origin, environment.NEXT_PUBLIC_TUTOR_WEB_URL);
assert.match(receipt.first.email, /^teaching-[a-f0-9-]+@example\.test$/);
const admin = createClient(environment.SUPABASE_URL, environment.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
function checked(result) { if (result.error) throw result.error; return result.data; }
const actor = checked(await admin.from('staff').select('id,email,last_name').eq('id', receipt.first.id).single());
assert.equal(actor.email, receipt.first.email); assert.equal(actor.last_name, 'Preview');
const primary = checked(await admin.from('topics_files').select('topic_id,file_id').eq('id', receipt.resource).single());
const source = checked(await admin.from('files').select('created_by').eq('id', primary.file_id).single());
assert.equal(source.created_by, receipt.first.id);
const originalTopic = checked(await admin.from('topics').select('id,subject_id').eq('id', primary.topic_id).single());
const subject = originalTopic.subject_id;
async function folder(name, parent, index) {
  const code = 'PREVIEW-' + subject.slice(0, 8) + '-' + name.replaceAll(' ', '-').toUpperCase();
  let query = admin.from('topics').select('id').eq('subject_id', subject).eq('name', name);
  query = parent ? query.eq('parent_id', parent) : query.is('parent_id', null);
  const existing = checked(await query.order('index', { ascending: false }).limit(1).maybeSingle());
  if (existing) return existing.id;
  const id = randomUUID();
  checked(await admin.from('topics').insert({ id, subject_id: subject, parent_id: parent, name, code, index: parent ? index : index * 10 }));
  return id;
}
const calculus = await folder('Calculus', null, 1);
checked(await admin.from('topics').update({ parent_id: calculus }).eq('id', originalTopic.id).eq('subject_id', subject));
const integration = await folder('Integration', calculus, 2);
const algebra = await folder('Algebra', null, 2);
const quadratics = await folder('Quadratics', algebra, 1);
const completing = await folder('Completing the square', quadratics, 1);
const functions = await folder('Functions and graphs', null, 3);
await folder('Revision planning', null, 4);
async function file(topic, title, solutionOf = null, resourceSubject = subject) {
  const existing = checked(await admin.from('topics_files').select('id,files!inner(filename)').eq('topic_id', topic).eq('files.filename', title).maybeSingle());
  if (existing) return existing.id;
  const previous = checked(await admin.from('topics_files').select('index').eq('topic_id', topic).eq('type', 'PRACTICE_QUESTIONS').eq('is_solutions', Boolean(solutionOf)).order('index', { ascending: false }).limit(1));
  const index = (previous[0]?.index ?? 0) + 1;
  const id = randomUUID(), fileID = randomUUID(), key = resourceSubject + '/' + topic + '/' + fileID + '.pdf';
  const bytes = fs.readFileSync('/private/tmp/' + (solutionOf ? 'solutions.pdf' : 'worksheet.pdf'));
  checked(await admin.storage.from('resources').upload(key, bytes, { contentType: 'application/pdf' }));
  checked(await admin.from('files').insert({ id: fileID, filename: title, mimetype: 'application/pdf', size_bytes: bytes.length, bucket: 'resources', storage_path: key, storage_provider: 'supabase', created_by: actor.id }));
  checked(await admin.from('topics_files').insert({ id, topic_id: topic, file_id: fileID, type: 'PRACTICE_QUESTIONS', index, code: solutionOf ? 'SOLUTION' : 'PRACTICE', is_solutions: Boolean(solutionOf), is_solutions_of_id: solutionOf }));
  return id;
}
for (const [topic, title] of [[originalTopic.id, 'Differentiation extension.pdf'], [integration, 'Integration practice.pdf'], [integration, 'Integration revision.pdf'], [quadratics, 'Quadratics practice.pdf'], [completing, 'Completing the square.pdf'], [functions, 'Functions and graphs.pdf']]) {
  const id = await file(topic, title);
  await file(topic, title.replace('.pdf', ' — solutions.pdf'), id);
}
// Multiple years and same-year subjects make nested ordering reviewable.
checked(await admin.from('subjects').update({short_name:'12MATH'}).eq('id',subject));
for (const [name, shortName, year, topicName] of [
  ['Science preview', '12SCIE', 12, 'Motion'],
  ['Zoology preview', '9ZOOL', 9, 'Habitats'],
  ['Biology preview', '10BIOL', 10, 'Cells'],
  ['Algebra preview', '10ALGE', 10, 'Equations'],
]) {
  const rows = checked(await admin.from('staff_subjects').select('subject_id,subjects!inner(name)').eq('staff_id', actor.id).eq('subjects.name',name));
  let extra = rows[0]?.subject_id;
  if (!extra) {
    extra = randomUUID();
    checked(await admin.from('subjects').insert({id:extra,name,short_name:shortName,year_level:year}));
    checked(await admin.from('staff_subjects').insert({staff_id:actor.id,subject_id:extra}));
  }
  let topic = checked(await admin.from('topics').select('id').eq('subject_id',extra).eq('name',topicName).maybeSingle())?.id;
  if (!topic) { topic=randomUUID(); checked(await admin.from('topics').insert({id:topic,subject_id:extra,name:topicName,index:1})); }
  const worksheet = await file(topic,topicName+' practice.pdf',null,extra);
  await file(topic,topicName+' practice — solutions.pdf',worksheet,extra);
}
console.log(JSON.stringify({ project: proof.project_id, expandedFolders: 11, addedWorksheets: 10, subjects:5, pairedSolutions: true, syntheticOnly: true }));
