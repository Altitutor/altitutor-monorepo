import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { dateStringToUtcEnd, dateStringToUtcStart } from '@/shared/utils/datetime';
import { parseSessionParentList, parseSessionStaffList, parseSessionStudentList } from '@/features/sessions/utils/parseSessionDetailJson';
import { TeachingError } from './auth';
import { requireUUID } from './validation';

type Client = SupabaseClient<Database>;
type FileRow = Database['public']['Views']['vtutor_topics_files']['Row'];

function check(error: { message: string } | null) {
  if (error) throw new TeachingError(503, 'Teaching data is temporarily unavailable.');
}

async function allRows<T>(query: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let start = 0; ; start += 1000) {
    const result = await query(start, start + 999);
    check(result.error);
    rows.push(...(result.data ?? []));
    if ((result.data?.length ?? 0) < 1000) return rows;
  }
}

export async function teachingSessions(client: Client, day: string) {
  const date = new Date(day + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== day) {
    throw new TeachingError(400, 'Choose a valid lesson date.');
  }
  const { data, error } = await client.from('vtutor_operational_session_detail').select('*')
    .gte('start_at', dateStringToUtcStart(day)).lte('start_at', dateStringToUtcEnd(day)).order('start_at');
  check(error);
  const rows = (data ?? []).filter(row => row.session_id && row.start_at && row.end_at);
  const logs = rows.length ? await client.from('vtutor_tutor_log').select('session_id,tutor_log_id')
    .in('session_id', rows.flatMap(row => row.session_id ? [row.session_id] : [])) : { data: [], error: null };
  check(logs.error);
  return rows.map(row => ({
    id: row.session_id, title: row.long_name || row.subject_long_name || row.subject_name || row.session_type?.replaceAll('_', ' ') || 'Lesson',
    classroomTitle: row.subject_name ? [row.subject_year_level ? `Year ${row.subject_year_level}` : null, row.subject_name].filter(Boolean).join(' ') : (row.session_type ?? 'Lesson').replaceAll('_', ' '),
    kind: row.session_type, subjectID: row.subject_id, subjectName: row.subject_name,
    startAt: row.start_at, endAt: row.end_at, room: row.room,
    students: parseSessionStudentList(row.students).filter(p => p.id).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })),
    staff: parseSessionStaffList(row.staff).filter(p => p.id).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`, type: p.type ?? 'MAIN_TUTOR' })),
    parents: parseSessionParentList(row.parents).map(p => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Parent' })),
    logged: logs.data?.some(log => log.session_id === row.session_id) ?? false,
  }));
}

function document(row: FileRow) {
  if (!row.id) throw new TeachingError(503, 'A resource is unavailable.');
  const external = row.external_url && /^https?:\/\//i.test(row.external_url) ? row.external_url : null;
  return { id: row.id, title: row.filename || row.code || 'Resource', mimeType: row.mimetype || 'application/octet-stream', externalURL: external };
}

export async function teachingResources(client: Client, params: URLSearchParams) {
  const resourceID = params.get('resourceID');
  if (resourceID) requireUUID(resourceID);
  const subjectID = params.has('subjectID') ? requireUUID(params.get('subjectID') ?? '') : null;
  const search = (params.get('query') ?? '').trim().slice(0, 120);
  const offset = Number(params.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new TeachingError(400, 'Invalid resource page.');
  const [subjects, topics] = await Promise.all([
    allRows((start, end) => client.from('vtutor_subjects').select('id,name').order('id').range(start, end)),
    allRows((start, end) => client.from('vtutor_topics').select('id,name,subject_id').order('id').range(start, end)),
  ]);
  const scopedTopics = topics.filter(t => t.id && (!subjectID || t.subject_id === subjectID));
  if (!scopedTopics.length) return { resources: [], nextOffset: null };
  let query = client.from('vtutor_topics_files').select('*').is('deleted_at', null).is('is_solutions_of_id', null);
  // The view already limits files to authorized topics; only add an IN filter for one subject.
  if (subjectID) query = query.in('topic_id', scopedTopics.flatMap(t => t.id ? [t.id] : []));
  if (resourceID) query = query.eq('id', resourceID);
  if (search) query = query.ilike('filename', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  const { data: files, error } = await query.order('id').range(offset, offset + 49);
  check(error);
  const ids = (files ?? []).flatMap(f => f.id ? [f.id] : []);
  const solutions = ids.length ? await client.from('vtutor_topics_files').select('*').is('deleted_at', null)
    .in('is_solutions_of_id', ids).order('id') : { data: [], error: null };
  check(solutions.error);
  return { resources: (files ?? []).flatMap(file => {
    const topic = scopedTopics.find(t => t.id === file.topic_id);
    const subject = subjects.find(s => s.id === topic?.subject_id);
    if (!file.id || !topic?.id || !subject?.id) return [];
    const answer = solutions.data?.find(s => s.is_solutions_of_id === file.id);
    return [{ id: file.id, topicID: topic.id, topicName: topic.name ?? 'Topic', subjectID: subject.id,
      subjectName: subject.name ?? 'Subject', worksheet: document(file), solutions: answer ? document(answer) : null }];
  }), nextOffset: files?.length === 50 ? offset + 50 : null };
}

export async function teachingDocumentURL(client: Client, id: string) {
  requireUUID(id);
  const { data, error } = await client.from('vtutor_topics_files').select('*').eq('id', id).is('deleted_at', null).maybeSingle();
  check(error);
  if (!data) throw new TeachingError(404, 'This resource is no longer accessible.');
  if (data.external_url) {
    if (!/^https?:\/\//i.test(data.external_url)) throw new TeachingError(400, 'Unsupported resource link.');
    return { url: data.external_url, external: true };
  }
  if (!data.bucket || !data.storage_path) throw new TeachingError(404, 'This resource has no downloadable file.');
  const result = await client.storage.from(data.bucket).createSignedUrl(data.storage_path, 300);
  check(result.error);
  if (!result.data) throw new TeachingError(503, 'Could not prepare this resource.');
  return { url: result.data.signedUrl, external: false };
}

export async function teachingLog(client: Client, sessionID: string) {
  requireUUID(sessionID);
  const { data, error } = await client.from('vtutor_tutor_log').select('*').eq('session_id', sessionID).maybeSingle();
  check(error);
  if (!data) throw new TeachingError(404, 'No tutor log is available.');
  return data;
}
