import { assertEquals, assertRejects } from 'jsr:@std/assert';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { executeSendMessage } from '../actions/send-message.ts';
import { filterTutorLogTextTargets } from '../log-text-choices.ts';

function client(options: { suppressed?: boolean; fail?: boolean } = {}) {
  const calls: string[] = [];
  const skips: unknown[] = [];
  const supabase = createClient('https://synthetic.invalid', 'test-only', {
    auth: { persistSession: false },
    global: { fetch: (input, init) => {
      const url = String(input);
      calls.push(url);
      let body: unknown = [];
      if (url.includes('/contacts')) body = [{ id: 'parent-contact', parent_id: 'parent-off', student_id: null }];
      if (url.includes('/tutor_logs')) body = {
        automated_text_suppressed_student_ids: ['child-off'],
        automated_text_suppressed_parent_ids: options.suppressed === false ? [] : ['parent-off'],
      };
      if (url.includes('/rpc/record_automation_message_skip')) { skips.push(JSON.parse(String(init?.body))); body = null; }
      if (url.includes('/tutor_logs') && options.fail) return Promise.resolve(new Response(JSON.stringify({ message: 'lookup unavailable' }), { status: 503 }));
      // An opted-out send must stop before querying a sender or creating a message.
      if (url.includes('/owned_numbers')) return Promise.resolve(new Response(JSON.stringify({ message: 'unexpected send' }), { status: 503 }));
      return Promise.resolve(new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }));
    } },
  });
  return { supabase, calls, skips };
}
const action = { id: 'action', action_config: { message_content: 'Thanks for attending', contact_id: 'parent-contact' } };
const event = { entity_type: 'tutor_logs', entity_id: 'log', event_type: 'session.logged' };

Deno.test('a per-log parent opt-out suppresses a configured single-recipient text before sending', async () => {
  const { supabase, calls, skips } = client();
  await executeSendMessage(supabase, action, event, {}, { id: 'execution' });
  assertEquals(skips, [{ p_execution_id: 'execution', p_action_id: 'action', p_reason: 'RECIPIENTS_DISABLED_FOR_LOG' }]);
  assertEquals(calls.some(url => url.includes('/owned_numbers') || url.includes('/messages')), false);
});

Deno.test('failure to read saved text choices stays retryable instead of sending or recording a terminal skip', async () => {
  const { supabase, calls } = client({ fail: true });
  await assertRejects(() => executeSendMessage(supabase, action, event, {}, { id: 'execution' }));
  assertEquals(calls.some(url => url.includes('record_automation_message_skip') || url.includes('/owned_numbers')), false);
});

Deno.test('mixed choices filter people by contact identity without suppressing an enabled parent of a disabled student', async () => {
  const supabase = createClient('https://synthetic.invalid', 'test-only', {
    auth: { persistSession: false },
    global: { fetch: (input) => Promise.resolve(new Response(JSON.stringify(String(input).includes('/tutor_logs') ? {
      automated_text_suppressed_student_ids: ['child-off'], automated_text_suppressed_parent_ids: ['parent-off'],
    } : [
      { id: 'student-off', student_id: 'child-off', parent_id: null },
      { id: 'student-on', student_id: 'child-on', parent_id: null },
      { id: 'parent-off', student_id: null, parent_id: 'parent-off' },
      { id: 'parent-on', student_id: null, parent_id: 'parent-on' },
    ]), { headers: { 'Content-Type': 'application/json' } })) },
  });
  assertEquals(await filterTutorLogTextTargets(supabase, [
    { contactId: 'student-off', studentId: 'child-off' },
    { contactId: 'student-on', studentId: 'child-on' },
    { contactId: 'parent-off', studentId: 'child-on' },
    { contactId: 'parent-on', studentId: 'child-off' },
  ], event), [{ contactId: 'student-on', studentId: 'child-on' }, { contactId: 'parent-on', studentId: 'child-off' }]);
});

Deno.test('legacy/default-enabled logs keep every eligible target', async () => {
  const supabase = createClient('https://synthetic.invalid', 'test-only', {
    auth: { persistSession: false },
    global: { fetch: () => Promise.resolve(new Response(JSON.stringify({
      automated_text_suppressed_student_ids: [], automated_text_suppressed_parent_ids: [],
    }), { headers: { 'Content-Type': 'application/json' } })) },
  });
  const targets = [{ contactId: 'student' }, { contactId: 'parent' }];
  assertEquals(await filterTutorLogTextTargets(supabase, targets, event), targets);
});

Deno.test('unrelated automations do not read or apply log text preferences', async () => {
  const { supabase, calls } = client();
  assertEquals(await filterTutorLogTextTargets(supabase, [{ contactId: 'parent-contact' }], { ...event, event_type: 'session.created' }), [{ contactId: 'parent-contact' }]);
  assertEquals(calls, []);
});
