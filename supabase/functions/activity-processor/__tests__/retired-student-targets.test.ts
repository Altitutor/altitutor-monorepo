import { assertEquals, assertRejects } from 'jsr:@std/assert';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { filterLiveStudentMessageTargets } from '../live-student-targets.ts';

function client(fail = false) {
  return createClient('https://synthetic.invalid', 'test-only', {
    auth: { persistSession: false },
    global: { fetch: () => Promise.resolve(new Response(JSON.stringify(fail
      ? { message: 'lookup unavailable' }
      : [{ id: 'retired', deleted_at: '2026-01-01' }, { id: 'live', deleted_at: null }]),
      { status: fail ? 503 : 200, headers: { 'Content-Type': 'application/json' } })) },
  });
}

Deno.test('retired Student context cannot send to their parent; other live and independent parent contexts remain', async () => {
  const targets = [{ contactId: 'shared-parent', studentId: 'retired' }, { contactId: 'shared-parent', studentId: 'live' }, { contactId: 'independent-parent' }];
  assertEquals(await filterLiveStudentMessageTargets(client(), targets), targets.slice(1));
});
Deno.test('explicit retired Student context blocks an otherwise independent configured parent', async () => {
  assertEquals(await filterLiveStudentMessageTargets(client(), [{ contactId: 'parent' }], 'retired'), []);
});
Deno.test('missing Student cannot establish permission to send', async () => {
  assertEquals(await filterLiveStudentMessageTargets(client(), [{ contactId: 'parent', studentId: 'missing' }]), []);
});
Deno.test('lookup failures remain retryable failures rather than a terminal no-recipient outcome', async () => {
  await assertRejects(() => filterLiveStudentMessageTargets(client(true), [{ contactId: 'parent', studentId: 'live' }]));
});
