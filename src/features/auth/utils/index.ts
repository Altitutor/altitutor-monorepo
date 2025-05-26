import { User, UserRole } from '../types';

// Role utilities
export function getUserRole(user: User | null): UserRole | null {
  if (!user) return null;
  return user.user_metadata?.user_role as UserRole || null;
}

export function isAdminStaff(user: User | null): boolean {
  return getUserRole(user) === 'ADMINSTAFF';
}

export function isTutor(user: User | null): boolean {
  return getUserRole(user) === 'TUTOR';
}

export function isStudent(user: User | null): boolean {
  return getUserRole(user) === 'STUDENT';
}

export function isStaff(user: User | null): boolean {
  const role = getUserRole(user);
  return role === 'ADMINSTAFF' || role === 'TUTOR';
}

export async function setUserRole(userId: string, role: UserRole): Promise<void> {
  const { createClientComponentClient } = await import('@supabase/auth-helpers-nextjs');
  const supabase = createClientComponentClient();
  
  const { error } = await supabase.functions.invoke('set-user-role', {
    body: { user_id: userId, role },
  });
  
  if (error) {
    throw new Error(`Failed to set user role: ${error.message}`);
  }
} 