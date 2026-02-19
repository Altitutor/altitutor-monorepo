import type { Tables } from '@altitutor/shared';
import { formatClassName } from '@/shared/utils';
import { getInviteUrlForStudent } from '@/shared/utils/invites';
import { getStudentClassesWithStartDates } from '../api/bulk';
import { parseStudentSubVariable } from './variableConfig';

/**
 * Format date as "Wed 11th Feb"
 */
function formatDateWithOrdinal(date: Date): string {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = dayNames[date.getDay()];
  const day = date.getDate();
  const month = monthNames[date.getMonth()];
  
  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  const getOrdinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  
  return `${dayName} ${getOrdinal(day)} ${month}`;
}

/**
 * Student data with classes for variable replacement
 */
export interface StudentWithClasses {
  student: Tables<'students'>;
  classes: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null }>;
  classesWithStartDates?: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null, startDate: Date | null }> | null;
  linkTokens?: {
    registrationToken?: string | null;
    inviteToken?: string | null;
    forgotPasswordLink?: string | null;
  };
}

/**
 * Replace template variables with actual parent data
 * Supports:
 * - Parent variables: {parent_first_name}, {parent_full_name}, {sender_name}
 * - Student sub-variables: {parent.student1.first_name}, {parent.student1.full_name}, {parent.student1.classes}, etc.
 * Variables are case-insensitive
 * Note: {parent_last_name} and {last_name} are deprecated, use {parent_full_name} and {full_name} instead (backward compatibility maintained)
 */
export async function replaceVariablesForParent(
  template: string,
  parent: Tables<'parents'>,
  students: StudentWithClasses[],
  senderName?: string | null
): Promise<string> {
  let result = template;

  // Replace parent-specific variables
  result = result.replace(/\{parent_first_name\}/gi, parent.first_name || '');
  const parentFullName = `${parent.first_name || ''} ${parent.last_name || ''}`.trim();
  result = result.replace(/\{parent_full_name\}/gi, parentFullName);
  result = result.replace(/\{sender_name\}/gi, senderName || '');
  
  // Backward compatibility: also replace {parent_last_name} (deprecated)
  result = result.replace(/\{parent_last_name\}/gi, parent.last_name || '');

  // Replace student sub-variables: {parent.student{N}.{variable}}
  // Match pattern: {parent.student1.first_name}, {parent.student2.classes}, etc.
  const studentSubVariablePattern = /\{parent\.student(\d+)\.(\w+)\}/gi;
  
  result = result.replace(studentSubVariablePattern, (match, studentIndexStr, variableName) => {
    const studentIndex = parseInt(studentIndexStr, 10) - 1; // Convert to 0-based index
    
    // Check if student index is valid
    if (studentIndex < 0 || studentIndex >= students.length) {
      console.warn(`Invalid student index ${studentIndexStr} for parent ${parent.id}`);
      return ''; // Replace with empty string if invalid
    }

    const studentData = students[studentIndex];
    return replaceStudentVariable(variableName, studentData);
  });

  return result;
}

/**
 * Replace a single student variable (used for student sub-variables)
 */
function replaceStudentVariable(
  variableName: string,
  studentData: StudentWithClasses
): string {
  const { student, classes, classesWithStartDates, linkTokens } = studentData;

  switch (variableName.toLowerCase()) {
    case 'first_name':
      return student.first_name || '';
    
    case 'full_name': {
      const fullName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
      return fullName;
    }
    
    // Backward compatibility: also handle {last_name} (deprecated)
    case 'last_name':
      return student.last_name || '';
    
    case 'classes': {
      const classesText = classes.length > 0
        ? classes
            .map(({ class: cls, subject }) => {
              const className = formatClassName(cls, subject);
              return `- ${className}`;
            })
            .join('\n')
        : 'No classes enrolled';
      return classesText;
    }
    
    case 'classes_with_start_date': {
      if (classesWithStartDates && classesWithStartDates.length > 0) {
        const classesWithDatesText = classesWithStartDates
          .map(({ class: cls, subject, startDate }) => {
            const className = formatClassName(cls, subject);
            if (startDate) {
              const formattedDate = formatDateWithOrdinal(startDate);
              return `- ${className} starting on ${formattedDate}`;
            } else {
              return `- ${className}`;
            }
          })
          .join('\n');
        return classesWithDatesText;
      } else {
        // Fallback to regular classes
        const classesText = classes.length > 0
          ? classes
              .map(({ class: cls, subject }) => {
                const className = formatClassName(cls, subject);
                return `- ${className}`;
              })
              .join('\n')
          : 'No classes enrolled';
        return classesText;
      }
    }
    
    case 'registration_link':
      if (linkTokens?.registrationToken) {
        return getInviteUrlForStudent(linkTokens.registrationToken, 'register');
      }
      return '';
    
    case 'invite_link':
      if (linkTokens?.inviteToken) {
        return getInviteUrlForStudent(linkTokens.inviteToken, 'invite');
      }
      return '';
    
    case 'forgot_password_link':
      return linkTokens?.forgotPasswordLink || '';
    
    default:
      console.warn(`Unknown student variable: ${variableName}`);
      return '';
  }
}

/**
 * Legacy function signature for backward compatibility
 * Uses the first student's data (maintains old behavior)
 * @deprecated Use the new signature with parent and students array
 */
export async function replaceVariablesForParentLegacy(
  template: string,
  student: Tables<'students'>,
  classes: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null }>,
  senderName?: string | null,
  options?: {
    registrationToken?: string | null;
    inviteToken?: string | null;
    forgotPasswordLink?: string | null;
    classesWithStartDates?: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null, startDate: Date | null }> | null;
  }
): Promise<string> {
  // For backward compatibility, create a parent object with student's name
  // This is a fallback - ideally callers should use the new signature
  const mockParent: Tables<'parents'> = {
    id: '',
    first_name: '',
    last_name: '',
    email: null,
    phone: null,
    user_id: null,
    invite_token: null,
    created_by: null,
    created_at: null,
    updated_at: null,
  };

  const studentData: StudentWithClasses = {
    student,
    classes,
    classesWithStartDates: options?.classesWithStartDates || null,
    linkTokens: {
      registrationToken: options?.registrationToken || null,
      inviteToken: options?.inviteToken || null,
      forgotPasswordLink: options?.forgotPasswordLink || null,
    },
  };

  return replaceVariablesForParent(template, mockParent, [studentData], senderName);
}
