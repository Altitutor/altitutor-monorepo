'use client';

import type { Tables } from '@altitutor/shared';

export interface LinkTokens {
  registrationToken?: string | null;
  inviteToken?: string | null;
  forgotPasswordLink?: string | null;
}

/**
 * Generate tokens/links for a staff member
 * Returns tokens that can be used with replaceVariables
 * Note: Staff don't have registration links
 */
export async function generateLinkTokensForStaff(
  staffId: string,
  staffRole: string,
  options?: {
    includeInvite?: boolean;
    includePasswordReset?: boolean;
  }
): Promise<LinkTokens> {
  const tokens: LinkTokens = {};
  const {
    includeInvite = true,
    includePasswordReset = true,
  } = options || {};

  try {
    // Generate invite token if needed
    if (includeInvite) {
      try {
        const response = await fetch('/api/invites/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'staff', id: staffId }),
        });

        if (response.ok) {
          const data = await response.json();
          tokens.inviteToken = data.token;
        }
      } catch (error) {
        console.error('Failed to generate invite token:', error);
      }
    }

    // Generate password reset link if needed (requires staff to have account)
    if (includePasswordReset) {
      try {
        // First check if staff has an account
        const supabase = (await import('@/shared/lib/supabase/client')).getSupabaseClient();
        const { data: staff } = await supabase
          .from('staff')
          .select('user_id, email, role')
          .eq('id', staffId)
          .single();

        if (staff?.user_id && staff?.email) {
          // Staff has account, generate password reset link
          const response = await fetch('/api/generate-password-reset-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: staff.user_id,
              email: staff.email,
              userType: staff.role === 'TUTOR' ? 'tutor' : 'admin',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            tokens.forgotPasswordLink = data.link;
          }
        }
      } catch (error) {
        console.error('Failed to generate password reset link:', error);
      }
    }
  } catch (error) {
    console.error('Error generating link tokens for staff:', error);
  }

  return tokens;
}

/**
 * Generate tokens/links for a student
 * Returns tokens that can be used with replaceVariables
 */
export async function generateLinkTokensForStudent(
  studentId: string,
  options?: {
    includeRegistration?: boolean;
    includeInvite?: boolean;
    includePasswordReset?: boolean;
  }
): Promise<LinkTokens> {
  const tokens: LinkTokens = {};
  const {
    includeRegistration = true,
    includeInvite = true,
    includePasswordReset = true,
  } = options || {};

  try {
    // Generate registration token if needed
    if (includeRegistration) {
      try {
        const response = await fetch('/api/students/send-registration-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId }),
        });

        if (response.ok) {
          const data = await response.json();
          tokens.registrationToken = data.token;
        }
      } catch (error) {
        console.error('Failed to generate registration token:', error);
      }
    }

    // Generate invite token if needed
    if (includeInvite) {
      try {
        const response = await fetch('/api/invites/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'student', id: studentId }),
        });

        if (response.ok) {
          const data = await response.json();
          tokens.inviteToken = data.token;
        }
      } catch (error) {
        console.error('Failed to generate invite token:', error);
      }
    }

    // Generate password reset link if needed (requires student to have account)
    if (includePasswordReset) {
      try {
        // First check if student has an account
        const supabase = (await import('@/shared/lib/supabase/client')).getSupabaseClient();
        const { data: student } = await supabase
          .from('students')
          .select('user_id, email')
          .eq('id', studentId)
          .single();

        if (student?.user_id && student?.email) {
          // Student has account, generate password reset link
          const response = await fetch('/api/generate-password-reset-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              userId: student.user_id,
              email: student.email,
              userType: 'student',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            tokens.forgotPasswordLink = data.link;
          }
        }
      } catch (error) {
        console.error('Failed to generate password reset link:', error);
      }
    }
  } catch (error) {
    console.error('Error generating link tokens:', error);
  }

  return tokens;
}

/**
 * Batch generate tokens for multiple students
 * More efficient than calling generateLinkTokensForStudent individually
 */
export async function batchGenerateLinkTokens(
  studentIds: string[],
  options?: {
    includeRegistration?: boolean;
    includeInvite?: boolean;
    includePasswordReset?: boolean;
  }
): Promise<Record<string, LinkTokens>> {
  const tokensMap: Record<string, LinkTokens> = {};

  if (studentIds.length === 0) return tokensMap;

  const {
    includeRegistration = true,
    includeInvite = true,
    includePasswordReset = true,
  } = options || {};

  try {
    const supabase = (await import('@/shared/lib/supabase/client')).getSupabaseClient();
    type Database = import('@altitutor/shared').Database;
    type SupabaseClient = import('@supabase/supabase-js').SupabaseClient<Database>;

    // Batch fetch existing tokens and student data
    const { data: students } = await (supabase as SupabaseClient)
      .from('students')
      .select('id, invite_token, user_id, email, status')
      .in('id', studentIds);

    if (!students) return tokensMap;

    // Initialize tokens map with existing invite tokens
    for (const student of students) {
      tokensMap[student.id] = {
        inviteToken: student.invite_token || undefined,
      };
    }

    // Generate missing registration tokens
    if (includeRegistration) {
      // Students need registration if they don't have an account or haven't completed registration
      // We'll generate for all students - the API will handle validation
      for (const student of students) {
        if (!tokensMap[student.id]?.registrationToken) {
          try {
            const response = await fetch('/api/students/send-registration-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ studentId: student.id }),
            });

            if (response.ok) {
              const data = await response.json();
              tokensMap[student.id] = {
                ...tokensMap[student.id],
                registrationToken: data.token,
              };
            }
          } catch (error) {
            console.error(`Failed to generate registration token for ${student.id}:`, error);
          }
        }
      }
    }

    // Generate missing invite tokens
    if (includeInvite) {
      const studentsNeedingInvite = students.filter((s) => !s.user_id);

      for (const student of studentsNeedingInvite) {
        if (!tokensMap[student.id]?.inviteToken) {
          try {
            const response = await fetch('/api/invites/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: 'student', id: student.id }),
            });

            if (response.ok) {
              const data = await response.json();
              tokensMap[student.id] = {
                ...tokensMap[student.id],
                inviteToken: data.token,
              };
            }
          } catch (error) {
            console.error(`Failed to generate invite token for ${student.id}:`, error);
          }
        }
      }
    }

    // Generate password reset links for students with accounts
    if (includePasswordReset) {
      const studentsWithAccounts = students.filter((s) => s.user_id && s.email);

      for (const student of studentsWithAccounts) {
        try {
          const response = await fetch('/api/generate-password-reset-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: student.user_id,
              email: student.email,
              userType: 'student',
            }),
          });

          if (response.ok) {
            const data = await response.json();
            tokensMap[student.id] = {
              ...tokensMap[student.id],
              forgotPasswordLink: data.link,
            };
          }
        } catch (error) {
          console.error(`Failed to generate password reset link for ${student.id}:`, error);
        }
      }
    }
  } catch (error) {
    console.error('Error batch generating link tokens:', error);
  }

  return tokensMap;
}

/**
 * Check if a template contains any link variables
 */
export function templateContainsLinkVariables(template: string): boolean {
  return (
    template.includes('{registration_link}') ||
    template.includes('{invite_link}') ||
    template.includes('{forgot_password_link}')
  );
}
