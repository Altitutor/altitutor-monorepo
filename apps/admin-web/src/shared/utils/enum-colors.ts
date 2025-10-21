// Minimal string literal types and plain string keys (no enum constant usage)
import type { Tables } from '@altitutor/shared';
type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'TRIAL' | 'DISCONTINUED';
type StaffRole = 'ADMIN' | 'TUTOR' | 'ADMINSTAFF';
type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'TRIAL';
type SubjectCurriculum = 'SACE' | 'IB' | 'PRESACE' | 'PRIMARY' | 'MEDICINE';
type SubjectDiscipline = 'MATHEMATICS' | 'SCIENCE' | 'HUMANITIES' | 'ENGLISH' | 'ART' | 'LANGUAGE' | 'MEDICINE';
type ClassStatus = 'ACTIVE' | 'INACTIVE' | 'FULL';
type EnrollmentStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED' | 'TRIAL';
type AbsenceType = 'PLANNED' | 'UNPLANNED';
type MeetingType = 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW' | 'PARENT_MEETING' | 'OTHER';
type SessionType = 'CLASS' | 'DRAFTING' | 'SUBSIDY_INTERVIEW' | 'TRIAL_SESSION' | 'TRIAL_SHIFT' | 'STAFF_INTERVIEW';
type MessageStatus = 'DRAFT' | 'SENT' | 'FAILED';

// Color mapping types
export type BadgeColorClass = string;

/**
 * Centralized color mappings for all enum types used in badges
 * This ensures consistent colors across the entire application
 */

// Student Status Colors
export const STUDENT_STATUS_COLORS: Record<StudentStatus, BadgeColorClass> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  TRIAL: 'bg-orange-100 text-orange-800',
  DISCONTINUED: 'bg-red-100 text-red-800',
};

// Staff Role Colors
export const STAFF_ROLE_COLORS: Record<StaffRole, BadgeColorClass> = {
  ADMIN: 'bg-purple-100 text-purple-800',
  TUTOR: 'bg-blue-100 text-blue-800',
  ADMINSTAFF: 'bg-indigo-100 text-indigo-800',
};

// Staff Status Colors
export const STAFF_STATUS_COLORS: Record<StaffStatus, BadgeColorClass> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  TRIAL: 'bg-orange-100 text-orange-800',
};

// Subject Curriculum Colors
export const SUBJECT_CURRICULUM_COLORS: Record<SubjectCurriculum, BadgeColorClass> = {
  SACE: 'bg-blue-100 text-blue-800',
  IB: 'bg-purple-100 text-purple-800',
  PRESACE: 'bg-green-100 text-green-800',
  PRIMARY: 'bg-yellow-100 text-yellow-800',
  MEDICINE: 'bg-red-100 text-red-800',
};

// Subject Discipline Colors
export const SUBJECT_DISCIPLINE_COLORS: Record<SubjectDiscipline, BadgeColorClass> = {
  MATHEMATICS: 'bg-indigo-100 text-indigo-800',
  SCIENCE: 'bg-emerald-100 text-emerald-800',
  HUMANITIES: 'bg-amber-100 text-amber-800',
  ENGLISH: 'bg-rose-100 text-rose-800',
  ART: 'bg-pink-100 text-pink-800',
  LANGUAGE: 'bg-cyan-100 text-cyan-800',
  MEDICINE: 'bg-red-100 text-red-800',
};

// Class Status Colors
export const CLASS_STATUS_COLORS: Record<ClassStatus, BadgeColorClass> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  FULL: 'bg-orange-100 text-orange-800',
};

// Enrollment Status Colors
const enrollmentStatusColors: Record<EnrollmentStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
  DISCONTINUED: 'bg-red-100 text-red-800',
  TRIAL: 'bg-blue-100 text-blue-800',
};

// Absence Type Colors
export const ABSENCE_TYPE_COLORS: Record<AbsenceType, BadgeColorClass> = {
  PLANNED: 'bg-blue-100 text-blue-800',
  UNPLANNED: 'bg-orange-100 text-orange-800',
};

// Meeting Type Colors
export const MEETING_TYPE_COLORS: Record<MeetingType, BadgeColorClass> = {
  TRIAL_SESSION: 'bg-orange-100 text-orange-800',
  SUBSIDY_INTERVIEW: 'bg-purple-100 text-purple-800',
  PARENT_MEETING: 'bg-blue-100 text-blue-800',
  OTHER: 'bg-gray-100 text-gray-800',
};

