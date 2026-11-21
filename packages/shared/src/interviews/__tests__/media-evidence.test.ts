import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/generated';
import { createInterviewMediaHandlers } from '../server/http';

const roundId = '10000000-0000-4000-8000-000000000001';
const tutorId = '10000000-0000-4000-8000-000000000003';

function fixture(delivery: 'in_person' | 'online' = 'in_person') {
  const round = { id: roundId, delivery, phase: 'questions', progress: [], assignments: [], attempts: [], serverNow: new Date().toISOString() };
  const denial = { code: '42501', message: 'Round access denied', details: '{}' };
  const evidence: unknown[] = [];
  const user = {
    from: () => { const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { id: roundId, delivery, actor_id: tutorId, data: round }, error: null }) }; return q; },
    rpc: async () => ({ data: tutorId, error: null }),
  } as unknown as SupabaseClient<Database>;
  const rpc = jest.fn(async (operation: string) => operation === 'interview_media_policy_state'
    ? { data: round, error: null }
    : { data: null, error: denial });
  const errorResponse = jest.fn(() => Response.json({ error: denial.message }, { status: 403 }));
  const handlers = createInterviewMediaHandlers({ role: 'tutor', resolveActor: async () => ({ userId: 'never-log-auth-user', userClient: user }), serviceClient: () => ({ rpc }) as unknown as SupabaseClient<Database>, apiKey: () => undefined, errorResponse, diagnostic: (value: unknown) => { evidence.push(value); } });
  return { handlers, evidence, errorResponse, rpc, denial };
}

it('places the exact failed capture arguments on the existing failure seam before the RPC rejects, without changing its response', async () => {
  const f = fixture();
  const response = await f.handlers.ticket(new Request(`http://localhost/api/interviews/rounds/${roundId}/media?capture=1&accessKey=secret`), roundId);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Round access denied' });
  expect(f.evidence.at(-1)).toEqual({ version: 1, operation: 'interview_audio_capture', roundId, tutorId, captureRequested: true, role: 'tutor' });
  expect(JSON.stringify(f.evidence)).not.toMatch(/secret|never-log-auth-user|accessKey/);
  expect(f.rpc).toHaveBeenLastCalledWith('interview_audio_capture', { p_round_id: roundId, p_tutor_id: tutorId });
  expect(f.errorResponse).toHaveBeenCalledWith(f.denial);
});

it('distinguishes online browser video capture and isolates evidence from a failing collector', async () => {
  const f = fixture('online');
  const response = await f.handlers.ticket(new Request(`http://localhost/api/interviews/rounds/${roundId}/media?capture=1`), roundId);
  expect(response.status).toBe(403);
  expect(f.evidence.at(-1)).toMatchObject({ operation: 'interview_video_capture', roundId, tutorId });
  const broken = createInterviewMediaHandlers({ role: 'tutor', resolveActor: async () => { throw f.denial; }, serviceClient: () => { throw new Error('must not query'); }, apiKey: () => undefined, errorResponse: f.errorResponse, diagnostic: () => { throw new Error('collector failed'); } });
  expect((await broken.ticket(new Request('http://localhost/media'), roundId)).status).toBe(403);
  expect(f.errorResponse).toHaveBeenLastCalledWith(f.denial);
});
