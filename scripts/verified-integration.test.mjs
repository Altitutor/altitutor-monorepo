import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createReceipt, acceptsReceipt, acceptsArtifact, acceptsArchive, REQUIRED_JOBS } from './verified-integration.mjs';
const head = 'a'.repeat(40), tree = 'b'.repeat(40), base = 'c'.repeat(40);
const plan = { event: 'merge_group', base, head, profile: 'integration' };
const runtime = { node: '24.22.2', pnpm: '11.28.9', deno: '2.9.6', supabaseSetup: '2.107.0' };
const results = Object.fromEntries(REQUIRED_JOBS.map(name => [name, { result: 'success' }]));
const receipt = () => createReceipt(plan, { head, tree, runtime, expected: runtime, results });
const context = () => ({ run: { head_sha: head, path: '.github/workflows/ci.yml', event: 'merge_group', status: 'completed', conclusion: 'success' }, tree, expected: runtime, baseIsAncestor: true });
test('matching reviewed integration tree can verify a differently named squash commit', () => assert.equal(acceptsReceipt(receipt(), context()), true));
for (const [name, patch] of Object.entries({ failed: { conclusion: 'failure' }, unfinished: { status: 'in_progress' }, wrongWorkflow: { path: '.github/workflows/other.yml' }, pullRequest: { event: 'pull_request' }, wrongHead: { head_sha: 'd'.repeat(40) } })) {
  test(`rejects ${name} workflow evidence`, () => { const c = context(); Object.assign(c.run, patch); assert.equal(acceptsReceipt(receipt(), c), false); });
}
for (const [name, patch] of Object.entries({ changedTree: { tree: 'd'.repeat(40) }, toolchain: { expected: { ...runtime, deno: '2.9.7' } }, unrelatedBase: { baseIsAncestor: false } })) {
  test(`rejects ${name}`, () => assert.equal(acceptsReceipt(receipt(), { ...context(), ...patch }), false));
}
test('missing evidence requires verification', () => assert.equal(acceptsReceipt(null, context()), false));
test('producer rejects an unpinned runtime', () => assert.throws(() => createReceipt(plan, { head, tree, runtime: { ...runtime, node: '24.0.0' }, expected: runtime, results })));
test('producer rejects PR-only evidence', () => assert.throws(() => createReceipt({ ...plan, event: 'pull_request' }, { head, tree, runtime, expected: runtime, results })));
test('rejects mismatched recorded selection head', () => { const r = receipt(); r.planHead = 'd'.repeat(40); assert.equal(acceptsReceipt(r, context()), false); });

for (const name of REQUIRED_JOBS) {
  test(`rejects missing ${name}`, () => { const r = receipt(); r.results = { ...results, [name]: undefined }; assert.equal(acceptsReceipt(r, context()), false); });
  test(`rejects failed ${name}`, () => assert.throws(() => createReceipt(plan, { head, tree, runtime, expected: runtime, results: { ...results, [name]: { result: 'failure' } } })));
}
const artifact = { name: 'ci-integration-receipt', expired: false, size_in_bytes: 500, id: 1, digest: `sha256:${'a'.repeat(64)}`, workflow_run: { id: 99, head_sha: head } };
test('accepts artifact bound by GitHub to exact successful source run', () => assert.equal(acceptsArtifact(artifact, { id: 99, head_sha: head }), true));
for (const [name, patch] of Object.entries({ expired: { expired: true }, manualArtifact: { workflow_run: undefined }, replay: { workflow_run: { id: 98, head_sha: head } }, forgedHead: { workflow_run: { id: 99, head_sha: base } }, noDigest: { digest: undefined }, wrongName: { name: 'other' } })) {
  test(`rejects ${name} artifact`, () => assert.equal(acceptsArtifact({ ...artifact, ...patch }, { id: 99, head_sha: head }), false));
}

test('archive must match GitHub artifact digest', () => { const bytes = Buffer.from('trusted archive'); const a = { digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}` }; assert.equal(acceptsArchive(a, bytes), true); assert.equal(acceptsArchive(a, Buffer.from('replaced')), false); });
