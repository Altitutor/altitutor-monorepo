import type { Tables } from '@altitutor/shared';
import { formatClassName } from '@/shared/utils';
import { getInviteUrlForStudent } from '@/shared/utils/invites';

/**
 * Replace template variables with actual student data
 * Supports: {first_name}, {last_name}, {classes}, {sender_name}, {registration_link}, {invite_link}, {forgot_password_link}
 * Variables are case-insensitive
 */
export function replaceVariables(
  template: string,
  student: Tables<'students'>,
  classes: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null }>,
  senderName?: string | null,
  options?: {
    registrationToken?: string | null;
    inviteToken?: string | null;
    forgotPasswordLink?: string | null;
  }
): string {
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
  return /\{(first_name|last_name|classes|sender_name|registration_link|invite_link|forgot_password_link)\}/gi.test(template);
}








