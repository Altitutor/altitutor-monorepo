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
