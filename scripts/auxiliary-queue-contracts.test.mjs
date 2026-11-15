import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import YAML from 'yaml';

const workflows = [
  ['teaching-ipad.yml', 'native', 'Native lesson tests and simulator build', 'teaching_ipad'],
  ['supabase-types-check.yml', 'verify-types', 'Verify generated.ts matches schema', 'supabase_types'],
];

for (const [file, gate, name, selection] of workflows) {
  const workflow = YAML.parse(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
  test(`${name}: queue events use full event range and retain a stable aggregate`, () => {
    assert.deepEqual(workflow.on.merge_group.types, ['checks_requested']);
    const plan = workflow.jobs.plan;
    assert.equal(plan.steps.find(step => step.uses === 'actions/checkout@v4').with['fetch-depth'], 0);
    assert.ok(plan.steps.some(step => step.run === 'node scripts/validation-plan.mjs --github-output >> "$GITHUB_OUTPUT"'));
    assert.equal(plan.outputs.selected, `\${{ steps.selection.outputs.${selection} }}`);
    assert.equal(workflow.jobs[gate].name, name);
    assert.equal(workflow.jobs[gate].if, '${{ always() }}');
    assert.deepEqual(workflow.jobs[gate].needs, ['plan', 'validate']);
    assert.deepEqual(workflow.jobs[gate].steps[0].env, {
      PLAN_RESULT: '${{ needs.plan.result }}',
      SELECTED: '${{ needs.plan.outputs.selected }}',
      VALIDATION_RESULT: '${{ needs.validate.result }}',
    });
    assert.ok(workflow.on.pull_request.paths.includes(`.github/workflows/${file}`));
    assert.ok(workflow.on.pull_request.paths.includes('scripts/validation-plan.mjs'));
    assert.ok(workflow.on.pull_request.paths.includes('scripts/web-system-test-paths.mjs'));
    assert.equal(workflow.jobs.validate.if, "${{ needs.plan.outputs.selected == 'true' }}");
    assert.deepEqual(workflow.jobs.validate.needs, ['plan']);
  });
}

for (const [file, gate, name] of workflows) {
  const workflow = YAML.parse(readFileSync(new URL(`../.github/workflows/${file}`, import.meta.url), 'utf8'));
  test(`${name}: aggregate accepts only successful selected work or intentional exclusion`, () => {
    const script = workflow.jobs[gate].steps.find(step => step.name === 'Report auxiliary validation result').run;
    for (const [plan, selected, result, success] of [
      ['success', 'true', 'success', true],
      ['success', 'false', 'skipped', true],
      ['failure', 'false', 'skipped', false],
      ['cancelled', 'true', 'skipped', false],
      ['success', 'true', 'failure', false],
      ['success', 'true', 'cancelled', false],
      ['success', 'true', 'skipped', false],
      ['success', '', 'skipped', false],
      ['success', 'false', 'failure', false],
    ]) {
      const run = spawnSync('bash', ['-c', script], { env: { ...process.env, PLAN_RESULT: plan, SELECTED: selected, VALIDATION_RESULT: result } });
      assert.equal(run.status === 0, success, `${plan}/${selected}/${result}: ${run.stdout}`);
    }
  });
}
