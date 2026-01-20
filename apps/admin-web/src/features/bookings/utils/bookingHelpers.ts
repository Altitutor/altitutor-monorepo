import type { Tables } from '@altitutor/shared';

/**
 * Format student display name with email
 */
export function formatStudentDisplay(student: Tables<'students'>): string {
  return `${student.first_name} ${student.last_name}${student.email ? ` (${student.email})` : ''}`;
}

/**
 * Format subject display name
 */
export function formatSubjectDisplay(subject: Tables<'subjects'>): string {
  const parts = [
    subject.curriculum,
    subject.year_level ? `Year ${subject.year_level}` : '',
    subject.name,
  ].filter(Boolean);
  return parts.join(' ');
}

/**
 * Get session type label
 */
export function getSessionTypeLabel(sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW'): string {
  switch (sessionType) {
    case 'DRAFTING':
      return 'Drafting Session';
    case 'TRIAL_SESSION':
      return 'Trial Session';
    case 'SUBSIDY_INTERVIEW':
      return 'Subsidy Interview';
  }
}

/**
 * Calculate booking steps based on session type
 */
export function getBookingSteps(
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW',
  originalSessionId?: string | null
): Array<{ id: string; title: string }> {
  const baseSteps = [];

  // For TRIAL_SESSION, always start with new student form (skip student selection)
  if (sessionType === 'TRIAL_SESSION') {
    // Step 0: Trial Contact Form (new student)
    baseSteps.push({
      id: 'trial-contact',
      title: 'Student Details',
    });
  } else {
    // Step 0: Select Student (for DRAFTING and SUBSIDY_INTERVIEW)
    baseSteps.push({
      id: 'student',
      title: 'Select Student',
    });
  }

  // Step 1: Select Subject (only for DRAFTING)
  if (sessionType === 'DRAFTING') {
    baseSteps.push({
      id: 'subject',
      title: 'Select Subject',
    });
  }
  // TRIAL_SESSION and SUBSIDY_INTERVIEW skip subject selection

  // Step 2: Select Time
  baseSteps.push({
    id: 'time',
    title: 'Select Time',
  });

  // Step 3: Select Staff
  baseSteps.push({
    id: 'staff',
    title: 'Select Staff',
  });

  // Step 4: Confirm
  baseSteps.push({
    id: 'confirm',
    title: originalSessionId ? 'Confirm Reschedule' : 'Confirm Booking',
  });

  return baseSteps;
}

/**
 * Check if can proceed to next step
 */
export function canProceedToNextStep(
  stepId: string,
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW',
  state: {
    selectedStudentId?: string;
    selectedSubjectId?: string;
    selectedSlot?: { startAt: string; endAt: string; availableStaffIds: string[] } | null;
    selectedStaffId?: string;
    trialFormValid?: boolean;
  }
): boolean {
  switch (stepId) {
    case 'student':
      return !!state.selectedStudentId;
    case 'trial-contact':
      return state.trialFormValid ?? false;
    case 'subject':
      // For DRAFTING, subject is required; for others it's optional
      return sessionType === 'DRAFTING' ? !!state.selectedSubjectId : true;
    case 'time':
      return !!state.selectedSlot;
    case 'staff':
      return !!state.selectedStaffId;
    case 'confirm':
      return true; // Always allow confirmation
    default:
      return false;
  }
}
