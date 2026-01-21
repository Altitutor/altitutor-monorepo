import type { Tables } from '@altitutor/shared';
import { getInviteUrlForStaff } from '@/shared/utils/invites';

/**
 * Replace template variables with actual staff data
 * Supports: {first_name}, {last_name}, {sender_name}, {invite_link}, {forgot_password_link}
 * Note: Staff don't have {classes} or {registration_link}
 * Variables are case-insensitive
 */
export function replaceVariablesForStaff(
  template: string,
  staff: Tables<'staff'>,
  senderName?: string | null,
  options?: {
    inviteToken?: string | null;
    forgotPasswordLink?: string | null;
  }
): string {
  let result = template;

  // Replace {first_name} (case insensitive)
  result = result.replace(/\{first_name\}/gi, staff.first_name || '');

  // Replace {last_name} (case insensitive)
  result = result.replace(/\{last_name\}/gi, staff.last_name || '');

  // Replace {classes} with empty/N/A for staff (they don't have classes)
  result = result.replace(/\{classes\}/gi, 'N/A');

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
