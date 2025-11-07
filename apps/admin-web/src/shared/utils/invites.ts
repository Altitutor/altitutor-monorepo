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
  const baseUrl = type === 'staff' 
    ? (process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3000')
    : (process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001');
  
  return `${baseUrl}/invite/${token}`;
}

