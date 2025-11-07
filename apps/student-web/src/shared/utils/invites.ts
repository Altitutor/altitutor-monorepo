/**
 * Build invite URL for student
 * @param token The invite token
 * @returns Full invite URL
 */
export function buildInviteUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_STUDENT_URL || 'http://localhost:3001';
  return `${baseUrl}/invite/${token}`;
}

