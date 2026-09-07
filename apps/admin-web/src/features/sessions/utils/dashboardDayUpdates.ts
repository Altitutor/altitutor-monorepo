import { format } from 'date-fns';
import { getClassDisplay, getClassShortDisplay } from '@/features/students/utils/sessionDisplayHelpers';
import { formatSessionType } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';

export const DASHBOARD_MEETING_TYPES = [
  'ADMIN_MEETING',
  'CHECK_IN',
  'STAFF_INTERVIEW',
  'SUBSIDY_INTERVIEW',
  'TRIAL_SESSION',
] as const;

const MEETING_TYPE_SET = new Set<string>(DASHBOARD_MEETING_TYPES);

const TEACHING_TYPE_SET = new Set(['CLASS', 'DRAFTING', 'EXAM_COURSE']);

export type DashboardDaySession = {
  id: string;
  type: string | null;
  class_id: string | null;
  start_at: string | null;
  end_at: string | null;
  original_start_at?: string | null;
  original_end_at?: string | null;
  short_name?: string | null;
  long_name?: string | null;
};

export type DashboardDayStudent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  planned_absence?: boolean;
  is_extra?: boolean;
  sessions_students_id?: string | null;
};

export type DashboardDayStaff = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  planned_absence?: boolean;
  is_swapped?: boolean;
  is_swapped_in?: boolean;
  was_trial?: boolean;
  swapped_staff?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
};

export type DashboardDayParent = {
  id: string;
  first_name: string | null;
  last_name: string | null;
};

export type DashboardClassStaffAssignment = {
  class_id: string;
  staff_id: string;
  assigned_at: string;
  unassigned_at: string | null;
};

export type DashboardDayUpdateKind =
  | 'meeting'
  | 'time_change'
  | 'student_absence'
  | 'extra_student'
  | 'staff_swap'
  | 'staff_absence'
  | 'extra_staff'
  | 'trial_tutor';

export type DashboardDayUpdateItem = {
  kind: DashboardDayUpdateKind;
  sessionId: string;
  sessionLabel: string;
  startAt: string | null;
  endAt: string | null;
  originalStartAt?: string | null;
  originalEndAt?: string | null;
  personName?: string;
  incomingName?: string;
  attendeeNames?: string;
};

export type DashboardDayUpdates = {
  meetings: DashboardDayUpdateItem[];
  timeChanges: DashboardDayUpdateItem[];
  studentAbsences: DashboardDayUpdateItem[];
  extraStudents: DashboardDayUpdateItem[];
  staffSwaps: DashboardDayUpdateItem[];
  staffAbsences: DashboardDayUpdateItem[];
  extraStaff: DashboardDayUpdateItem[];
  trialTutors: DashboardDayUpdateItem[];
};

export type BuildDashboardDayUpdatesInput = {
  sessions: DashboardDaySession[];
  sessionStudents: Record<string, DashboardDayStudent[]>;
  sessionStaff: Record<string, DashboardDayStaff[]>;
  sessionParents?: Record<string, DashboardDayParent[]>;
  classesById: Record<string, Tables<'classes'>>;
  subjectsById: Record<string, Tables<'subjects'>>;
  classStaffAssignments?: DashboardClassStaffAssignment[];
  viewDate?: string;
};

function personName(person: { first_name: string | null; last_name: string | null }): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Unknown';
}

function isPlannedTrialStaff(member: DashboardDayStaff): boolean {
  return member.was_trial === true && !member.planned_absence;
}

function timestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function calendarDate(value: string | null | undefined): string | null {
  const ms = timestampMs(value);
  if (ms === null) return null;
  return format(new Date(ms), 'yyyy-MM-dd');
}

function timesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  const aMs = timestampMs(a);
  const bMs = timestampMs(b);
  if (aMs === null || bMs === null) return false;
  return aMs !== bMs;
}

function isMeetingType(type: string | null): boolean {
  return type != null && MEETING_TYPE_SET.has(type);
}

function isTeachingType(type: string | null): boolean {
  return type != null && TEACHING_TYPE_SET.has(type);
}

