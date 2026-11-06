import type { Database } from '@altitutor/shared';

import { supabase } from '@/lib/supabase';
import { tutorWebJson } from '@/lib/tutor-web';

import { adelaideDateKey, mayLogSession, mayShowSession, readPeople, sessionTime, type SessionPerson } from './session-model';

type View<T extends keyof Database['public']['Views']> = Database['public']['Views'][T]['Row'];

export type TutorClass = View<'vtutor_classes'>;
export type TutorSession = View<'vtutor_operational_sessions'>;
export type LessonTopic = Pick<View<'vtutor_topics'>, 'id' | 'name' | 'code' | 'subject_id'>;
export type LessonFile = Pick<View<'vtutor_topics_files'>, 'id' | 'filename' | 'code' | 'topic_id'>;
export type SessionNote = View<'vtutor_notes'>;
export type SessionDetail = Awaited<ReturnType<typeof getSession>>;
export type DateRange = { from: string; to: string };

const eligibleSessionTypes = ['CLASS', 'CHECK_IN'] as const;
const excludedSessionTypes = '(STAFF_INTERVIEW,SUBSIDY_INTERVIEW)';
const pageSize = 100;

function dataOrThrow<T>(result: { data: T; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listClasses() {
  const result = await supabase.from('vtutor_classes').select('*').order('day_of_week').order('start_time').order('id');
  return dataOrThrow(result) ?? [];
}

export async function getClass(classId: string) {
  const [detail, sessions] = await Promise.all([
    supabase.from('vtutor_class_detail').select('*').eq('class_id', classId).maybeSingle(),
    supabase.from('vtutor_operational_sessions').select('*')
      .eq('class_id', classId).gte('start_at', new Date().toISOString()).order('start_at').limit(30),
  ]);
  return { detail: dataOrThrow(detail), sessions: dataOrThrow(sessions) ?? [] };
}

export async function listCalendarSessions({ from, to }: DateRange, original = false) {
  const dateColumn = original ? 'original_start_at' : 'start_at';
  const result = await supabase.from('vtutor_operational_sessions').select('*')
    .gte(dateColumn, from).lt(dateColumn, to).not('session_type', 'in', excludedSessionTypes)
    .order(dateColumn).order('session_id');
  return dataOrThrow(result) ?? [];
}

export async function listUnloggedSessions(staffId: string) {
  const now = new Date();
  const unlogged: TutorSession[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const result = await supabase.from('vtutor_operational_sessions').select('*')
      .in('session_type', [...eligibleSessionTypes]).eq('session_status', 'ACTIVE')
      .is('calendar_tombstone_until', null).lte('start_at', now.toISOString())
      .order('start_at', { ascending: false }).order('session_id')
      .range(offset, offset + pageSize - 1);
    const sessions = dataOrThrow(result) ?? [];
    const ids = sessions.flatMap((session) => session.session_id ? [session.session_id] : []);
    if (ids.length === 0) break;

    const checkIns = sessions.flatMap((session) =>
      session.session_type === 'CHECK_IN' && session.session_id ? [session.session_id] : []);
    const [logState, checkInDetails] = await Promise.all([
      supabase.from('vtutor_session_log_state').select('session_id').in('session_id', ids),
      checkIns.length ? supabase.from('vtutor_operational_session_detail').select('session_id,staff')
        .in('session_id', checkIns) : null,
    ]);
    const logs = new Map((dataOrThrow(logState) ?? []).map((row) => [row.session_id, row]));
    const assignmentTypes = new Map(
      (checkInDetails ? dataOrThrow(checkInDetails) ?? [] : []).map((row) => [
        row.session_id,
        readPeople(row.staff).find((person) => person.id === staffId)?.type,
      ]),
    );
    for (const session of sessions) {
      if (session.session_id && mayLogSession(session, assignmentTypes.get(session.session_id), logs.get(session.session_id) ?? null, now)) {
        unlogged.push(session);
      }
    }
    if (sessions.length < pageSize) break;
  }

  return unlogged;
}

export async function getSession(sessionId: string) {
  const [details, sessions, tutorLog, logState] = await Promise.all([
    supabase.from('vtutor_operational_session_detail').select('*').eq('session_id', sessionId).maybeSingle(),
    supabase.from('vtutor_operational_sessions').select('*').eq('session_id', sessionId).maybeSingle(),
    supabase.from('vtutor_tutor_log').select('*').eq('session_id', sessionId).maybeSingle(),
    supabase.from('vtutor_session_log_state').select('deleted_at').eq('session_id', sessionId).maybeSingle(),
  ]);
  const detail = dataOrThrow(details);
  const session = dataOrThrow(sessions);
  if (!detail || !session || !mayShowSession(session.session_type)) return null;

  return {
    session,
    staff: readPeople(detail.staff),
    students: readPeople(detail.students),
    parents: readPeople(detail.parents),
    tutorLog: dataOrThrow(tutorLog),
    logState: dataOrThrow(logState),
  };
}

export async function getSessionNotes(sessionId: string) {
  const result = await supabase.from('vtutor_notes').select('*')
    .eq('target_type', 'sessions').eq('target_id', sessionId).order('created_at', { ascending: false });
  return dataOrThrow(result) ?? [];
}

export function saveSessionNote(sessionId: string, note: string, noteId?: string) {
  return noteId
    ? tutorWebJson(`/api/notes/${encodeURIComponent(noteId)}`, 'PATCH', { note })
    : tutorWebJson(`/api/sessions/${encodeURIComponent(sessionId)}/notes`, 'POST', { note });
}

export function deleteSessionNote(noteId: string) {
  return tutorWebJson(`/api/notes/${encodeURIComponent(noteId)}`, 'DELETE');
}

export async function getCalendarSubscription() {
  return tutorWebJson<{ subscriptionUrl: string }>('/api/calendar', 'POST');
}

export async function findLessonTopics(subjectId: string | null, query: string) {
  const select = supabase.from('vtutor_topics').select('id,name,code,subject_id').order('index').order('id');
  const term = query.trim();
  if (term) return dataOrThrow(await select.ilike('name', `%${term.replace(/[\\%_]/g, '\\$&')}%`).limit(50)) ?? [];
  return subjectId ? dataOrThrow(await select.eq('subject_id', subjectId)) ?? [] : [];
}

export async function listLessonFiles(topicId: string, forPlan = false) {
  const select = supabase.from('vtutor_topics_files').select('id,filename,code,topic_id')
    .eq('topic_id', topicId).is('deleted_at', null).order('index').order('id');
  return dataOrThrow(await (forPlan ? select.eq('is_solutions', false) : select)) ?? [];
}

export type LessonPlan = {
  revision: number;
  topics: { id: string; name: string; code: string | null }[];
  resources: { id: string; topicID: string; topicName: string; worksheet: { title: string }; solutions: { id: string; title: string } | null }[];
};

export function getLessonPlan(sessionId: string) {
  return tutorWebJson<LessonPlan>(`/api/sessions/${encodeURIComponent(sessionId)}/plan`, 'GET');
}

export function saveLessonPlan(sessionId: string, expectedRevision: number, topicIds: string[], fileIds: string[]) {
  return tutorWebJson<LessonPlan>(`/api/sessions/${encodeURIComponent(sessionId)}/plan`, 'PUT', { expectedRevision, topicIds, fileIds });
}

export async function findSessionPeople(kind: 'staff' | 'student', query: string): Promise<Pick<SessionPerson, 'id' | 'name'>[]> {
  const select = () => supabase.from(kind === 'staff' ? 'vtutor_session_staff_candidates' : 'vtutor_session_student_candidates')
    .select('id,first_name,last_name').order('first_name').order('last_name').order('id').limit(25);
  const like = (value: string) => `%${value.replace(/[\\%_]/g, '\\$&')}%`;
  const words = query.trim().split(/\s+/);
  const term = like(words.join(' '));
  const [first, last, full] = await Promise.all([
    select().ilike('first_name', term),
    select().ilike('last_name', term),
    words.length > 1 ? select()
      .ilike('first_name', like(words.slice(0, -1).join(' ')))
      .ilike('last_name', like(words.at(-1) ?? '')) : null,
  ]);
  return [...new Map(readPeople([
    ...(dataOrThrow(first) ?? []),
    ...(dataOrThrow(last) ?? []),
    ...(full ? dataOrThrow(full) ?? [] : []),
  ]).map(({ id, name }) => [id, { id, name }])).values()].slice(0, 25);
}

export function addSessionStudent(sessionId: string, studentId: string) {
  return tutorWebJson(`/api/sessions/${encodeURIComponent(sessionId)}/students`, 'POST', { studentId });
}

export function addSessionStaff(sessionId: string, staffId: string, type: string) {
  return tutorWebJson(`/api/sessions/${encodeURIComponent(sessionId)}/staff`, 'POST', { staffId, type });
}

export type TutorLogSubmission = {
  sessionId: string;
  staffAttendance: { staffId: string; attended: boolean; type: string }[];
  studentAttendance: { studentId: string; attended: boolean }[];
  parentAttendance: { parentId: string; attended: boolean }[];
  topics: { topicId: string; studentIds: string[] }[];
  topicFiles: { topicsFilesId: string; topicId: string; studentIds: string[] }[];
  notes: string[];
};

export function submitTutorLog(data: TutorLogSubmission) {
  return tutorWebJson<{ success: boolean }>('/api/tutor-logs', 'POST', data);
}

export type DayUpdate = { id: string; sessionId: string; label: string; detail: string };

export async function getDayUpdates(range: DateRange) {
  const [today, originallyToday] = await Promise.all([listCalendarSessions(range), listCalendarSessions(range, true)]);
  const sessions = [...new Map([...today, ...originallyToday].map((session) => [session.session_id, session])).values()];
  const ids = sessions.flatMap((row) => row.session_id ? [row.session_id] : []);
  const classIds = [...new Set(sessions.flatMap((row) => row.class_id ? [row.class_id] : []))];
  if (!ids.length) return [];

  const [details, classes, newStudents] = await Promise.all([
    supabase.from('vtutor_operational_session_detail').select('session_id,staff,students,parents').in('session_id', ids),
    classIds.length ? supabase.from('vtutor_class_detail').select('class_id,staff,students').in('class_id', classIds) : null,
    supabase.from('vtutor_dashboard_new_class_students').select('session_id,student_id').in('session_id', ids),
  ]);
  const peopleBySession = new Map((dataOrThrow(details) ?? []).map((row) => [row.session_id, row]));
  const peopleByClass = new Map((classes ? dataOrThrow(classes) ?? [] : []).map((row) => [row.class_id, row]));
  const newStudentKeys = new Set((dataOrThrow(newStudents) ?? []).map((row) => `${row.session_id}:${row.student_id}`));
  return sessions.flatMap((session): DayUpdate[] => {
    const sessionId = session.session_id;
    if (!sessionId) return [];
    const people = peopleBySession.get(sessionId);
    const classPeople = session.class_id ? peopleByClass.get(session.class_id) : undefined;
    const students = readPeople(people?.students);
    const staff = readPeople(people?.staff);
    const parents = readPeople(people?.parents);
    const classStudentIds = new Set(readPeople(classPeople?.students).map(({ id }) => id));
    const classStaffIds = new Set(readPeople(classPeople?.staff).map(({ id }) => id));
    const updates: DayUpdate[] = [];
    const add = (key: string, label: string, detail: string) => {
      updates.push({ id: `${sessionId}:${key}`, sessionId, label, detail });
    };

    if (['ADMIN_MEETING', 'CHECK_IN', 'TRIAL_SESSION'].includes(session.session_type ?? '')) {
      const time = sessionTime(session.start_at, session.end_at);
      const attendees = [...staff, ...students, ...parents].map(({ name }) => name).join(', ');
      add('meeting', 'Meeting', attendees ? `${time} · ${attendees}` : time);
    }
    if (session.original_start_at && session.start_at &&
      (session.original_start_at !== session.start_at || session.original_end_at !== session.end_at)) {
      const sameDay = adelaideDateKey(new Date(session.original_start_at)) === adelaideDateKey(new Date(session.start_at));
      const from = sessionTime(session.original_start_at, session.original_end_at);
      const to = sessionTime(session.start_at, session.end_at);
      add('time', sameDay ? 'Time changed' : 'Moved to another day', `${from} → ${to}`);
    }
    for (const student of students) {
      if (student.plannedAbsence) add(`student-absence:${student.id}`, 'Student absence', student.name);
      if (newStudentKeys.has(`${sessionId}:${student.id}`)) add(`student-new:${student.id}`, 'New student', student.name);
      if (student.extra || (classStudentIds.size > 0 && !classStudentIds.has(student.id))) {
        add(`student-extra:${student.id}`, 'Extra student', student.name);
      }
    }
    for (const tutor of staff) {
      if (tutor.swapped) add(`staff-swap:${tutor.id}`, 'Staff swap', tutor.swappedName ? `${tutor.name} → ${tutor.swappedName}` : tutor.name);
      else if (tutor.plannedAbsence) add(`staff-absence:${tutor.id}`, 'Staff absence', tutor.name);
      else if (classStaffIds.size > 0 && !classStaffIds.has(tutor.id) && !tutor.swappedIn) add(`staff-extra:${tutor.id}`, 'Extra staff', tutor.name);
    }
    return updates.map((update) => ({
      ...update,
      detail: [session.short_name || session.long_name || session.subject_name, update.detail].filter(Boolean).join(' · '),
    }));
  });
}
