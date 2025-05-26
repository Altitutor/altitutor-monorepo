import React from 'react';
import { Badge, BadgeProps } from '@/components/ui/badge';
import { cn } from '@/shared/utils';
import {
  getStudentStatusColor,
  getStaffRoleColor,
  getStaffStatusColor,
  getSubjectCurriculumColor,
  getSubjectDisciplineColor,
  getClassStatusColor,
  getEnrollmentStatusColor,
  getAbsenceTypeColor,
  getMeetingTypeColor,
  getSessionTypeColor,
  getMessageStatusColor,
  getBooleanColor,
  getParkingRemoteColor,
} from '@/shared/utils/enum-colors';
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
  SessionType,
  MessageStatus,
} from '@/shared/lib/supabase/database/types';

// Union type of all supported enum values
type EnumValue = 
  | StudentStatus
  | StaffRole
  | StaffStatus
  | SubjectCurriculum
  | SubjectDiscipline
  | ClassStatus
  | EnrollmentStatus
  | AbsenceType
  | MeetingType
  | SessionType
  | MessageStatus
  | boolean
  | 'PHYSICAL'
  | 'VIRTUAL'
  | 'NONE';

interface EnumBadgeProps extends Omit<BadgeProps, 'className'> {
  value: EnumValue | null | undefined;
  type?: 
    | 'studentStatus'
    | 'staffRole'
    | 'staffStatus'
    | 'subjectCurriculum'
    | 'subjectDiscipline'
    | 'classStatus'
    | 'enrollmentStatus'
    | 'absenceType'
    | 'meetingType'
    | 'sessionType'
    | 'messageStatus'
    | 'boolean'
    | 'parkingRemote'
    | 'auto'; // auto-detect based on value
  className?: string;
  children?: React.ReactNode; // Override display text
}

/**
 * Enhanced Badge component that automatically applies correct colors for enum values
 * 
 * Usage examples:
 * <EnumBadge value={student.status} type="studentStatus" />
 * <EnumBadge value={staff.role} type="staffRole" />
 * <EnumBadge value={subject.curriculum} type="subjectCurriculum" />
 * <EnumBadge value={isAvailable} type="boolean">Available</EnumBadge>
 */
export function EnumBadge({ value, type = 'auto', className, children, ...props }: EnumBadgeProps) {
  if (value === null || value === undefined) {
    return (
      <Badge className={cn('bg-gray-100 text-gray-800', className)} {...props}>
        {children || '-'}
      </Badge>
    );
  }

  let colorClass = 'bg-gray-100 text-gray-800';

  // Auto-detect type based on value if type is 'auto'
  if (type === 'auto') {
    type = detectEnumType(value);
  }

  // Get appropriate color class based on type
  switch (type) {
    case 'studentStatus':
      colorClass = getStudentStatusColor(value as StudentStatus);
      break;
    case 'staffRole':
      colorClass = getStaffRoleColor(value as StaffRole);
      break;
    case 'staffStatus':
      colorClass = getStaffStatusColor(value as StaffStatus);
      break;
    case 'subjectCurriculum':
      colorClass = getSubjectCurriculumColor(value as SubjectCurriculum);
      break;
    case 'subjectDiscipline':
      colorClass = getSubjectDisciplineColor(value as SubjectDiscipline);
      break;
    case 'classStatus':
      colorClass = getClassStatusColor(value as ClassStatus);
      break;
    case 'enrollmentStatus':
      colorClass = getEnrollmentStatusColor(value as EnrollmentStatus);
      break;
    case 'absenceType':
      colorClass = getAbsenceTypeColor(value as AbsenceType);
      break;
    case 'meetingType':
      colorClass = getMeetingTypeColor(value as MeetingType);
      break;
    case 'sessionType':
      colorClass = getSessionTypeColor(value as SessionType);
      break;
    case 'messageStatus':
      colorClass = getMessageStatusColor(value as MessageStatus);
      break;
    case 'boolean':
      colorClass = getBooleanColor(value as boolean);
      break;
    case 'parkingRemote':
      colorClass = getParkingRemoteColor(value as 'PHYSICAL' | 'VIRTUAL' | 'NONE');
      break;
    default:
      colorClass = 'bg-gray-100 text-gray-800';
  }

  return (
    <Badge className={cn(colorClass, className)} {...props}>
      {children || String(value)}
    </Badge>
  );
}

/**
 * Auto-detect enum type based on value
 * This is a best-effort approach for convenience
 */
function detectEnumType(value: EnumValue): Exclude<EnumBadgeProps['type'], 'auto' | undefined> {
  if (typeof value === 'boolean') return 'boolean';
  
  const stringValue = String(value);
  
  // Student Status detection
  if (['ACTIVE', 'INACTIVE', 'TRIAL', 'DISCONTINUED'].includes(stringValue)) {
    // Could be student status, staff status, or class status
    // Default to student status for common values
    return 'studentStatus';
  }
  
  // Staff Role detection
  if (['ADMIN', 'TUTOR', 'ADMINSTAFF'].includes(stringValue)) {
    return 'staffRole';
  }
  
  // Subject Curriculum detection
  if (['SACE', 'IB', 'PRESACE', 'PRIMARY', 'MEDICINE'].includes(stringValue)) {
    return 'subjectCurriculum';
  }
  
  // Subject Discipline detection
  if (['MATHEMATICS', 'SCIENCE', 'HUMANITIES', 'ENGLISH', 'ART', 'LANGUAGE'].includes(stringValue)) {
    return 'subjectDiscipline';
  }
  
  // Class Status detection  
  if (['FULL'].includes(stringValue)) {
    return 'classStatus';
  }
  
  // Parking Remote detection
  if (['PHYSICAL', 'VIRTUAL', 'NONE'].includes(stringValue)) {
    return 'parkingRemote';
  }
  
  // Default fallback
  return 'studentStatus';
}

// Additional convenience components for specific enum types
export function StudentStatusBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: StudentStatus | null | undefined }) {
  return <EnumBadge value={value} type="studentStatus" {...props} />;
}

export function StaffRoleBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: StaffRole | null | undefined }) {
  return <EnumBadge value={value} type="staffRole" {...props} />;
}

export function StaffStatusBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: StaffStatus | null | undefined }) {
  return <EnumBadge value={value} type="staffStatus" {...props} />;
}

export function SubjectCurriculumBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: SubjectCurriculum | null | undefined }) {
  return <EnumBadge value={value} type="subjectCurriculum" {...props} />;
}

export function SubjectDisciplineBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: SubjectDiscipline | null | undefined }) {
  return <EnumBadge value={value} type="subjectDiscipline" {...props} />;
}

export function ClassStatusBadge({ value, ...props }: Omit<EnumBadgeProps, 'type'> & { value: ClassStatus | null | undefined }) {
  return <EnumBadge value={value} type="classStatus" {...props} />;
}

export function BooleanBadge({ value, trueText = 'Yes', falseText = 'No', ...props }: Omit<EnumBadgeProps, 'type' | 'children'> & { 
  value: boolean | null | undefined;
  trueText?: string;
  falseText?: string;
}) {
  const displayText = value === true ? trueText : value === false ? falseText : '-';
  return <EnumBadge value={value} type="boolean" {...props}>{displayText}</EnumBadge>;
} 