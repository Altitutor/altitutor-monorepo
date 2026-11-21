/** @jest-environment node */
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@supabase/supabase-js';
import { createInterviewMediaHandlers, sanitizeInterviewMediaEvidenceEvent } from '@altitutor/shared/interviews/server';
import type { Database } from '@altitutor/shared';
import { withInterviewMediaEvidence } from '../media-evidence';

it('enriches the SDK automatic failure with guard evidence at zero trace sampling and keeps parallel requests separate', async () => {
  const events: Sentry.ErrorEvent[] = [];
  Sentry.init({ dsn: 'https://public@example.invalid/1', defaultIntegrations: false, tracesSampleRate: 0, beforeSend: (event, hint) => {
    event.extra = { __serialized__: { token: 'must-redact-inherited' } };
    event.user = { email: 'must-redact-inherited' };
    event.contexts = { ...event.contexts, unsafe: { payload: 'must-redact-inherited' } };
    event.breadcrumbs = [...(event.breadcrumbs ?? []), { data: { authorization: 'must-redact-inherited' } }];
    events.push(sanitizeInterviewMediaEvidenceEvent(event, hint));
    return null;
  }, transport: () => ({ send: async () => ({}), flush: async () => true }) });
  const ids = [
    { roundId: '10000000-0000-4000-8000-000000000001', tutorId: '00000000-0000-0000-0000-000000000010', delivery: 'in_person' },
    { roundId: '10000000-0000-4000-8000-000000000002', tutorId: '00000000-0000-0000-0000-000000000011', delivery: 'online' },
  ];
  let arrivals = 0;
  let unblock!: () => void;
  const barrier = new Promise<void>((resolve) => { unblock = resolve; });
  const clients = ids.map(({ roundId, tutorId, delivery }) => {
    const round = { id: roundId, delivery, phase: 'questions', progress: [], assignments: [], attempts: [], serverNow: new Date().toISOString() };
    const client = createClient<Database>('http://localhost:9999', 'local-only-dummy', { global: { fetch: async (input, init) => {
      const path = new URL(String(input)).pathname;
      const operation = path.split('/').at(-1);
      let body: unknown = path.includes('vtutor_interview_media_access') ? { id: roundId, delivery, actor_id: tutorId } : operation === 'current_tutor_id' ? tutorId : round;
      let status = 200;
      if (operation === 'interview_audio_capture' || operation === 'interview_video_capture') {
        arrivals += 1;
        if (arrivals === 2) unblock();
        await barrier;
        const args = JSON.parse(String(init?.body)) as { p_round_id: string; p_tutor_id: string };
        body = { code: '42501', message: 'Round access denied', details: JSON.stringify({ version: 1, operation, roundId: args.p_round_id, tutorId: args.p_tutor_id, roundExists: true, tutorAssigned: false, creator: true, tutorCount: 1, storedPhase: 'questions', delivery }) };
        status = 403;
      }
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    } }, auth: { persistSession: false, autoRefreshToken: false } });
    Sentry.instrumentSupabaseClient(client);
    return { client, roundId, tutorId };
  });
  try {
    const responses = await Promise.all(clients.map(({ client, roundId }) => withInterviewMediaEvidence((diagnostic) => createInterviewMediaHandlers({ role: 'tutor', resolveActor: async () => ({ userClient: client, userId: 'do-not-log-user' }), serviceClient: () => client, apiKey: () => undefined, diagnostic, errorResponse: () => Response.json({ error: 'Round access denied' }, { status: 403 }) }).ticket(new Request(`http://localhost/media?capture=1&accessKey=do-not-log-key`), roundId))));
    expect(responses.map((response) => response.status)).toEqual([403, 403]);
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([{ error: 'Round access denied' }, { error: 'Round access denied' }]);
    await Sentry.flush(1000);
    expect(events).toHaveLength(2);
    expect(events.map((event) => event.exception?.values?.[0]?.mechanism?.type)).toEqual(['auto.db.supabase.postgres', 'auto.db.supabase.postgres']);
    const evidence = events.map((event) => event.contexts?.interview_media);
    expect(evidence).toEqual(expect.arrayContaining(ids.map(({ roundId, tutorId, delivery }) => expect.objectContaining({ roundId, tutorId, operation: delivery === 'online' ? 'interview_video_capture' : 'interview_audio_capture', requestId: expect.any(String), guard: { roundExists: true, tutorAssigned: false, creator: true, tutorCount: 1, storedPhase: 'questions', delivery } }))));
    expect(evidence[0]?.requestId).not.toBe(evidence[1]?.requestId);
    expect(JSON.stringify(events)).not.toMatch(/do-not-log|p_round_id|p_tutor_id|must-redact/);
  } finally {
    await Sentry.close(1000);
  }
});
