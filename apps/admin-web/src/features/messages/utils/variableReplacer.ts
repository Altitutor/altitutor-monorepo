import type { Tables } from '@altitutor/shared';
import { formatClassName } from '@/shared/utils';
import { getInviteUrlForStudent } from '@/shared/utils/invites';
import { getStudentClassesWithStartDates } from '../api/bulk';

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
 * Replace template variables with actual student data
 * Supports: {first_name}, {last_name}, {classes}, {classes_with_start_date}, {sender_name}, {registration_link}, {invite_link}, {forgot_password_link}
 * Variables are case-insensitive
 */
export async function replaceVariables(
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
  let result = template;

  // Replace {first_name} (case insensitive)
  result = result.replace(/\{first_name\}/gi, student.first_name || '');

  // Replace {last_name} (case insensitive)
  result = result.replace(/\{last_name\}/gi, student.last_name || '');

  // Replace {classes} with formatted list
  const classesText = classes.length > 0
    ? classes
        .map(({ class: cls, subject }) => {
          const className = formatClassName(cls, subject);
          return `- ${className}`;
        })
        .join('\n')
    : 'No classes enrolled';

  result = result.replace(/\{classes\}/gi, classesText);

  // Replace {classes_with_start_date} with formatted list including start dates
  if (options?.classesWithStartDates) {
    const classesWithDatesText = options.classesWithStartDates.length > 0
      ? options.classesWithStartDates
          .map(({ class: cls, subject, startDate }) => {
            const className = formatClassName(cls, subject);
            if (startDate) {
              const formattedDate = formatDateWithOrdinal(startDate);
              return `- ${className} starting on ${formattedDate}`;
            } else {
              return `- ${className}`;
            }
          })
          .join('\n')
      : 'No classes enrolled';
    result = result.replace(/\{classes_with_start_date\}/gi, classesWithDatesText);
  } else {
    // If classesWithStartDates not provided, try to fetch them
    try {
      const classesWithDates = await getStudentClassesWithStartDates(student.id);
      const classesWithDatesText = classesWithDates.length > 0
        ? classesWithDates
            .map(({ class: cls, subject, startDate }) => {
              const className = formatClassName(cls, subject);
              if (startDate) {
                const formattedDate = formatDateWithOrdinal(startDate);
                return `- ${className} starting on ${formattedDate}`;
              } else {
                return `- ${className}`;
              }
            })
            .join('\n')
        : 'No classes enrolled';
      result = result.replace(/\{classes_with_start_date\}/gi, classesWithDatesText);
    } catch (error) {
      console.error('Error fetching classes with start dates:', error);
      result = result.replace(/\{classes_with_start_date\}/gi, classesText);
    }
  }

  // Replace {sender_name} (case insensitive)
  result = result.replace(/\{sender_name\}/gi, senderName || '');

  // Replace {registration_link} (case insensitive)
  // Only works for students - generates registration URL
  if (options?.registrationToken) {
    const registrationUrl = getInviteUrlForStudent(options.registrationToken, 'register');
    result = result.replace(/\{registration_link\}/gi, registrationUrl);
  } else {
    // Replace with empty string if token not provided
    result = result.replace(/\{registration_link\}/gi, '');
  }

  // Replace {invite_link} (case insensitive)
  // Works for both students and staff - generates invite URL
  if (options?.inviteToken) {
    const inviteUrl = getInviteUrlForStudent(options.inviteToken, 'invite');
    result = result.replace(/\{invite_link\}/gi, inviteUrl);
  } else {
    // Replace with empty string if token not provided
    result = result.replace(/\{invite_link\}/gi, '');
  }

  // Replace {forgot_password_link} (case insensitive)
  // Works for both students and staff - requires server-side generation
  if (options?.forgotPasswordLink) {
    result = result.replace(/\{forgot_password_link\}/gi, options.forgotPasswordLink);
  } else {
    // Replace with empty string if link not provided
    result = result.replace(/\{forgot_password_link\}/gi, '');
  }

  return result;
}

/**
 * Get list of available variables for templates
 */
export const TEMPLATE_VARIABLES = [
  {
    name: 'first_name',
    description: 'Student\'s first name',
    example: 'John',
  },
  {
    name: 'last_name',
    description: 'Student\'s last name',
    example: 'Smith',
  },
  {
    name: 'classes',
    description: 'Student\'s enrolled classes (formatted list)',
    example: '- SACE 12 Mathematics Mon 2:00 PM - 4:00 PM\n- SACE 12 Physics Wed 3:00 PM - 5:00 PM',
  },
  {
    name: 'classes_with_start_date',
    description: 'Student\'s enrolled classes with start dates (formatted list)',
    example: '- PRESACE 9 Mathematics Wed 1:30 PM - 3:00 PM starting on Wed 11th Feb\n- SACE 12 Physics Fri 3:00 PM - 5:00 PM starting on Fri 13th Feb',
  },
  {
    name: 'sender_name',
    description: 'Name of the currently logged in staff member',
    example: 'Jane Doe',
  },
  {
    name: 'registration_link',
    description: 'Registration link for students (students only)',
    example: 'https://student.altitutor.com/register/abc123...',
  },
  {
    name: 'invite_link',
    description: 'Invite link for students or staff',
    example: 'https://student.altitutor.com/invite/abc123...',
  },
  {
    name: 'forgot_password_link',
    description: 'Password reset link (works for both students and staff)',
    example: 'https://student.altitutor.com/auth/callback?token=...',
  },
] as const;

/**
 * Check if a template contains any variables
 */
export function hasVariables(template: string): boolean {
  return /\{(first_name|last_name|classes|classes_with_start_date|sender_name|registration_link|invite_link|forgot_password_link)\}/gi.test(template);
}








