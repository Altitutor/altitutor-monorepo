import { User, UserRole } from '../types';

// NOTE: Role checking functions removed - roles are now checked via staff table in database
// Use the staff table's role field directly in your queries instead of these client-side functions
// Example: SELECT * FROM staff WHERE user_id = auth.uid() AND role = 'ADMINSTAFF'

// These functions are kept for backwards compatibility but should not be used
// They will always return false since we no longer store roles in JWT claims
export function getUserRole(user: User | null): UserRole | null {
  // Role checking moved to database level - this always returns null
  return null;
}

export function isAdminStaff(user: User | null): boolean {
  // Role checking moved to database level - this always returns false
  return false;
}

export function isTutor(user: User | null): boolean {
  // Role checking moved to database level - this always returns false
  return false;
}

export function isStudent(user: User | null): boolean {
  // Role checking moved to database level - this always returns false
  return false;
}

export function isStaff(user: User | null): boolean {
  // Role checking moved to database level - this always returns false
  return false;
} 