import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../supabase/generated';
import { createInterviewMediaHandlers } from '../server/http';
import { sanitizeInterviewMediaEvidenceEvent, type InterviewMediaEvidence } from '../server/media-evidence';

// Shared builds deliberately omit Node ambient types; this fixture needs only env.
const env = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process.env;

// This contract runs only inside the repository's verified disposable lifetime.
const owned = env.ALTITUTOR_OWNED_DB_INNER === '1';
(owned ? describe : describe.skip)('media evidence through owned Auth, facade, PostgREST and capture guards', () => {
  const roundId = 'e4520000-0000-4000-8000-000000000012';
  const interviewId = 'e4520000-0000-4000-8000-000000000011';
  const tutorId = '00000000-0000-0000-0000-000000000010';
  const otherId = '00000000-0000-0000-0000-000000000011';
  const requestId = 'e4520000-0000-4000-8000-000000000014';
  let delivery: 'in_person' | 'online' = 'in_person';
  let evidence: InterviewMediaEvidence | undefined;
  const failures: unknown[] = [];
  const api = env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:1';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const service = createClient<Database>(api, env.SUPABASE_SERVICE_ROLE_KEY ?? 'disabled', options);
  const user = createClient<Database>(api, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'disabled', options);
  const handlers = createInterviewMediaHandlers({
    role: 'tutor', resolveActor: async () => {
      const { data, error } = await user.auth.getUser();
      if (error || !data.user) throw error;
      return { userId: data.user.id, userClient: user };
    }, serviceClient: () => service, apiKey: () => undefined,
    diagnostic: (value) => { evidence = value; },
    errorResponse: (error: unknown) => {
      failures.push(sanitizeInterviewMediaEvidenceEvent({ contexts: { interview_media: { ...evidence, requestId } } }, { originalException: error }));
      const failure = error as { code?: string; message?: string };
      return Response.json({ error: failure.message ?? 'failure' }, { status: failure.code === '42501' ? 403 : 500 });
    },
  });
  const request = () => handlers.ticket(new Request(`http://localhost/api/interviews/rounds/${roundId}/media?capture=1`), roundId);
  async function write(result: PromiseLike<{ error: unknown }>) { const { error } = await result; if (error) throw error; }
  beforeAll(async () => {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) throw new Error('Verified owned loopback API required');
    const { data: subject, error } = await service.from('subjects').select('id').eq('name', 'Medicine Interview').single();
    if (error) throw error;
    await write(service.from('staff_subjects').upsert({ staff_id: tutorId, subject_id: subject.id }, { onConflict: 'staff_id,subject_id' }));
    const { data: staff, error: staffError } = await service.from('staff').select('email').eq('id', tutorId).single();
    if (staffError || !staff.email) throw staffError;
    const { error: loginError } = await user.auth.signInWithPassword({ email: staff.email, password: 'test-password' });
    if (loginError) throw loginError;
    await write(service.from('interviews').insert({ id: interviewId, data: {} }));
  });
  beforeEach(async () => {
    delivery = 'in_person'; evidence = undefined; failures.length = 0;
    await write(service.from('interview_rounds').upsert({ id: roundId, interview_id: interviewId, created_by: tutorId, tutor_ids: [tutorId], student_ids: ['10000000-0000-0000-0000-000000000001'], data: { delivery, mode: 'feedback', phase: 'questions', rotation: 0, recordingEnabled: true, phaseStartedAt: new Date().toISOString(), phaseDeadline: new Date(Date.now() + 300000).toISOString(), pausedAt: null, stations: [], assignments: [{ stationId: 'station', tutorId }], progress: [{ stationId: 'station', tutorId, studentId: '10000000-0000-0000-0000-000000000001' }], attempts: [{ id: 'e4520000-0000-4000-8000-000000000013', stationId: 'station', studentId: '10000000-0000-0000-0000-000000000001' }] } }));
  });
  afterAll(async () => {
    await write(service.from('interview_recordings').delete().eq('round_id', roundId));
    await write(service.from('interview_media_sessions').delete().eq('round_id', roundId));
    await write(service.from('interview_rounds').delete().eq('id', roundId));
    await write(service.from('interviews').delete().eq('id', interviewId));
    await user.auth.signOut({ scope: 'local' });
  });
  it('keeps assigned tutor capture successful without producing a failure event', async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ captureId: expect.any(String), recordingEnabled: true });
    expect(failures).toEqual([]);
  });
  it('retains creator-only 403 and attaches the actual guard snapshot only to failure evidence', async () => {
    await write(service.from('interview_rounds').update({ tutor_ids: [otherId] }).eq('id', roundId));
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Round access denied' });
    expect(failures).toEqual([{ contexts: { interview_media: { version: 1, operation: 'interview_audio_capture', roundId, tutorId, requestId, role: 'tutor', captureRequested: true, guard: { roundExists: true, tutorAssigned: false, creator: true, tutorCount: 1, storedPhase: 'questions', delivery } } } }]);
  });
  it('keeps removed noncreators unavailable before attempting capture', async () => {
    await write(service.from('interview_rounds').update({ created_by: otherId, tutor_ids: [otherId] }).eq('id', roundId));
    const response = await request();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Interview is unavailable or your access has ended.' });
    expect(failures).toEqual([]);
    expect(evidence?.operation).toBe('round_view');
  });
  it('keeps missing rounds unavailable before a privileged call', async () => {
    const missingId = 'e4520000-0000-4000-8000-000000000099';
    const response = await handlers.ticket(new Request(`http://localhost/api/interviews/rounds/${missingId}/media?capture=1`), missingId);
    expect(response.status).toBe(404);
    expect(failures).toEqual([]);
    expect(evidence?.operation).toBe('round_view');
  });
  it('distinguishes the actual online video-capture guard failure', async () => {
    const { data, error } = await service.from('interview_rounds').select('data').eq('id', roundId).single();
    if (error) throw error;
    await write(service.from('interview_rounds').update({ tutor_ids: [otherId], data: { ...(data.data as Record<string, unknown>), delivery: 'online' } as Database['public']['Tables']['interview_rounds']['Update']['data'] }).eq('id', roundId));
    const response = await request();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'Round access denied' });
    expect(failures).toEqual([expect.objectContaining({ contexts: { interview_media: expect.objectContaining({ operation: 'interview_video_capture', roundId, tutorId, guard: expect.objectContaining({ delivery: 'online', roundExists: true, tutorAssigned: false }) }) } })]);
  });
});
