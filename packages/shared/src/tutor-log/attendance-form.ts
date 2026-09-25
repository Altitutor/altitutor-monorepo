/** Unset until the user picks Attended or Did not attend in the tutor log wizard. */
export type TutorLogAttendanceChoice = boolean | null;

export function isTutorLogAttendanceChoiceResolved(
  value: TutorLogAttendanceChoice | undefined
): value is boolean {
  return value === true || value === false;
}

function everyMemberHasResolvedAttendance(
  memberIds: string[],
  attendanceByMemberId: Map<string, TutorLogAttendanceChoice | undefined>
): boolean {
  if (memberIds.length === 0) return true;
  return memberIds.every((id) => isTutorLogAttendanceChoiceResolved(attendanceByMemberId.get(id)));
}

function unresolvedMemberIds(
  memberIds: string[],
  attendanceByMemberId: Map<string, TutorLogAttendanceChoice | undefined>
): string[] {
  return memberIds.filter((id) => !isTutorLogAttendanceChoiceResolved(attendanceByMemberId.get(id)));
}

export function getAttendanceCompletionBlockers(args: {
  staffIds: string[];
  studentIds: string[];
  parentIds: string[];
  includeParents: boolean;
  staffAttendance: Array<{ staffId: string; attended: TutorLogAttendanceChoice | undefined }>;
  studentAttendance: Array<{ studentId: string; attended: TutorLogAttendanceChoice | undefined }>;
  parentAttendance: Array<{ parentId: string; attended: TutorLogAttendanceChoice | undefined }>;
  staffNames?: Record<string, string>;
  studentNames?: Record<string, string>;
  parentNames?: Record<string, string>;
}): string[] {
  const blockers: string[] = [];

  const staffById = new Map(args.staffAttendance.map((r) => [r.staffId, r.attended]));
  if (args.staffIds.length === 0) {
    blockers.push('Assign at least one staff member to this session.');
  } else {
    for (const id of unresolvedMemberIds(args.staffIds, staffById)) {
      const name = args.staffNames?.[id] ?? 'Staff member';
      blockers.push(`${name} (staff) — select Attended or Did not attend.`);
    }
  }

  const studentById = new Map(args.studentAttendance.map((r) => [r.studentId, r.attended]));
  for (const id of unresolvedMemberIds(args.studentIds, studentById)) {
    const name = args.studentNames?.[id] ?? 'Student';
    blockers.push(`${name} (student) — select Attended or Did not attend.`);
  }

  if (args.includeParents) {
    const parentById = new Map(args.parentAttendance.map((r) => [r.parentId, r.attended]));
    for (const id of unresolvedMemberIds(args.parentIds, parentById)) {
      const name = args.parentNames?.[id] ?? 'Parent';
      blockers.push(`${name} (parent) — select Attended or Did not attend.`);
    }
  }

  return blockers;
}

export function hasCompleteStaffAttendanceForSession(
  staffIds: string[],
  rows: Array<{ staffId: string; attended: TutorLogAttendanceChoice | undefined }>
): boolean {
  if (staffIds.length === 0) return false;
  const byId = new Map(rows.map((r) => [r.staffId, r.attended]));
  return everyMemberHasResolvedAttendance(staffIds, byId);
}

export function hasCompleteStudentAttendanceForSession(
  studentIds: string[],
  rows: Array<{ studentId: string; attended: TutorLogAttendanceChoice | undefined }>
): boolean {
  const byId = new Map(rows.map((r) => [r.studentId, r.attended]));
  return everyMemberHasResolvedAttendance(studentIds, byId);
}

export function hasCompleteParentAttendanceForSession(
  parentIds: string[],
  rows: Array<{ parentId: string; attended: TutorLogAttendanceChoice | undefined }>
): boolean {
  const byId = new Map(rows.map((r) => [r.parentId, r.attended]));
  return everyMemberHasResolvedAttendance(parentIds, byId);
}

export function meetingAttendanceStepIsComplete(args: {
  staffIds: string[];
  studentIds: string[];
  parentIds: string[];
  staffAttendance: Array<{ staffId: string; attended: TutorLogAttendanceChoice | undefined }>;
  studentAttendance: Array<{ studentId: string; attended: TutorLogAttendanceChoice | undefined }>;
  parentAttendance: Array<{ parentId: string; attended: TutorLogAttendanceChoice | undefined }>;
}): boolean {
  return (
    hasCompleteStaffAttendanceForSession(args.staffIds, args.staffAttendance) &&
    hasCompleteStudentAttendanceForSession(args.studentIds, args.studentAttendance) &&
    hasCompleteParentAttendanceForSession(args.parentIds, args.parentAttendance)
  );
}

export function assertResolvedAttendanceRows<
  T extends { attended: TutorLogAttendanceChoice | undefined },
>(rows: T[], label: string): Array<Omit<T, 'attended'> & { attended: boolean }> {
  return rows.map((row) => {
    if (!isTutorLogAttendanceChoiceResolved(row.attended)) {
      throw new Error(`${label} is incomplete`);
    }
    return { ...row, attended: row.attended };
  });
}
