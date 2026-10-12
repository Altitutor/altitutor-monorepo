/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { instrumentSupabaseClient } from '../instrument-supabase-client';
import { captureApiError } from '../capture-api-error';

const events: Sentry.ErrorEvent[] = [];
beforeAll(() => {
  Sentry.init({
    dsn: 'https://public@sentry.example/1', defaultIntegrations: false,
    tracesSampleRate: 0, sendClientReports: false,
    transport: () => ({
      send: async () => { throw new Error('Offline test transport must not send'); },
      flush: async () => true,
    }),
    beforeSend: (event) => { events.push(event); return null; },
  });
});
beforeEach(() => { events.length = 0; });
afterAll(async () => { await Sentry.close(); });

it('keeps one report for a study-plan guard RPC failure already captured by Supabase', async () => {
  const previousDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://public@sentry.example/1';
  try {
    const client = instrumentSupabaseClient(createClient('https://database.example', 'fixture-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input) => String(input).includes('/rpc/')
          ? new Response(JSON.stringify({ code: '42501', message: 'permission denied for function ucat_study_plan_task_has_active_work', details: null, hint: null }), { status: 403, headers: { 'content-type': 'application/json' } })
          : new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
      },
    }));
    // The real guard path reads the task before calling the RPC.
    await client.from('ucat_student_study_plan_tasks').select('id');
    const { error } = await client.rpc('ucat_study_plan_task_has_active_work', { p_task_id: 'fixture-task' });
    captureApiError(error, '/api/ucat/study-plan/tasks/[taskId]');
    await Sentry.flush(1000);
    expect(events).toHaveLength(1);
    expect(events[0].exception?.values?.[0].value).toContain('permission denied');
  } finally {
    if (previousDsn === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = previousDsn;
  }
});

// A route/cause mismatch must keep its manual report; this is not a permission filter.
it.each([
  ['/api/ucat/other', '42501', 'permission denied for function ucat_study_plan_task_has_active_work'],
  ['/api/ucat/study-plan/tasks/[taskId]', '42501', 'permission denied for table students'],
  ['/api/ucat/study-plan/tasks/[taskId]', '22023', 'invalid_study_plan_task'],
])('retains manual reporting outside the proven duplicate (%s %s)', async (route, code, message) => {
  captureApiError({ code, message }, route);
  await Sentry.flush(1000);
  expect(events).toHaveLength(1);
  expect(events[0].tags?.['api.route']).toBe(route);
  expect(events[0].exception?.values?.[0].value).toBe(message);
});
