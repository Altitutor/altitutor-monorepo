/**
 * Attendance Status Constants
 * 
 * Centralized definitions for all attendance status types used throughout the application.
 * These constants ensure type safety and consistency across the codebase.
 */

/**
 * Planned attendance statuses for students
 */
export const STUDENT_PLANNED_STATUSES = {
  ATTENDING: 'attending',
  ATTENDING_EXTRA: 'attending-extra',
  ATTENDING_TRIAL: 'attending-trial',
  ATTENDING_EXTRA_TRIAL: 'attending-extra-trial',
  ABSENT: 'absent',
  RESCHEDULED: 'rescheduled',
  CREDITED: 'credited',
  UNPLANNED: 'unplanned',
} as const;

export type StudentPlannedStatus = typeof STUDENT_PLANNED_STATUSES[keyof typeof STUDENT_PLANNED_STATUSES];

/**
 * Actual attendance statuses for students
 */
export const STUDENT_ACTUAL_STATUSES = {
  NOT_LOGGED: 'not-logged',
  ATTENDED: 'attended',
  ATTENDED_TRIAL: 'attended-trial',
  DID_NOT_ATTEND: 'did-not-attend',
} as const;

export type StudentActualStatus = typeof STUDENT_ACTUAL_STATUSES[keyof typeof STUDENT_ACTUAL_STATUSES];

/**
 * Planned attendance statuses for staff
 */
export const STAFF_PLANNED_STATUSES = {
  ATTENDING: 'attending',
  ATTENDING_TRIAL: 'attending-trial',
  ABSENT: 'absent',
  SWAPPED: 'swapped',
} as const;

export type StaffPlannedStatus = typeof STAFF_PLANNED_STATUSES[keyof typeof STAFF_PLANNED_STATUSES];

/**
 * Actual attendance statuses for staff
 */
export const STAFF_ACTUAL_STATUSES = {
  NOT_LOGGED: 'not-logged',
  ATTENDED: 'attended',
  ATTENDED_TRIAL: 'attended-trial',
  DID_NOT_ATTEND: 'did-not-attend',
} as const;

export type StaffActualStatus = typeof STAFF_ACTUAL_STATUSES[keyof typeof STAFF_ACTUAL_STATUSES];

/**
 * Combined student attendance status type
 */
export type StudentAttendanceStatus = {
  plannedStatus: StudentPlannedStatus;
  actualStatus: StudentActualStatus;
  rescheduledSessionId: string;
  rescheduledDate: string;
};

/**
 * Combined staff attendance status type
 */
export type StaffAttendanceStatus = {
  plannedStatus: StaffPlannedStatus;
  actualStatus: StaffActualStatus;
  swappedStaffId: string;
  swappedStaffName: string;
};

/**
 * All valid attendance status strings (for type checking and validation)
 */
export const ALL_ATTENDANCE_STATUSES = {
  ...STUDENT_PLANNED_STATUSES,
  ...STUDENT_ACTUAL_STATUSES,
  ...STAFF_PLANNED_STATUSES,
  ...STAFF_ACTUAL_STATUSES,
} as const;

/**
 * Type guard to check if a string is a valid student planned status
 */
export function isStudentPlannedStatus(status: string): status is StudentPlannedStatus {
  return Object.values(STUDENT_PLANNED_STATUSES).includes(status as StudentPlannedStatus);
}

/**
 * Type guard to check if a string is a valid student actual status
 */
export function isStudentActualStatus(status: string): status is StudentActualStatus {
  return Object.values(STUDENT_ACTUAL_STATUSES).includes(status as StudentActualStatus);
}

/**
 * Type guard to check if a string is a valid staff planned status
 */
export function isStaffPlannedStatus(status: string): status is StaffPlannedStatus {
  return Object.values(STAFF_PLANNED_STATUSES).includes(status as StaffPlannedStatus);
}

/**
 * Type guard to check if a string is a valid staff actual status
 */
export function isStaffActualStatus(status: string): status is StaffActualStatus {
  return Object.values(STAFF_ACTUAL_STATUSES).includes(status as StaffActualStatus);
}
