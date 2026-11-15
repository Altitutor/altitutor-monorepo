// Required-check boundary: a deliberate empty plan may pass; missing work may not.
try {
  const needs = JSON.parse(process.env.WEB_CI_NEEDS ?? 'null');
  const plan = needs?.['validation-plan'];
  if (plan?.result !== 'success') throw new Error('Validation selection did not succeed');
  for (const job of ['lint', 'typecheck', 'test', 'ucat-contracts', 'build']) {
    if (needs[job]?.result !== 'success') throw new Error(`${job} must succeed; received ${needs[job]?.result ?? 'missing'}`);
  }
  const apps = JSON.parse(plan.outputs?.apps ?? 'null');
  const allowedApps = ['admin', 'marketing', 'student', 'tutor', 'ucat'];
  if (!Array.isArray(apps) || apps.some((app) => !allowedApps.includes(app)) || new Set(apps).size !== apps.length) {
    throw new Error('Invalid browser selection');
  }
  if (!['true', 'false'].includes(plan.outputs.database)) throw new Error('Invalid database selection');
  const database = plan.outputs.database === 'true';
  if (plan.outputs.run !== String(database || apps.length > 0)) throw new Error('Inconsistent system-test selection');
  for (const [job, selected] of [['web-browser', apps.length > 0], ['database-contracts', database]]) {
    const expected = selected ? 'success' : 'skipped';
    if (needs[job]?.result !== expected) throw new Error(`${job} must be ${expected}; received ${needs[job]?.result ?? 'missing'}`);
  }
  // This marker attests to the completed aggregate step, not the running job.
  // Reuse additionally requires the whole source workflow to finish successfully.
  if (process.argv.includes('--receipt-results')) {
    console.log(JSON.stringify({ ...needs, 'web-e2e': { result: 'success' } }));
  } else {
    console.log('All core, selected web browser and database checks passed.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid web check result');
  process.exitCode = 1;
}
