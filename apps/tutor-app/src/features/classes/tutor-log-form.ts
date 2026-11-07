import { assertResolvedAttendanceRows, getAttendanceCompletionBlockers } from '@altitutor/shared';
import { CHECK_IN_STAFF_TYPE_OPTIONS, CLASS_STAFF_TYPE_OPTIONS, toCheckInStaffRole } from '@altitutor/shared/pay-tiers';

import type { TutorLogSubmission } from './api';

type LogPerson = { id: string; name: string; type?: string };

export type LogRoster = { staff: LogPerson[]; students: LogPerson[]; parents: LogPerson[] };
export type LogDraft = {
  staff: Record<string, { attended?: boolean; type: string }>;
  students: Record<string, boolean>;
  parents: Record<string, boolean>;
  topics: Record<string, string[]>;
  files: Record<string, { topicId: string; studentIds: string[] }>;
  notes: string;
};

const needsTopic = new Set(['CLASS', 'DRAFTING', 'EXAM_COURSE', 'TRIAL_SESSION']);

export function logStaffType(person: LogPerson, sessionType: string | null, tutorId: string) {
  if (sessionType === 'CHECK_IN') return toCheckInStaffRole(person.type);
  return CLASS_STAFF_TYPE_OPTIONS.some(({ value }) => value === person.type)
    ? person.type! : person.id === tutorId ? 'MAIN_TUTOR' : 'SECONDARY_TUTOR';
}

export function staffRoleOptions(sessionType: string | null) {
  return sessionType === 'CHECK_IN' ? CHECK_IN_STAFF_TYPE_OPTIONS : CLASS_STAFF_TYPE_OPTIONS;
}

function attendanceFor(roster: LogRoster, draft: LogDraft) {
  return {
    staffAttendance: roster.staff.map(({ id, type }) => ({
      staffId: id, attended: draft.staff[id]?.attended, type: draft.staff[id]?.type ?? type ?? 'SECONDARY_TUTOR',
    })),
    studentAttendance: roster.students.map(({ id }) => ({ studentId: id, attended: draft.students[id] })),
    parentAttendance: roster.parents.map(({ id }) => ({ parentId: id, attended: draft.parents[id] })),
  };
}

export function logAttendanceBlockers(roster: LogRoster, draft: LogDraft) {
  const names = (people: LogPerson[]) => Object.fromEntries(people.map(({ id, name }) => [id, name]));
  return getAttendanceCompletionBlockers({
    staffIds: roster.staff.map(({ id }) => id),
    studentIds: roster.students.map(({ id }) => id),
    parentIds: roster.parents.map(({ id }) => id),
    includeParents: roster.parents.length > 0,
    staffNames: names(roster.staff),
    studentNames: names(roster.students),
    parentNames: names(roster.parents),
    ...attendanceFor(roster, draft),
  });
}

export function logLessonBlocker(sessionType: string | null, topicIds: string[]) {
  return needsTopic.has(sessionType ?? '') && !topicIds.length ? 'Select at least one topic.' : null;
}

export function buildLogSubmission(
  sessionId: string,
  sessionType: string | null,
  roster: LogRoster,
  draft: LogDraft,
): { blockers: string[] } | { payload: TutorLogSubmission } {
  const blockers = logAttendanceBlockers(roster, draft);
  const topicBlocker = logLessonBlocker(sessionType, Object.keys(draft.topics));
  if (topicBlocker) blockers.push(topicBlocker);
  if (blockers.length) return { blockers };

  const attendance = attendanceFor(roster, draft);
  const attendingIds = new Set(roster.students.filter(({ id }) => draft.students[id] === true).map(({ id }) => id));
  const assignedAttendees = (ids: string[]) => [...new Set(ids)].filter((id) => attendingIds.has(id));
  const topics = Object.entries(draft.topics).map(([topicId, studentIds]) => ({ topicId, studentIds: assignedAttendees(studentIds) }));
  const topicFiles = Object.entries(draft.files).flatMap(([topicsFilesId, { topicId, studentIds }]) =>
    Object.hasOwn(draft.topics, topicId) ? [{ topicsFilesId, topicId, studentIds: assignedAttendees(studentIds) }] : []);
  const note = draft.notes.trim();
  return {
    payload: {
      sessionId,
      staffAttendance: assertResolvedAttendanceRows(attendance.staffAttendance, 'Staff attendance'),
      studentAttendance: assertResolvedAttendanceRows(attendance.studentAttendance, 'Student attendance'),
      parentAttendance: assertResolvedAttendanceRows(attendance.parentAttendance, 'Parent attendance'),
      topics,
      topicFiles,
      notes: note ? [note] : [],
    },
  };
}
