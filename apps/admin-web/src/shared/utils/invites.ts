import { randomUUID } from 'crypto';

/**
 * Generate a cryptographically secure random token as UUID
 * @returns UUID v4 string
 */
export function generateSecureToken(): string {
  return randomUUID();
}

/**
 * Build invite URL based on user type
 * @param token The invite token
 * @param type 'staff' or 'student'
 * @returns Full invite URL
 */
export function buildInviteUrl(token: string, type: 'staff' | 'student'): string {
  if (type === 'staff') {
    // For staff, we need role info, so use getInviteUrlForStaff with default role
    // This is a fallback - prefer using getInviteUrlForStaff directly
    const isDevelopment = process.env.NODE_ENV === 'development';
    const baseUrl = isDevelopment
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.altitutor.com');
    return `${baseUrl}/invite/${token}`;
  } else {
    return getInviteUrlForStudent(token, 'invite');
  }
}

/**
 * Build invite URL for student
 * @param token The invite token
 * @param path The path type ('invite' or 'register')
 * @returns Full invite URL
 */
export function getInviteUrlForStudent(token: string, path: 'invite' | 'register' = 'invite'): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const baseUrl = isDevelopment 
    ? 'http://localhost:3001'
    : (process.env.NEXT_PUBLIC_STUDENT_URL || 'https://student.altitutor.com');
  return `${baseUrl}/${path}/${token}`;
}

/**
 * Build invite URL for staff based on their role
 * @param token The invite token
 * @param role The staff member's role ('TUTOR' or 'ADMINSTAFF')
 * @returns Full invite URL
 */
export function getInviteUrlForStaff(token: string, role: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  if (role === 'TUTOR') {
    const baseUrl = isDevelopment 
      ? 'http://localhost:3002'
      : (process.env.NEXT_PUBLIC_TUTOR_URL || 'https://tutor.altitutor.com');
    return `${baseUrl}/invite/${token}`;
  } else {
    const baseUrl = isDevelopment
      ? 'http://localhost:3000'
      : (process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.altitutor.com');
    return `${baseUrl}/invite/${token}`;
  }
}

