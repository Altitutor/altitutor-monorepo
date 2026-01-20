/**
 * Authorization utilities for payment-methods Edge Function
 * Extracted for testability
 */

export interface AuthResult {
  authorized: boolean;
  isAdminStaff?: boolean;
  studentId?: string;
  error?: string;
}

export interface RegistrationTokenResult {
  valid: boolean;
  studentId?: string;
  error?: string;
}

/**
 * Check if user is admin staff
 */
export function isAdminStaff(staffData: { role: string; status: string } | null): boolean {
  return staffData?.role === 'ADMINSTAFF' && staffData?.status === 'ACTIVE';
}

/**
 * Validate authorization for payment method operations
 * Returns authorization result with role and student ID
 */
export function validateAuthorization(
  isAdminStaff: boolean,
  authenticatedStudentId: string | null,
  requestedStudentId: string | undefined
): AuthResult {
  // Admin staff can access any student's payment methods
  if (isAdminStaff) {
    if (!requestedStudentId) {
      return {
        authorized: false,
        isAdminStaff: true,
        error: 'Student ID required for admin operations',
      };
    }
    return {
      authorized: true,
      isAdminStaff: true,
      studentId: requestedStudentId,
    };
  }

  // Non-admin users can only access their own payment methods
  if (!authenticatedStudentId) {
    return {
      authorized: false,
      error: 'Student not found',
    };
  }

  // If studentId is provided, verify it matches authenticated student
  if (requestedStudentId && requestedStudentId !== authenticatedStudentId) {
    return {
      authorized: false,
      studentId: authenticatedStudentId,
      error: 'Unauthorized: Cannot access other students\' payment methods',
    };
  }

  return {
    authorized: true,
    studentId: authenticatedStudentId,
  };
}

/**
 * Validate registration token flow
 * Returns validation result with student ID if valid
 */
export function validateRegistrationFlow(
  hasRegistrationToken: boolean,
  registrationToken: string | undefined,
  studentId: string | undefined
): RegistrationTokenResult {
  if (!hasRegistrationToken) {
    return { valid: false, error: 'Registration token required' };
  }

  if (!registrationToken) {
    return { valid: false, error: 'Registration token is empty' };
  }

  if (!studentId) {
    return { valid: false, error: 'Student ID required for registration flow' };
  }

  // Token validation logic would go here (checking against database)
  // For now, we assume token is validated elsewhere
  return { valid: true, studentId };
}
