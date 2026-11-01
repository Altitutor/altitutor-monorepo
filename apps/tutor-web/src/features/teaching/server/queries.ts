import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@altitutor/shared';
import { dateStringToUtcEnd, dateStringToUtcStart } from '@/shared/utils/datetime';
import { parseSessionParentList, parseSessionStaffList, parseSessionStudentList } from '@/features/sessions/utils/parseSessionDetailJson';
import { TeachingError } from './auth';
import { requireUUID } from './validation';

type Client = SupabaseClient<Database>;
type FileRow = Database['public']['Views']['vtutor_topics_files']['Row'];

function check(error: { message: string } | null) {
  if (error) throw new TeachingError(503, 'Teaching data is temporarily unavailable.', error);
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
  return { id: row.id, code: row.code, title: row.filename || row.code || 'Resource', mimeType: row.mimetype || 'application/octet-stream', externalURL: external };
}

export async function teachingResources(client: Client, params: URLSearchParams) {
  const resourceIDs = params.has('resourceIDs') ? (params.get('resourceIDs') ?? '').split(',').map(requireUUID) : [];
  if (resourceIDs.length > 50) throw new TeachingError(400, 'Choose fewer resources.');
  const resourceID = params.get('resourceID');
  if (resourceID) requireUUID(resourceID);
  const subjectID = params.has('subjectID') ? requireUUID(params.get('subjectID') ?? '') : null;
  const search = (params.get('query') ?? '').trim().slice(0, 120);
  const offset = Number(params.get('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) throw new TeachingError(400, 'Invalid resource page.');
  const [subjects, topics] = await Promise.all([
    allRows((start, end) => client.from('vtutor_subjects').select('id,name,short_name,year_level').order('id').range(start, end)),
    allRows((start, end) => client.from('vtutor_topics').select('id,name,subject_id,parent_id,index').order('id').range(start, end)),
  ]);
  const librarySubjects = subjects.flatMap(subject => subject.id ? [{ id: subject.id, name: subject.name ?? 'Subject',
    shortName: subject.short_name || subject.name || 'Subject', yearLevel: subject.year_level }] : [])
    .sort((a, b) => (a.yearLevel ?? Number.MAX_SAFE_INTEGER) - (b.yearLevel ?? Number.MAX_SAFE_INTEGER)
      || a.shortName.localeCompare(b.shortName, undefined, { numeric: true, sensitivity: 'base' }) || a.id.localeCompare(b.id));
  const scopedTopics = topics.filter(t => t.id && (!subjectID || t.subject_id === subjectID));
  const libraryTopics = scopedTopics.flatMap(topic => {
    const subject = subjects.find(s => s.id === topic.subject_id);
    if (!topic.id || !subject?.id) return [];
    return [{ id: topic.id, name: topic.name ?? 'Topic', parentID: topic.parent_id, index: topic.index ?? 0,
      subjectID: subject.id, subjectName: subject.name ?? 'Subject' }];
  });
  if (!scopedTopics.length) return { resources: [], topics: [], subjects: librarySubjects, nextOffset: null };
  const fileQuery = () => {
    let query = client.from('vtutor_topics_files').select('*').is('deleted_at', null).is('is_solutions_of_id', null);
    if (subjectID) query = query.in('topic_id', scopedTopics.flatMap(t => t.id ? [t.id] : []));
    if (resourceID) query = query.eq('id', resourceID);
    if (resourceIDs.length) query = query.in('id', resourceIDs);
    for (const term of search.split(/\s+/).filter(Boolean)) {
      const pattern = '"%' + term.replace(/[\\%_"]/g, '\\$&') + '%"';
      query = query.or(`code.ilike.${pattern},filename.ilike.${pattern}`);
    }
    return query.order('id');
  };
  let files: FileRow[];
  let nextOffset: number | null;
  if (search) {
    const matches = await allRows((start, end) => fileQuery().select('id,code,filename').range(start, end));
    const needle = search.toLocaleLowerCase();
    const rank = (file: Pick<FileRow, 'code' | 'filename'>) => {
      const code = (file.code ?? '').toLocaleLowerCase(), name = (file.filename ?? '').toLocaleLowerCase();
      return code === needle ? 0 : name === needle ? 1 : code.startsWith(needle) ? 2 : name.startsWith(needle) ? 3 : code.includes(needle) ? 4 : name.includes(needle) ? 5 : 6;
    };
    matches.sort((a, b) => rank(a) - rank(b) || (a.filename ?? '').localeCompare(b.filename ?? '', undefined, { numeric: true }) || (a.id ?? '').localeCompare(b.id ?? ''));
    const pageIDs = matches.slice(offset, offset + 50).flatMap(file => file.id ? [file.id] : []);
    const details = pageIDs.length ? await fileQuery().in('id', pageIDs) : { data: [], error: null };
    check(details.error);
    files = pageIDs.flatMap(id => details.data?.filter(file => file.id === id) ?? []);
    nextOffset = matches.length > offset + 50 ? offset + 50 : null;
  } else {
    const result = await fileQuery().range(offset, offset + 49);
    check(result.error); files = result.data ?? [];
    nextOffset = files.length === 50 ? offset + 50 : null;
  }
  const ids = (files ?? []).flatMap(f => f.id ? [f.id] : []);
  const solutions = ids.length ? await client.from('vtutor_topics_files').select('*').is('deleted_at', null)
    .in('is_solutions_of_id', ids).order('id') : { data: [], error: null };
  check(solutions.error);
  return { subjects: librarySubjects, topics: libraryTopics, resources: (files ?? []).flatMap(file => {
    const topic = scopedTopics.find(t => t.id === file.topic_id);
    const subject = subjects.find(s => s.id === topic?.subject_id);
    if (!file.id || !topic?.id || !subject?.id) return [];
    const answer = solutions.data?.find(s => s.is_solutions_of_id === file.id);
    return [{ id: file.id, topicID: topic.id, topicName: topic.name ?? 'Topic', subjectID: subject.id,
      subjectName: subject.name ?? 'Subject', worksheet: document(file), solutions: answer ? document(answer) : null }];
  }), nextOffset };
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
