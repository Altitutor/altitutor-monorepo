import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

export type UserRole = 'ADMINSTAFF' | 'TUTOR' | 'STUDENT';

/**
 * Gets the user role from the user's metadata
 */
export function getUserRole(user: User | null): UserRole | null {
  if (!user) return null;
  return user.user_metadata?.user_role as UserRole || null;
}

/**
 * Checks if the user has the ADMINSTAFF role
 */
export function isAdminStaff(user: User | null): boolean {
  return getUserRole(user) === 'ADMINSTAFF';
}

/**
 * Checks if the user has the TUTOR role
 */
export function isTutor(user: User | null): boolean {
  return getUserRole(user) === 'TUTOR';
}

/**
 * Checks if the user has the STUDENT role
 */
export function isStudent(user: User | null): boolean {
  return getUserRole(user) === 'STUDENT';
}

/**
 * Checks if the user is staff (either ADMINSTAFF or TUTOR)
 */
export function isStaff(user: User | null): boolean {
  const role = getUserRole(user);
  return role === 'ADMINSTAFF' || role === 'TUTOR';
}

/**
 * Sets the role for a user (only callable by ADMINSTAFF users)
 */
export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const supabase = createClientComponentClient();
  
  const { error } = await supabase.functions.invoke('set-user-role', {
    body: { user_id: userId, role },
  });
  
  if (error) {
    throw new Error(`Failed to set user role: ${error.message}`);
  }
} 