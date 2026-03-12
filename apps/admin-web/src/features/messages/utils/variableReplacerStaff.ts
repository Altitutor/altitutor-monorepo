import type { Tables } from '@altitutor/shared';
import { getInviteUrlForStaff } from '@/shared/utils/invites';
import { STAFF_VARIABLES } from './variableConfig';
import { getStaffClassesWithStartDates } from '../api/bulk';

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
 * Replace template variables with actual staff data
 * Uses centralized variable configuration (see variableConfig.ts)
 * Supports: {first_name}, {full_name}, {classes}, {classes_with_start_date}, {sender_name}, {invite_link}, {forgot_password_link}
 * Variables are case-insensitive
 * Note: {last_name} is deprecated, use {full_name} instead (backward compatibility maintained)
 */
export async function replaceVariablesForStaff(
  template: string,
  staff: Tables<'staff'>,
  classes: Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>,
  senderName?: string | null,
  options?: {
    inviteToken?: string | null;
    forgotPasswordLink?: string | null;
    classesWithStartDates?:
      | Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null; startDate: Date | null }>
      | null;
  }
): Promise<string> {
  let result = template;

  // Replace {first_name} (case insensitive)
  result = result.replace(/\{first_name\}/gi, staff.first_name || '');

  // Replace {full_name} (case insensitive) - combines first and last name
  const fullName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
  result = result.replace(/\{full_name\}/gi, fullName);
  
  // Backward compatibility: also replace {last_name} (deprecated)
  result = result.replace(/\{last_name\}/gi, staff.last_name || '');

  // Replace {classes} with formatted list
  const classesText = classes.length > 0
    ? classes
        .map(({ class: cls, subject: _subject }) => {
          const className = cls.long_name?.trim() ?? '';
          return `- ${className}`;
        })
        .join('\n')
    : 'No classes assigned';

  result = result.replace(/\{classes\}/gi, classesText);

  // Replace {classes_with_start_date} with formatted list including start dates
  if (options?.classesWithStartDates) {
    const classesWithDatesText = options.classesWithStartDates.length > 0
      ? options.classesWithStartDates
          .map(({ class: cls, subject: _subject, startDate }) => {
            const className = cls.long_name?.trim() ?? '';
            if (startDate) {
              const formattedDate = formatDateWithOrdinal(startDate);
              return `- ${className} starting on ${formattedDate}`;
            } else {
              return `- ${className}`;
            }
          })
          .join('\n')
      : 'No classes assigned';
    result = result.replace(/\{classes_with_start_date\}/gi, classesWithDatesText);
  } else {
    // If classesWithStartDates not provided, try to fetch them
    try {
      const classesWithDates = await getStaffClassesWithStartDates(staff.id);
      const classesWithDatesText = classesWithDates.length > 0
        ? classesWithDates
            .map(({ class: cls, subject: _subject, startDate }) => {
              const className = cls.long_name?.trim() ?? '';
              if (startDate) {
                const formattedDate = formatDateWithOrdinal(startDate);
                return `- ${className} starting on ${formattedDate}`;
              } else {
                return `- ${className}`;
              }
            })
            .join('\n')
        : 'No classes assigned';
      result = result.replace(/\{classes_with_start_date\}/gi, classesWithDatesText);
    } catch (error) {
      console.error('Error fetching classes with start dates:', error);
      result = result.replace(/\{classes_with_start_date\}/gi, classesText);
    }
  }

  // Replace {sender_name} (case insensitive)
  result = result.replace(/\{sender_name\}/gi, senderName || '');

  // Replace {registration_link} - empty for staff (not applicable)
  result = result.replace(/\{registration_link\}/gi, '');

  // Replace {invite_link} (case insensitive)
  // Works for staff - generates invite URL based on role
  if (options?.inviteToken && staff.role) {
    const inviteUrl = getInviteUrlForStaff(options.inviteToken, staff.role);
    result = result.replace(/\{invite_link\}/gi, inviteUrl);
  } else {
    // Replace with empty string if token not provided
    result = result.replace(/\{invite_link\}/gi, '');
  }

  // Replace {forgot_password_link} (case insensitive)
  // Works for staff - requires server-side generation
  if (options?.forgotPasswordLink) {
    result = result.replace(/\{forgot_password_link\}/gi, options.forgotPasswordLink);
  } else {
    // Replace with empty string if link not provided
    result = result.replace(/\{forgot_password_link\}/gi, '');
  }

  return result;
}

/**
 * Export staff variables from centralized config for convenience
 */
export { STAFF_VARIABLES };
