import {
  StudentStatus,
  StaffRole,
  StaffStatus,
  SubjectCurriculum,
  SubjectDiscipline,
  ClassStatus,
  EnrollmentStatus,
  AbsenceType,
  MeetingType,
  DraftingType,
  MessageType,
  MessageStatus,
  FileType,
  SessionType,
  AuditAction,
} from '@/lib/supabase/db/types';

// Color mapping types
export type BadgeColorClass = string;

/**
 * Centralized color mappings for all enum types used in badges
 * This ensures consistent colors across the entire application
 */

// Student Status Colors
export const STUDENT_STATUS_COLORS: Record<StudentStatus, BadgeColorClass> = {
  [StudentStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [StudentStatus.INACTIVE]: 'bg-gray-100 text-gray-800',
  [StudentStatus.TRIAL]: 'bg-orange-100 text-orange-800',
  [StudentStatus.DISCONTINUED]: 'bg-red-100 text-red-800',
};

// Staff Role Colors
export const STAFF_ROLE_COLORS: Record<StaffRole, BadgeColorClass> = {
  [StaffRole.ADMIN]: 'bg-purple-100 text-purple-800',
  [StaffRole.TUTOR]: 'bg-blue-100 text-blue-800',
  [StaffRole.ADMINSTAFF]: 'bg-indigo-100 text-indigo-800',
};

// Staff Status Colors
export const STAFF_STATUS_COLORS: Record<StaffStatus, BadgeColorClass> = {
  [StaffStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [StaffStatus.INACTIVE]: 'bg-gray-100 text-gray-800',
  [StaffStatus.TRIAL]: 'bg-orange-100 text-orange-800',
};

// Subject Curriculum Colors
export const SUBJECT_CURRICULUM_COLORS: Record<SubjectCurriculum, BadgeColorClass> = {
  [SubjectCurriculum.SACE]: 'bg-blue-100 text-blue-800',
  [SubjectCurriculum.IB]: 'bg-purple-100 text-purple-800',
  [SubjectCurriculum.PRESACE]: 'bg-green-100 text-green-800',
  [SubjectCurriculum.PRIMARY]: 'bg-yellow-100 text-yellow-800',
  [SubjectCurriculum.MEDICINE]: 'bg-red-100 text-red-800',
};

// Subject Discipline Colors
export const SUBJECT_DISCIPLINE_COLORS: Record<SubjectDiscipline, BadgeColorClass> = {
  [SubjectDiscipline.MATHEMATICS]: 'bg-indigo-100 text-indigo-800',
  [SubjectDiscipline.SCIENCE]: 'bg-emerald-100 text-emerald-800',
  [SubjectDiscipline.HUMANITIES]: 'bg-amber-100 text-amber-800',
  [SubjectDiscipline.ENGLISH]: 'bg-rose-100 text-rose-800',
  [SubjectDiscipline.ART]: 'bg-pink-100 text-pink-800',
  [SubjectDiscipline.LANGUAGE]: 'bg-cyan-100 text-cyan-800',
  [SubjectDiscipline.MEDICINE]: 'bg-red-100 text-red-800',
};

// Class Status Colors
export const CLASS_STATUS_COLORS: Record<ClassStatus, BadgeColorClass> = {
  [ClassStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [ClassStatus.INACTIVE]: 'bg-gray-100 text-gray-800',
  [ClassStatus.FULL]: 'bg-orange-100 text-orange-800',
};

// Enrollment Status Colors
const enrollmentStatusColors: Record<EnrollmentStatus, string> = {
  [EnrollmentStatus.ACTIVE]: 'bg-green-100 text-green-800',
  [EnrollmentStatus.INACTIVE]: 'bg-gray-100 text-gray-800',
  [EnrollmentStatus.DISCONTINUED]: 'bg-red-100 text-red-800',
  [EnrollmentStatus.TRIAL]: 'bg-blue-100 text-blue-800',
};

// Absence Type Colors
export const ABSENCE_TYPE_COLORS: Record<AbsenceType, BadgeColorClass> = {
  [AbsenceType.PLANNED]: 'bg-blue-100 text-blue-800',
  [AbsenceType.UNPLANNED]: 'bg-orange-100 text-orange-800',
};

// Meeting Type Colors
export const MEETING_TYPE_COLORS: Record<MeetingType, BadgeColorClass> = {
  [MeetingType.TRIAL_SESSION]: 'bg-orange-100 text-orange-800',
  [MeetingType.SUBSIDY_INTERVIEW]: 'bg-purple-100 text-purple-800',
  [MeetingType.PARENT_MEETING]: 'bg-blue-100 text-blue-800',
  [MeetingType.OTHER]: 'bg-gray-100 text-gray-800',
};

// Session Type Colors
export const SESSION_TYPE_COLORS: Record<SessionType, BadgeColorClass> = {
  [SessionType.CLASS]: 'bg-blue-100 text-blue-800',
  [SessionType.DRAFTING]: 'bg-green-100 text-green-800',
  [SessionType.SUBSIDY_INTERVIEW]: 'bg-purple-100 text-purple-800',
  [SessionType.TRIAL_SESSION]: 'bg-orange-100 text-orange-800',
  [SessionType.TRIAL_SHIFT]: 'bg-yellow-100 text-yellow-800',
  [SessionType.STAFF_INTERVIEW]: 'bg-indigo-100 text-indigo-800',
};

// Message Status Colors
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, BadgeColorClass> = {
  [MessageStatus.DRAFT]: 'bg-gray-100 text-gray-800',
  [MessageStatus.SENT]: 'bg-green-100 text-green-800',
  [MessageStatus.FAILED]: 'bg-red-100 text-red-800',
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

export function getStudentStatusColor(status: StudentStatus | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return STUDENT_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
}

export function getStaffRoleColor(role: StaffRole | null | undefined): BadgeColorClass {
  if (!role) return 'bg-gray-100 text-gray-800';
  return STAFF_ROLE_COLORS[role] ?? 'bg-gray-100 text-gray-800';
}

export function getStaffStatusColor(status: StaffStatus | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return STAFF_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
}

export function getSubjectCurriculumColor(curriculum: SubjectCurriculum | null | undefined): BadgeColorClass {
  if (!curriculum) return 'bg-gray-100 text-gray-800';
  return SUBJECT_CURRICULUM_COLORS[curriculum] ?? 'bg-gray-100 text-gray-800';
}

export function getSubjectDisciplineColor(discipline: SubjectDiscipline | null | undefined): BadgeColorClass {
  if (!discipline) return 'bg-gray-100 text-gray-800';
  return SUBJECT_DISCIPLINE_COLORS[discipline] ?? 'bg-gray-100 text-gray-800';
}

export function getClassStatusColor(status: ClassStatus | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return CLASS_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
}

export function getEnrollmentStatusColor(status: EnrollmentStatus | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return enrollmentStatusColors[status] ?? 'bg-gray-100 text-gray-800';
}

export function getAbsenceTypeColor(type: AbsenceType | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return ABSENCE_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-800';
}

export function getMeetingTypeColor(type: MeetingType | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return MEETING_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-800';
}

export function getSessionTypeColor(type: SessionType | null | undefined): BadgeColorClass {
  if (!type) return 'bg-gray-100 text-gray-800';
  return SESSION_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-800';
}

export function getMessageStatusColor(status: MessageStatus | null | undefined): BadgeColorClass {
  if (!status) return 'bg-gray-100 text-gray-800';
  return MESSAGE_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800';
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