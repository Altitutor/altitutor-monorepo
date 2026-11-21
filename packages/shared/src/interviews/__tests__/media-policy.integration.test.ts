import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../supabase/generated';
import { DailyInterviewProvider } from '../server/daily';
import { createInterviewMediaHandlers } from '../server/http';
import { InterviewMediaService } from '../server/media-service';
import { createInterviewMediaStore } from '../server/media-store';

const env = (globalThis as typeof globalThis & { process: { env: Record<string, string | undefined> } }).process.env;
const owned = env.ALTITUTOR_OWNED_DB_INNER === '1';

(owned ? describe : describe.skip)('media capabilities through owned Auth, admission, policy and session storage', () => {
  const interviewId = 'e4872000-0000-4000-8000-000000000001';
  const roundId = 'e4872000-0000-4000-8000-000000000002';
  const attemptId = 'e4872000-0000-4000-8000-000000000003';
  const classId = 'e4872000-0000-4000-8000-000000000004';
  const enrolmentId = 'e4872000-0000-4000-8000-000000000005';
  const tutorId = '00000000-0000-0000-0000-000000000010';
  const studentId = '10000000-0000-0000-0000-000000000001';
  const api = env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:1';
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const database = createClient<Database>(api, env.SUPABASE_SERVICE_ROLE_KEY ?? 'disabled', options);
  const tutor = createClient<Database>(api, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'disabled', options);
  const student = createClient<Database>(api, env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'disabled', options);
  const store = createInterviewMediaStore(database);
  const tutorActor = { id: tutorId, name: 'Tutor', role: 'tutor' } as const;
  const studentActor = { id: studentId, name: 'Student', role: 'student' } as const;
  let state: Record<string, Json | undefined>;
  let onToken: (() => Promise<void>) | undefined;
  let media: InterviewMediaService;
  const closedRooms: string[] = [];
  const tokens: Array<{ room_name: string; permissions: Json }> = [];

  async function write(result: PromiseLike<{ error: unknown }>) {
    const { error } = await result;
    if (error) throw error;
  }
  async function updateState(patch: Record<string, Json | undefined>) {
    state = { ...state, ...patch };
    await write(database.from('interview_rounds').update({ data: state }).eq('id', roundId));
  }
  async function admitted(role: 'tutor' | 'student') {
    const client = role === 'tutor' ? tutor : student;
    const view = role === 'tutor' ? 'vtutor_interview_media_access' : 'vstudent_interview_media_access';
    const { data, error } = await client.from(view).select('id,delivery,actor_id').eq('id', roundId).single();
    if (error) throw error;
    expect(data).toEqual({ id: roundId, delivery: 'online', actor_id: role === 'tutor' ? tutorId : studentId });
  }
  const captureHandlers = createInterviewMediaHandlers({
    role: 'tutor',
    resolveActor: async () => {
      const { data, error } = await tutor.auth.getUser();
      if (error || !data.user) throw error ?? new Error('Tutor authentication required');
      return { userId: data.user.id, userClient: tutor };
    },
    serviceClient: () => database,
    apiKey: () => undefined,
    errorResponse: () => Response.json({ error: 'Capture failed' }, { status: 500 }),
  });

  beforeAll(async () => {
    if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api)) throw new Error('Verified owned loopback API required');
    const { data: subject, error } = await database.from('subjects').select('id').eq('name', 'Medicine Interview').single();
    if (error) throw error;
    await write(database.from('staff_subjects').upsert({ staff_id: tutorId, subject_id: subject.id }, { onConflict: 'staff_id,subject_id' }));
    await write(database.from('classes').upsert({ id: classId, subject_id: subject.id, day_of_week: 1, start_time: '16:00', end_time: '17:00', status: 'ACTIVE', session_start_date: '2026-01-01', session_end_date: '2026-12-31' }));
    await write(database.from('classes_students').upsert({ id: enrolmentId, class_id: classId, student_id: studentId, enrolled_at: '2026-01-01T00:00:00Z', unenrolled_at: null }));
    for (const [client, table, id] of [[tutor, 'staff', tutorId], [student, 'students', studentId]] as const) {
      const { data: person, error: personError } = await database.from(table).select('email').eq('id', id).single();
      if (personError || !person.email) throw personError ?? new Error('Seeded account email required');
      const { error: loginError } = await client.auth.signInWithPassword({ email: person.email, password: 'test-password' });
      if (loginError) throw loginError;
    }
    await write(database.from('interviews').insert({ id: interviewId, data: {} }));
  });

  beforeEach(async () => {
    await write(database.from('interview_recordings').delete().eq('round_id', roundId));
    await write(database.from('interview_media_sessions').delete().eq('round_id', roundId));
    state = {
      delivery: 'online', mode: 'exam', recordingEnabled: true, startedAt: null,
      phase: 'waiting', pausedAt: null, phaseStartedAt: new Date().toISOString(),
      phaseDeadline: new Date(Date.now() + 300_000).toISOString(), questionTimeSeconds: 300,
      tutors: [{ id: tutorId, name: 'Tutor' }], students: [{ id: studentId, name: 'Student' }],
      stations: [{ id: 'station', questions: [] }], assignments: [{ stationId: 'station', tutorId }],
      progress: [{ stationId: 'station', tutorId, studentId, endedEarly: false, feedbackComplete: false }],
      attempts: [{ id: attemptId, stationId: 'station', studentId }],
    };
    await write(database.from('interview_rounds').upsert({ id: roundId, interview_id: interviewId, created_by: tutorId, tutor_ids: [tutorId], student_ids: [studentId], version: 1, data: state }));
    closedRooms.length = 0;
    tokens.length = 0;
    onToken = undefined;
    // The real Daily adapter serializes requests, but this transport never opens a socket.
    const provider = new DailyInterviewProvider('simulated', async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === '/v1/rooms' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { name: string };
        return Response.json({ url: `https://owned-fixture.daily.co/${body.name}` });
      }
      if (path === '/v1/meeting-tokens') {
        const body = JSON.parse(String(init?.body)) as { properties: { room_name: string; permissions: Json } };
        tokens.push(body.properties);
        await onToken?.();
        return Response.json({ token: 'simulated-private-token' });
      }
      if (path.startsWith('/v1/rooms/') && init?.method === 'DELETE') {
        closedRooms.push(decodeURIComponent(path.slice('/v1/rooms/'.length)));
        return new Response(null, { status: 204 });
      }
      throw new Error(`Unexpected simulated Daily request: ${init?.method} ${path}`);
    });
    media = new InterviewMediaService(store, provider);
  });

  afterAll(async () => {
    await write(database.from('interview_recordings').delete().eq('round_id', roundId));
    await write(database.from('interview_media_sessions').delete().eq('round_id', roundId));
    await write(database.from('interview_rounds').delete().eq('id', roundId));
    await write(database.from('interviews').delete().eq('id', interviewId));
    // Classes are retained business records with timetable-controlled status.
    // End only this fixture's enrolment and leave its class for owned-stack
    // destruction; never bypass either lifecycle using the service client.
    await write(database.from('classes_students').update({ unenrolled_at: new Date().toISOString() }).eq('id', enrolmentId));
    await tutor.auth.signOut({ scope: 'local' });
    await student.auth.signOut({ scope: 'local' });
  });

  it('admits authenticated tutors and students to one unrecorded prestart waiting room', async () => {
    await admitted('tutor');
    await admitted('student');
    const first = await media.ticket(roundId, tutorActor);
    const second = await media.ticket(roundId, studentActor);
    const observer = await media.ticketObserver(roundId, { id: 'admin', name: 'Admin' }, '');
    expect(first.sessionId).toEqual(expect.any(String));
    for (const ticket of [first, second, observer]) {
      expect(ticket).toMatchObject({ sessionId: first.sessionId, token: 'simulated-private-token', canSend: true, canReceive: true, recordingEnabled: false });
      expect(ticket.attemptId).toBeUndefined();
    }
    expect(await store.sessions(roundId)).toEqual([expect.objectContaining({ scope: 'waiting', attemptId: null, recordingEnabled: false, closedAt: null })]);
    expect((await store.round(roundId))?.recordings).toEqual([]);
  });

  it('preserves exam reading permissions and browser recording policy when questions start', async () => {
    await updateState({ phase: 'reading', startedAt: new Date().toISOString() });
    await admitted('tutor');
    const readingTutor = await media.ticket(roundId, tutorActor);
    const readingStudent = await media.ticket(roundId, studentActor);
    expect(readingTutor).toMatchObject({ canSend: false, canReceive: true, recordingEnabled: false });
    expect(readingStudent).toMatchObject({ sessionId: readingTutor.sessionId, canSend: true, canReceive: false, recordingEnabled: false });
    await updateState({ phase: 'questions', phaseStartedAt: new Date().toISOString() });
    const questions = await media.ticket(roundId, tutorActor);
    expect(questions).toMatchObject({ token: 'simulated-private-token', canSend: true, canReceive: true, recordingEnabled: true, attemptId });
    expect(questions.sessionId).not.toBe(readingTutor.sessionId);
    expect(closedRooms).toContain(tokens[0]!.room_name);
    const response = await captureHandlers.ticket(new Request(`http://localhost/api/interviews/rounds/${roundId}/media?capture=1`), roundId);
    expect(response.status).toBe(200);
    const capture = await response.json() as { captureId: string };
    expect(capture).toMatchObject({ captureId: expect.any(String), recordingEnabled: true, attemptId });
    expect(await store.sessions(roundId)).toContainEqual(expect.objectContaining({ id: capture.captureId, recordingEnabled: true, attemptId }));
    expect((await store.round(roundId))?.recordings).toContainEqual({ id: capture.captureId, kind: 'video', state: 'pending' });
  });

  it('withholds credentials and retires the persisted station room when pause races token minting', async () => {
    await updateState({ phase: 'questions', startedAt: new Date().toISOString() });
    await admitted('tutor');
    onToken = () => updateState({ pausedAt: new Date().toISOString() });
    const ticket = await media.ticket(roundId, tutorActor);
    expect(ticket).toMatchObject({ sessionId: null, canSend: false, canReceive: false, recordingEnabled: false });
    expect(ticket.token).toBeUndefined();
    expect(closedRooms).toEqual([tokens[0]!.room_name]);
    expect(await store.sessions(roundId)).toEqual([expect.objectContaining({ closedAt: expect.any(String) })]);
  });

  it('withholds credentials and retires the waiting room when the student is removed during token minting', async () => {
    await admitted('student');
    onToken = async () => {
      await updateState({ students: [] });
      await write(database.from('interview_rounds').update({ student_ids: [], version: 2 }).eq('id', roundId));
    };
    const ticket = await media.ticket(roundId, studentActor);
    expect(ticket).toMatchObject({ sessionId: null, canSend: false, canReceive: false });
    expect(ticket.token).toBeUndefined();
    expect(closedRooms).toEqual([tokens[0]!.room_name]);
    expect(await store.sessions(roundId)).toEqual([expect.objectContaining({ closedAt: expect.any(String) })]);
    const { data, error } = await student.from('vstudent_interview_media_access').select('id').eq('id', roundId);
    if (error) throw error;
    expect(data).toEqual([]);
  });
});
