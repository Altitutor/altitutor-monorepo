import type { Tables } from '@altitutor/shared';
import { formatClassName } from '@/shared/utils';

/**
 * Replace template variables with actual student data
 * Supports: {first_name}, {last_name}, {classes}, {sender_name}
 * Variables are case-insensitive
 */
export function replaceVariables(
  template: string,
  student: Tables<'students'>,
  classes: Array<{ class: Tables<'classes'>, subject: Tables<'subjects'> | null }>,
  senderName?: string | null
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
] as const;

/**
 * Check if a template contains any variables
 */
export function hasVariables(template: string): boolean {
  return /\{(first_name|last_name|classes|sender_name)\}/gi.test(template);
}