function sessionLabel(
  session: DashboardDaySession,
  classesById: Record<string, Tables<'classes'>>,
  subjectsById: Record<string, Tables<'subjects'>>
): string {
  const asTablesSession = session as Tables<'sessions'>;
  const shortName = getClassShortDisplay(asTablesSession, classesById, subjectsById);
  if (shortName) return shortName;
  const longName = getClassDisplay(asTablesSession, classesById, subjectsById);
  if (longName) return longName;
  return formatSessionType(session.type);
}

function isRegularClassStaff(
  assignmentsByClass: Map<string, DashboardClassStaffAssignment[]>,
  classId: string,
  staffId: string,
  sessionStartAt: string | null
): boolean {
  const assignments = assignmentsByClass.get(classId);
  if (!assignments || assignments.length === 0) return false;

  const sessionMs = timestampMs(sessionStartAt);
  return assignments.some((assignment) => {
    if (assignment.staff_id !== staffId) return false;
    const assignedMs = timestampMs(assignment.assigned_at);
    const unassignedMs = timestampMs(assignment.unassigned_at);
    if (sessionMs === null) {
      return unassignedMs === null;
    }
    if (assignedMs !== null && assignedMs > sessionMs) return false;
    if (unassignedMs !== null && unassignedMs <= sessionMs) return false;
    return true;
  });
}

function pairStaffSwaps(staff: DashboardDayStaff[]): {
  pairs: Array<{ outgoing: DashboardDayStaff; incomingId: string; incomingName: string }>;
  usedOutgoingIds: Set<string>;
  usedIncomingIds: Set<string>;
} {
  const pairs: Array<{ outgoing: DashboardDayStaff; incomingId: string; incomingName: string }> = [];
  const usedOutgoingIds = new Set<string>();
  const usedIncomingIds = new Set<string>();

  for (const member of staff) {
    if (!member.planned_absence || !member.is_swapped || !member.swapped_staff) continue;
    pairs.push({
      outgoing: member,
      incomingId: member.swapped_staff.id,
      incomingName: personName(member.swapped_staff),
    });
    usedOutgoingIds.add(member.id);
    usedIncomingIds.add(member.swapped_staff.id);
  }

  const unpairedAbsences = staff.filter((member) => member.planned_absence && !usedOutgoingIds.has(member.id));
  const unpairedIncoming = staff.filter((member) => member.is_swapped_in === true && !usedIncomingIds.has(member.id));
  if (unpairedAbsences.length === 1 && unpairedIncoming.length === 1) {
    const [outgoing] = unpairedAbsences;
    const [incoming] = unpairedIncoming;
    pairs.push({
      outgoing,
      incomingId: incoming.id,
      incomingName: personName(incoming),
    });
    usedOutgoingIds.add(outgoing.id);
    usedIncomingIds.add(incoming.id);
  }

  return { pairs, usedOutgoingIds, usedIncomingIds };
}

export const DASHBOARD_UPDATES_TYPE_SECTIONS: Array<{
  key: keyof DashboardDayUpdates;
  title: string;
}> = [
  { key: 'meetings', title: 'Meetings' },
  { key: 'timeChanges', title: 'Rescheduled sessions' },
  { key: 'studentAbsences', title: 'Student absences' },
  { key: 'extraStudents', title: 'Extra students' },
  { key: 'staffSwaps', title: 'Staff swaps' },
  { key: 'staffAbsences', title: 'Staff absences' },
  { key: 'trialTutors', title: 'Trial tutors' },
  { key: 'extraStaff', title: 'Extra staff' },
];

const DASHBOARD_UPDATE_KIND_SECTION_KEY: Record<DashboardDayUpdateKind, keyof DashboardDayUpdates> = {
  meeting: 'meetings',
  time_change: 'timeChanges',
  student_absence: 'studentAbsences',
  extra_student: 'extraStudents',
  staff_swap: 'staffSwaps',
  staff_absence: 'staffAbsences',
  trial_tutor: 'trialTutors',
  extra_staff: 'extraStaff',
};

