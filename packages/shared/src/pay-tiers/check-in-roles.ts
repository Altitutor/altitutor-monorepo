/** Staff role on a CHECK_IN session (sessions_staff.type / tutor_logs_staff_attendance.type). */
export const CHECK_IN_HOST = 'CHECK_IN_HOST' as const;
export const CHECK_IN_RECEIVER = 'CHECK_IN_RECEIVER' as const;

export type CheckInStaffRole = typeof CHECK_IN_HOST | typeof CHECK_IN_RECEIVER;

export const CHECK_IN_STAFF_ROLES = [CHECK_IN_HOST, CHECK_IN_RECEIVER] as const;

export function isCheckInHostType(type: string | null | undefined): boolean {
  return type === CHECK_IN_HOST;
}

export function isCheckInReceiverType(type: string | null | undefined): boolean {
  return type === CHECK_IN_RECEIVER;
}

/** @deprecated Pre-migration CHECK_IN rows used MAIN_TUTOR as the reviewed staff member. */
export function isLegacyCheckInReceiverType(type: string | null | undefined): boolean {
  return type === 'MAIN_TUTOR';
}

export function isCheckInReceiverRole(type: string | null | undefined): boolean {
  return isCheckInReceiverType(type) || isLegacyCheckInReceiverType(type);
}

export function isCheckInHostRole(type: string | null | undefined): boolean {
  return isCheckInHostType(type) || type === 'SECONDARY_TUTOR' || type === 'TRIAL_TUTOR';
}

/** UI label for host (person conducting the check-in). */
export function formatCheckInHostLabel(): string {
  return 'Conducting';
}

/** UI label for receiver (staff member receiving the tier review). */
export function formatCheckInReceiverLabel(): string {
  return 'Receiving';
}

export function formatCheckInStaffRole(type: string | null | undefined): string | null {
  if (isCheckInHostRole(type) && !isCheckInReceiverRole(type)) return formatCheckInHostLabel();
  if (isCheckInReceiverRole(type)) return formatCheckInReceiverLabel();
  return null;
}

/** Map a sessions_staff / attendance type onto the CHECK_IN role enum (incl. legacy rows). */
export function toCheckInStaffRole(type: string | null | undefined): CheckInStaffRole {
  if (isCheckInReceiverRole(type)) return CHECK_IN_RECEIVER;
  return CHECK_IN_HOST;
}

const CLASS_STAFF_ATTENDANCE_LABELS: Record<string, string> = {
  MAIN_TUTOR: 'Main Tutor',
  SECONDARY_TUTOR: 'Secondary Tutor',
  TRIAL_TUTOR: 'Trial Tutor',
};

/**
 * Label for tutor-log staff attendance type.
 * Check-in sessions use Conducting/Receiving; other sessions use Main/Secondary/Trial.
 */
export function formatTutorLogStaffAttendanceLabel(
  type: string | null | undefined,
  sessionType?: string | null
): string {
  if (sessionType === 'CHECK_IN') {
    return formatCheckInStaffRole(type) ?? formatCheckInHostLabel();
  }
  if (type === CHECK_IN_HOST) return formatCheckInHostLabel();
  if (type === CHECK_IN_RECEIVER) return formatCheckInReceiverLabel();
  if (type && type in CLASS_STAFF_ATTENDANCE_LABELS) {
    return CLASS_STAFF_ATTENDANCE_LABELS[type]!;
  }
  return type ?? '';
}

export const CHECK_IN_STAFF_TYPE_OPTIONS = [
  { value: CHECK_IN_HOST, label: formatCheckInHostLabel() },
  { value: CHECK_IN_RECEIVER, label: formatCheckInReceiverLabel() },
] as const;

export const CLASS_STAFF_TYPE_OPTIONS = [
  { value: 'MAIN_TUTOR' as const, label: 'Main Tutor' },
  { value: 'SECONDARY_TUTOR' as const, label: 'Secondary Tutor' },
  { value: 'TRIAL_TUTOR' as const, label: 'Trial Tutor' },
] as const;

export type CheckInUiStaffRole = 'host' | 'receiver';

/** Default booking UI role: conducting when students/parents are present, otherwise receiving. */
export function defaultCheckInStaffUiRole(hasStudentsOrParents: boolean): CheckInUiStaffRole {
  return hasStudentsOrParents ? 'host' : 'receiver';
}

export function defaultCheckInSessionsStaffType(hasStudentsOrParents: boolean): CheckInStaffRole {
  return hasStudentsOrParents ? CHECK_IN_HOST : CHECK_IN_RECEIVER;
}

export function checkInStaffingError(input: {
  hostCount: number;
  receiverCount: number;
  hasStudentsOrParents: boolean;
}): string | null {
  if (input.hostCount + input.receiverCount === 0 || input.hostCount === 0) {
    return 'At least one conducting staff member is required for a check-in';
  }
  if (!input.hasStudentsOrParents && input.receiverCount === 0) {
    return 'At least one receiving staff member is required for a staff check-in';
  }
  return null;
}

export const CHECK_IN_LOG_FORBIDDEN_MESSAGE =
  'Only a conducting staff member can log a check-in';

/** Who may submit the tutor log. Check-ins are logged only by conducting staff. */
export function staffMaySubmitTutorLog(
  sessionType: string | null | undefined,
  assignmentType: string | null | undefined
): boolean {
  if (sessionType !== 'CHECK_IN') return true;
  return isCheckInHostRole(assignmentType);
}

export function filterSessionsStaffMayLog<T extends { id: string; type?: string | null }>(
  sessions: T[],
  assignmentTypeBySessionId: Readonly<Record<string, string | null | undefined>>
): T[] {
  return sessions.filter((session) =>
    staffMaySubmitTutorLog(session.type, assignmentTypeBySessionId[session.id])
  );
}
