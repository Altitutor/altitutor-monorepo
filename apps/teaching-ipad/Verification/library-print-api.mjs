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

const receipt = JSON.parse(fs.readFileSync(process.argv[2] ?? '/private/tmp/dev219-native-fixture.json'));
assert.equal(receipt.project, proof.project_id);
assert.equal(receipt.origin, origin);
const actor = data(await admin.from('staff').select('email,last_name').eq('id', receipt.first.id).single(), 'fixture actor');
assert.match(receipt.first.email,/^teaching-[a-f0-9-]+@example\.test$/);
assert.equal(actor.email, receipt.first.email); assert.equal(actor.last_name, 'Preview');
const signIn = async person => {
  const response = await call('auth', null, { action: 'signIn', email: person.email, password: person.password });
  assert.equal(response.status, 200); return response.body.credentials.accessToken;
};
const token = await signIn(receipt.first), otherToken = await signIn(receipt.second);
const row = data(await admin.from('topics_files').select('code,topic_id,file_id').eq('id', receipt.resource).single(), 'fixture resource');
const scope = data(await admin.from('topics').select('subject_id').eq('id', row.topic_id).single(), 'fixture subject');
const exact = await call('resources?resourceID=' + receipt.resource, token);
assert.equal(exact.body.resources[0].worksheet.code, row.code, 'documents expose the file code');
assert.ok(exact.body.subjects.some(subject => subject.id === scope.subject_id), 'subject menu lists caller subjects');
const search = await call('resources?subjectID=' + scope.subject_id + '&query=' + encodeURIComponent(row.code), token);
assert.equal(search.status, 200, search.body.error);
assert.equal(search.body.resources[0]?.id, receipt.resource, 'an exact file code is the first search result');
const other = await call('resources?query=' + encodeURIComponent(row.code), otherToken);
assert.ok(!other.body.resources.some(resource => resource.id === receipt.resource), 'search retains caller access');
assert.ok(!other.body.subjects.some(subject => subject.id === scope.subject_id), 'subject menu retains caller access');
// An exact code outranks a filename containing that same code.
const aliasFile = randomUUID(), aliasResource = randomUUID();
try {
  data(await admin.from('files').insert({id:aliasFile,filename:row.code+' reference.pdf',mimetype:'application/pdf',size_bytes:0,storage_provider:'external',external_url:'https://example.test/relevance',created_by:receipt.first.id}),'relevance fixture');
  const last = data(await admin.from('topics_files').select('index').eq('topic_id',row.topic_id).eq('type','PRACTICE_QUESTIONS').eq('is_solutions',false).order('index',{ascending:false}).limit(1),'last fixture index');
  data(await admin.from('topics_files').insert({id:aliasResource,topic_id:row.topic_id,file_id:aliasFile,type:'PRACTICE_QUESTIONS',index:(last[0]?.index??0)+1,is_solutions:false}),'relevance resource');
  const ranked = await call('resources?subjectID='+scope.subject_id+'&query='+encodeURIComponent(row.code),token);
  assert.equal(ranked.body.resources[0]?.id,receipt.resource);
  assert.ok(ranked.body.resources.some(resource=>resource.id===aliasResource),'filename matches remain searchable');
  const punctuation = await call('resources?query='+encodeURIComponent('"),code.not.is.null,%_'),token);
  assert.equal(punctuation.status,200,'punctuation is treated as search text');
  assert.equal(punctuation.body.resources.length,0);
} finally {
  data(await admin.from('topics_files').delete().eq('id',aliasResource).eq('file_id',aliasFile),'remove relevance resource');
  data(await admin.from('files').delete().eq('id',aliasFile).eq('created_by',receipt.first.id),'remove relevance file');
}
const options = await call('print-options', token);
assert.equal(options.status, 200, 'native print options use office policy');
assert.equal(typeof options.body.online, 'boolean');
assert.equal(typeof options.body.allowed, 'boolean');
assert.equal((await call('prints', token, {resourceID:receipt.resource,copies:21})).status,400,'print copies are bounded');
assert.equal((await call('prints', otherToken, {resourceID:receipt.resource,copies:1})).status,403,'printing requires resource access');
assert.equal((await call('prints/'+randomUUID(), otherToken)).status,404,'print status is caller scoped');
const settings = data(await admin.from('office_print_settings').select('tutor_access').eq('singleton',true).single(),'owned print setting');
const connectorID = 'dev219-test-' + randomUUID();
let jobID;
try {
  data(await admin.from('print_connector_state').insert({connector_id:connectorID,status:'healthy',last_heartbeat_at:new Date().toISOString()}),'owned fake bridge');
  data(await admin.from('office_print_settings').update({tutor_access:'unrestricted'}).eq('singleton',true),'owned print access');
  const allowed = await call('print-options',token);
  assert.equal(allowed.body.online,true); assert.equal(allowed.body.allowed,true);
  const queued = await call('prints',token,{resourceID:receipt.resource.toUpperCase(),copies:2});
  assert.equal(queued.status,201,queued.body.error); jobID=queued.body.id;
  assert.equal(queued.body.copies,2); assert.equal(queued.body.status,'queued');
  assert.equal((await call('prints/'+jobID,token)).body.status,'queued');
  assert.equal((await call('prints/'+jobID,otherToken)).status,404,'jobs are private to their requester');
  assert.equal((await call('prints',token,{resourceID:receipt.resource,copies:2})).status,400,'existing queue suppresses duplicates');
  data(await admin.from('office_print_settings').update({tutor_access:'off'}).eq('singleton',true),'owned print disabled');
  assert.equal((await call('print-options',token)).body.allowed,false);
  assert.equal((await call('prints',token,{resourceID:receipt.resource,copies:1})).status,400,'enqueue rechecks policy');
} finally {
  if(jobID) data(await admin.from('print_jobs').update({status:'cancelled'}).eq('id',jobID).eq('requested_by_staff_id',receipt.first.id),'cancel synthetic job');
  data(await admin.from('office_print_settings').update({tutor_access:settings.tutor_access}).eq('singleton',true),'restore owned setting');
  data(await admin.from('print_connector_state').delete().eq('connector_id',connectorID),'remove fake bridge');
}
console.log(JSON.stringify({ownedProject:proof.project_id,codeSearch:true,subjectMenu:true,officePrintQueue:true,printAuthorization:true,realPrinterUsed:false}));