export function getDashboardDayUpdateKindLabel(kind: DashboardDayUpdateKind): string {
  const sectionKey = DASHBOARD_UPDATE_KIND_SECTION_KEY[kind];
  return DASHBOARD_UPDATES_TYPE_SECTIONS.find((section) => section.key === sectionKey)?.title ?? kind;
}

export type DashboardDayUpdateGroup = {
  key: string;
  title: string;
  items: DashboardDayUpdateItem[];
};

export type DashboardUpdatesSortMode = 'time' | 'type' | 'staff' | 'student';

export const DASHBOARD_UPDATES_SORT_OPTIONS: Array<{
  id: DashboardUpdatesSortMode;
  label: string;
}> = [
  { id: 'time', label: 'Time' },
  { id: 'type', label: 'Type' },
  { id: 'staff', label: 'Staff' },
  { id: 'student', label: 'Student' },
];

const STAFF_UPDATE_KINDS = new Set<DashboardDayUpdateKind>([
  'staff_swap',
  'staff_absence',
  'extra_staff',
  'trial_tutor',
]);

const STUDENT_UPDATE_KINDS = new Set<DashboardDayUpdateKind>([
  'student_absence',
  'extra_student',
]);

function byStartThenLabel(a: DashboardDayUpdateItem, b: DashboardDayUpdateItem): number {
  const aMs = timestampMs(a.startAt) ?? 0;
  const bMs = timestampMs(b.startAt) ?? 0;
  if (aMs !== bMs) return aMs - bMs;
  const labelCmp = a.sessionLabel.localeCompare(b.sessionLabel);
  if (labelCmp !== 0) return labelCmp;
  const outgoingCmp = (a.personName ?? '').localeCompare(b.personName ?? '');
  if (outgoingCmp !== 0) return outgoingCmp;
  return (a.incomingName ?? '').localeCompare(b.incomingName ?? '');
}

function byStaffThenLabel(a: DashboardDayUpdateItem, b: DashboardDayUpdateItem): number {
  const aIsStaff = STAFF_UPDATE_KINDS.has(a.kind);
  const bIsStaff = STAFF_UPDATE_KINDS.has(b.kind);
  if (aIsStaff !== bIsStaff) return aIsStaff ? -1 : 1;

  const aKey = aIsStaff ? (a.personName ?? '') : a.sessionLabel;
  const bKey = bIsStaff ? (b.personName ?? '') : b.sessionLabel;
  const keyCmp = aKey.localeCompare(bKey);
  if (keyCmp !== 0) return keyCmp;
  return byStartThenLabel(a, b);
}

function byStudentThenLabel(a: DashboardDayUpdateItem, b: DashboardDayUpdateItem): number {
  const aIsStudent = STUDENT_UPDATE_KINDS.has(a.kind);
  const bIsStudent = STUDENT_UPDATE_KINDS.has(b.kind);
  if (aIsStudent !== bIsStudent) return aIsStudent ? -1 : 1;

  const aKey = aIsStudent ? (a.personName ?? '') : a.sessionLabel;
  const bKey = bIsStudent ? (b.personName ?? '') : b.sessionLabel;
  const keyCmp = aKey.localeCompare(bKey);
  if (keyCmp !== 0) return keyCmp;
  return byStartThenLabel(a, b);
}

export function flattenDashboardDayUpdates(updates: DashboardDayUpdates): DashboardDayUpdateItem[] {
  return [
    ...updates.meetings,
    ...updates.timeChanges,
    ...updates.studentAbsences,
    ...updates.extraStudents,
    ...updates.staffSwaps,
    ...updates.staffAbsences,
    ...updates.extraStaff,
    ...updates.trialTutors,
  ];
}

export function sortDashboardDayUpdateItems(
  items: DashboardDayUpdateItem[],
  mode: Exclude<DashboardUpdatesSortMode, 'type'>
): DashboardDayUpdateItem[] {
  const sorted = [...items];
  switch (mode) {
    case 'time':
      sorted.sort(byStartThenLabel);
      break;
    case 'staff':
      sorted.sort(byStaffThenLabel);
      break;
    case 'student':
      sorted.sort(byStudentThenLabel);
      break;
  }
  return sorted;
}

