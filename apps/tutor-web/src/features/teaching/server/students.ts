import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { getServiceRoleClient } from '@/shared/lib/supabase/service-role';
import { TeachingError } from './auth';
import { requireUUID } from './validation';

type Client = SupabaseClient<Database>;

async function requireDropInSession(client: Client, sessionID: string) {
  requireUUID(sessionID);
  const { data, error } = await client.from('vtutor_operational_session_detail').select('session_id,session_type')
    .eq('session_id', sessionID).maybeSingle();
  if (error) throw new TeachingError(503, 'Attendance is temporarily unavailable.');
  if (!data) throw new TeachingError(403, 'This lesson is not assigned to you.');
  if (data.session_type !== 'HOMEWORK_HELP') throw new TeachingError(400, 'Drop-ins are available for Homework Help.');
  const logs = await client.from('vtutor_tutor_log').select('tutor_log_id').eq('session_id', sessionID).maybeSingle();
  if (logs.error) throw new TeachingError(503, 'Attendance is temporarily unavailable.');
  if (logs.data) throw new TeachingError(409, 'This lesson has already been logged.');
}

/** Mirrors TutorWeb's active/trial student search, returning only names for assigned Homework Help. */
export async function teachingStudents(client: Client, params: URLSearchParams) {
  await requireDropInSession(client, params.get('sessionID') ?? '');
  const search = (params.get('query') ?? '').trim().slice(0, 100);
  if (search.length < 2) return [];
  const escaped = search.replace(/[\\%_]/g, '\\$&');
  const service = getServiceRoleClient();
  // Separate filters avoid interpolating a user string into PostgREST's boolean grammar.
  const results = await Promise.all(['first_name', 'last_name'].map(column => service.from('students')
    .select('id,first_name,last_name').in('status', ['ACTIVE', 'TRIAL']).ilike(column, `%${escaped}%`)
    .order('first_name').order('id').limit(50)));
  if (results.some(result => result.error)) throw new TeachingError(503, 'Student search is temporarily unavailable.');
  const unique = new Map(results.flatMap(result => result.data ?? []).map(row => [row.id, row]));
  return [...unique.values()].slice(0, 50).map(row => ({ id: row.id, name: [row.first_name, row.last_name].filter(Boolean).join(' ') }));
}

export async function addTeachingStudent(client: Client, input: { sessionId: string; studentId: string }) {
  await requireDropInSession(client, input.sessionId);
  const service = getServiceRoleClient();
  const student = await service.from('students').select('id').eq('id', input.studentId).in('status', ['ACTIVE', 'TRIAL']).maybeSingle();
  if (student.error) throw new TeachingError(503, 'Attendance is temporarily unavailable.');
  if (!student.data) throw new TeachingError(404, 'This student is no longer available.');
  const existing = await service.from('sessions_students').select('id').eq('session_id', input.sessionId).eq('student_id', input.studentId).maybeSingle();
  if (existing.error) throw new TeachingError(503, 'Attendance is temporarily unavailable.');
  if (existing.data) return;
  const result = await service.from('sessions_students').insert({ id: crypto.randomUUID(), session_id: input.sessionId, student_id: input.studentId });
  if (result.error) throw new TeachingError(503, 'Could not add this student. Refresh attendance and retry.');
}