// Session Type Colors
export const SESSION_TYPE_COLORS: Record<SessionType, BadgeColorClass> = {
  CLASS: 'bg-blue-100 text-blue-800',
  DRAFTING: 'bg-green-100 text-green-800',
  SUBSIDY_INTERVIEW: 'bg-purple-100 text-purple-800',
  TRIAL_SESSION: 'bg-orange-100 text-orange-800',
  TRIAL_SHIFT: 'bg-yellow-100 text-yellow-800',
  STAFF_INTERVIEW: 'bg-indigo-100 text-indigo-800',
};

// Message Status Colors
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, BadgeColorClass> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
};

// Additional utility colors for boolean values
export const BOOLEAN_COLORS = {
  true: 'bg-green-100 text-green-800',
  false: 'bg-gray-100 text-gray-800',
} as const;

// Parking remote colors (specific to staff)
export const PARKING_REMOTE_COLORS = {
  PHYSICAL: 'bg-blue-100 text-blue-800',
  VIRTUAL: 'bg-purple-100 text-purple-800',
  NONE: 'bg-gray-100 text-gray-800',
} as const;

/**
 * Helper functions to get colors for specific enum types
 * These provide type safety and fallback to gray if value is invalid
 */

export function getStudentStatusColor(
  status: StudentStatus | Tables<'students'>['status'] | string | null | undefined
): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return STUDENT_STATUS_COLORS[status as StudentStatus] ?? 'bg-gray-100 text-gray-800';
}

export function getStaffRoleColor(role: StaffRole | string | null | undefined): BadgeColorClass {
  if (!role) return 'bg-gray-100 text-gray-800';
  return STAFF_ROLE_COLORS[role as StaffRole] ?? 'bg-gray-100 text-gray-800';
}

export function getStaffStatusColor(status: StaffStatus | string | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return STAFF_STATUS_COLORS[status as StaffStatus] ?? 'bg-gray-100 text-gray-800';
}

export function getSubjectCurriculumColor(
  curriculum: SubjectCurriculum | Tables<'students'>['curriculum'] | string | null | undefined
): BadgeColorClass {
  if (!curriculum) return 'bg-gray-100 text-gray-800';
  return SUBJECT_CURRICULUM_COLORS[curriculum as SubjectCurriculum] ?? 'bg-gray-100 text-gray-800';
}

export function getSubjectDisciplineColor(discipline: SubjectDiscipline | string | null | undefined): BadgeColorClass {
  if (!discipline) return 'bg-gray-100 text-gray-800';
  return SUBJECT_DISCIPLINE_COLORS[discipline as SubjectDiscipline] ?? 'bg-gray-100 text-gray-800';
}

export function getClassStatusColor(status: ClassStatus | string | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return CLASS_STATUS_COLORS[status as ClassStatus] ?? 'bg-gray-100 text-gray-800';
}

export function getEnrollmentStatusColor(status: EnrollmentStatus | string | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return enrollmentStatusColors[status as EnrollmentStatus] ?? 'bg-gray-100 text-gray-800';
}

export function getAbsenceTypeColor(type: AbsenceType | string | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return ABSENCE_TYPE_COLORS[type as AbsenceType] ?? 'bg-gray-100 text-gray-800';
}

export function getMeetingTypeColor(type: MeetingType | string | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return MEETING_TYPE_COLORS[type as MeetingType] ?? 'bg-gray-100 text-gray-800';
}

export function getSessionTypeColor(type: SessionType | string | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return SESSION_TYPE_COLORS[type as SessionType] ?? 'bg-gray-100 text-gray-800';
}

export function getMessageStatusColor(status: MessageStatus | string | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return MESSAGE_STATUS_COLORS[status as MessageStatus] ?? 'bg-gray-100 text-gray-800';
}

export function getBooleanColor(value: boolean | null | undefined): BadgeColorClass {
  if (value === null || value === undefined) return 'bg-gray-100 text-gray-800';
  return BOOLEAN_COLORS[value.toString() as keyof typeof BOOLEAN_COLORS];
}

export function getParkingRemoteColor(remote: 'PHYSICAL' | 'VIRTUAL' | 'NONE' | null | undefined): BadgeColorClass {
  if (!remote) return 'bg-gray-100 text-gray-800';
  return PARKING_REMOTE_COLORS[remote] ?? 'bg-gray-100 text-gray-800';
}

/**
 * Generic function that can handle any enum type
 * Useful for dynamic scenarios where the enum type isn't known at compile time
 */
export function getEnumColor<T extends string>(
  value: T | null | undefined,
  colorMap: Record<T, BadgeColorClass>
): BadgeColorClass {
  if (!value) return 'bg-gray-100 text-gray-800';
  return colorMap[value] ?? 'bg-gray-100 text-gray-800';
} 