function getDashboardDayUpdateGroupKey(
  item: DashboardDayUpdateItem,
  mode: Exclude<DashboardUpdatesSortMode, 'type'>
): string {
  switch (mode) {
    case 'time':
      return item.startAt ?? '__no_time__';
    case 'staff':
      if (STAFF_UPDATE_KINDS.has(item.kind)) {
        return `staff:${item.personName ?? ''}`;
      }
      return `session:${item.sessionLabel}`;
    case 'student':
      if (STUDENT_UPDATE_KINDS.has(item.kind)) {
        return `student:${item.personName ?? ''}`;
      }
      return `session:${item.sessionLabel}`;
  }
}

function getDashboardDayUpdateGroupTitle(
  item: DashboardDayUpdateItem,
  mode: Exclude<DashboardUpdatesSortMode, 'type'>
): string {
  switch (mode) {
    case 'time':
      if (!item.startAt) return 'Time not set';
      return format(new Date(item.startAt), 'h:mm a');
    case 'staff':
      if (STAFF_UPDATE_KINDS.has(item.kind)) {
        return item.personName ?? 'Unknown staff';
      }
      return item.sessionLabel;
    case 'student':
      if (STUDENT_UPDATE_KINDS.has(item.kind)) {
        return item.personName ?? 'Unknown student';
      }
      return item.sessionLabel;
  }
}

export function groupDashboardDayUpdateItems(
  updates: DashboardDayUpdates,
  mode: DashboardUpdatesSortMode
): DashboardDayUpdateGroup[] {
  if (mode === 'type') {
    return DASHBOARD_UPDATES_TYPE_SECTIONS
      .map(({ key, title }) => ({
        key,
        title,
        items: updates[key],
      }))
      .filter((group) => group.items.length > 0);
  }

  const sorted = sortDashboardDayUpdateItems(flattenDashboardDayUpdates(updates), mode);
  const groups: DashboardDayUpdateGroup[] = [];

  for (const item of sorted) {
    const key = getDashboardDayUpdateGroupKey(item, mode);
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({
        key,
        title: getDashboardDayUpdateGroupTitle(item, mode),
        items: [item],
      });
    }
  }

  return groups;
}

export function hasDashboardDayUpdates(updates: DashboardDayUpdates): boolean {
  return (
    updates.meetings.length > 0 ||
    updates.timeChanges.length > 0 ||
    updates.studentAbsences.length > 0 ||
    updates.extraStudents.length > 0 ||
    updates.staffSwaps.length > 0 ||
    updates.staffAbsences.length > 0 ||
    updates.extraStaff.length > 0 ||
    updates.trialTutors.length > 0
  );
}

