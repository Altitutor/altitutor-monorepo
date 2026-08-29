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
