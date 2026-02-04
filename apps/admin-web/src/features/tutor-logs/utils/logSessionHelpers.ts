import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';

/**
 * Get step titles for tutor log flow
 */
export function getLogSessionStepTitles(adminMode: boolean): string[] {
  const baseTitles = [
    'Select Session',
    'Staff Attendance',
    'Student Attendance',
    'Topics',
    'Topic Students',
    'Files',
    'File Students',
    'Notes',
    'Confirmation',
  ];

  if (adminMode) {
    return ['Select Staff Member', ...baseTitles];
  }

  return baseTitles;
}

/**
 * Get step title for a given step index
 */
export function getLogSessionStepTitle(
  stepIndex: number,
  adminMode: boolean
): string {
  const titles = getLogSessionStepTitles(adminMode);
  return titles[stepIndex] || 'Log Session';
}

/**
 * Get total number of steps
 */
export function getLogSessionTotalSteps(adminMode: boolean): number {
  return adminMode ? 10 : 9;
}

/**
 * Calculate initial step based on props
 */
export function calculateInitialStep(
  adminMode: boolean,
  initialSessionId?: string,
  initialStaffId?: string
): number {
  if (adminMode && initialSessionId && initialStaffId) {
    return 2; // Skip staff selector and session picker
  }
  return 0;
}

/**
 * Check if can proceed to next step
 */
export function canProceedToNextLogStep(
  stepIndex: number,
  adminMode: boolean,
  formData: Partial<TutorLogFormData>,
  selectedStaffId: string,
  _selectedSession: Tables<'sessions'> | null
): boolean {
  // Step 0: Staff selector (admin mode only)
  if (adminMode && stepIndex === 0) {
    return !!selectedStaffId;
  }

  // Adjust step index for non-admin mode
  const adjustedStepIndex = adminMode ? stepIndex - 1 : stepIndex;

  switch (adjustedStepIndex) {
    case 0: // Select Session
      return !!formData.sessionId;
    case 1: // Staff Attendance
      return (formData.staffAttendance || []).length > 0;
    case 2: // Student Attendance
      // Admin-web: always allow proceeding even if there are no students
      // (tutor-web has its own validation logic that requires students)
      return true;
    case 3: // Topics
      return true; // Allow proceeding with no topics selected
    case 4: // Topic Students
      return true; // Can proceed even with no student assignments
    case 5: // Files
      return true; // Allow proceeding with no files selected
    case 6: // File Students
      return true; // Allow proceeding with no file assignments
    case 7: // Notes
      return true; // Notes step
    case 8: // Confirmation
      return true; // Confirmation step - always allow submission
    default:
      return false;
  }
}

/**
 * Get attended student IDs from form data
 */
export function getAttendedStudentIds(
  formData: Partial<TutorLogFormData>
): string[] {
  return (formData.studentAttendance || [])
    .filter((sa) => sa.attended)
    .map((sa) => sa.studentId);
}