export function buildDashboardDayUpdates({
  sessions,
  sessionStudents,
  sessionStaff,
  sessionParents = {},
  classesById,
  subjectsById,
  classStaffAssignments = [],
  viewDate,
}: BuildDashboardDayUpdatesInput): DashboardDayUpdates {
  const assignmentsByClass = new Map<string, DashboardClassStaffAssignment[]>();
  for (const assignment of classStaffAssignments) {
    const existing = assignmentsByClass.get(assignment.class_id);
    if (existing) existing.push(assignment);
    else assignmentsByClass.set(assignment.class_id, [assignment]);
  }

  const updates: DashboardDayUpdates = {
    meetings: [],
    timeChanges: [],
    studentAbsences: [],
    extraStudents: [],
    staffSwaps: [],
    staffAbsences: [],
    extraStaff: [],
    trialTutors: [],
  };

  for (const session of sessions) {
    const label = sessionLabel(session, classesById, subjectsById);
    const students = sessionStudents[session.id] ?? [];
    const staff = sessionStaff[session.id] ?? [];
    const parents = sessionParents[session.id] ?? [];
    const startDate = calendarDate(session.start_at);
    const originalDate = calendarDate(session.original_start_at);
    const isOnViewedDay = viewDate == null || startDate === viewDate;
    const originallyOnViewedDay = viewDate != null && originalDate === viewDate;
    const scheduleChanged =
      isTeachingType(session.type) &&
      (timesDiffer(session.start_at, session.original_start_at) ||
        timesDiffer(session.end_at, session.original_end_at));

    if (scheduleChanged && (isOnViewedDay || originallyOnViewedDay)) {
      updates.timeChanges.push({
        kind: 'time_change',
        sessionId: session.id,
        sessionLabel: label,
        startAt: session.start_at,
        endAt: session.end_at,
        originalStartAt: session.original_start_at,
        originalEndAt: session.original_end_at,
      });
    }

    if (!isOnViewedDay) continue;

    if (isMeetingType(session.type)) {
      const attendees = [...students, ...parents, ...staff].map(personName).filter(Boolean);
      updates.meetings.push({
        kind: 'meeting',
        sessionId: session.id,
        sessionLabel: label,
        startAt: session.start_at,
        endAt: session.end_at,
        attendeeNames: attendees.length > 0 ? attendees.join(', ') : undefined,
      });
    }

    for (const student of students) {
      const name = personName(student);
      if (student.planned_absence) {
        updates.studentAbsences.push({
          kind: 'student_absence',
          sessionId: session.id,
          sessionLabel: label,
          startAt: session.start_at,
          endAt: session.end_at,
          personName: name,
        });
      }

      const isPlannedExtra =
        student.is_extra === true &&
        !student.planned_absence &&
        student.sessions_students_id != null &&
        isTeachingType(session.type);

      if (isPlannedExtra) {
        updates.extraStudents.push({
          kind: 'extra_student',
          sessionId: session.id,
          sessionLabel: label,
          startAt: session.start_at,
          endAt: session.end_at,
          personName: name,
        });
      }
    }

    const classHasAssignments =
      session.class_id != null && (assignmentsByClass.get(session.class_id)?.length ?? 0) > 0;
    const { pairs, usedOutgoingIds, usedIncomingIds } = pairStaffSwaps(staff);

    for (const pair of pairs) {
      updates.staffSwaps.push({
        kind: 'staff_swap',
        sessionId: session.id,
        sessionLabel: label,
        startAt: session.start_at,
        endAt: session.end_at,
        personName: personName(pair.outgoing),
        incomingName: pair.incomingName,
      });
    }

    for (const member of staff) {
      if (isPlannedTrialStaff(member)) {
        updates.trialTutors.push({
          kind: 'trial_tutor',
          sessionId: session.id,
          sessionLabel: label,
          startAt: session.start_at,
          endAt: session.end_at,
          personName: personName(member),
        });
      }

      if (member.planned_absence) {
        if (usedOutgoingIds.has(member.id)) continue;
        updates.staffAbsences.push({
          kind: 'staff_absence',
          sessionId: session.id,
          sessionLabel: label,
          startAt: session.start_at,
          endAt: session.end_at,
          personName: personName(member),
        });
        continue;
      }

      if (usedIncomingIds.has(member.id)) continue;
      if (!isTeachingType(session.type)) continue;

      const isExtraStaff =
        member.is_swapped_in === true ||
        (session.class_id != null &&
          classHasAssignments &&
          !isRegularClassStaff(assignmentsByClass, session.class_id, member.id, session.start_at));

      if (isExtraStaff) {
        updates.extraStaff.push({
          kind: 'extra_staff',
          sessionId: session.id,
          sessionLabel: label,
          startAt: session.start_at,
          endAt: session.end_at,
          personName: personName(member),
        });
      }
    }
  }

  updates.meetings.sort(byStartThenLabel);
  updates.timeChanges.sort(byStartThenLabel);
  updates.studentAbsences.sort(byStartThenLabel);
  updates.extraStudents.sort(byStartThenLabel);
  updates.staffSwaps.sort(byStartThenLabel);
  updates.staffAbsences.sort(byStartThenLabel);
  updates.extraStaff.sort(byStartThenLabel);
  updates.trialTutors.sort(byStartThenLabel);

  return updates;
}
