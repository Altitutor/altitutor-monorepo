import type { Tables } from '@altitutor/shared';
import type { TutorLogFormData } from '../types';

/** Class-linked / recurring sessions use the full topics/files wizard. */
export function isMeetingSession(
  session: Pick<Tables<'sessions'>, 'type'> | null | undefined
): boolean {
  return !!session && session.type !== 'CLASS';
}

export type LogSessionWizardFlow = 'class' | 'meeting';

export function resolveLogSessionWizardFlow(
  selectedSession: Pick<Tables<'sessions'>, 'type'> | null | undefined,
  initialSessionKind?: LogSessionWizardFlow
): LogSessionWizardFlow {
  if (selectedSession) {
    return isMeetingSession(selectedSession) ? 'meeting' : 'class';
  }
  if (initialSessionKind === 'meeting') {
    return 'meeting';
  }
  return 'class';
}

/**
 * Get step titles for tutor log flow
 */
export function getLogSessionStepTitles(
  adminMode: boolean,
  flow: LogSessionWizardFlow
): string[] {
  if (flow === 'meeting') {
    if (adminMode) {
      return ['Staff & session', 'Attendance', 'Notes', 'Confirmation'];
    }
    return ['Select session', 'Attendance', 'Notes', 'Confirmation'];
  }

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
    return ['Staff & session', ...baseTitles.slice(1)];
  }

  return baseTitles;
}

/**
 * Get step title for a given step index
 */
export function getLogSessionStepTitle(
  stepIndex: number,
  adminMode: boolean,
  flow: LogSessionWizardFlow
): string {
  const titles = getLogSessionStepTitles(adminMode, flow);
  return titles[stepIndex] || 'Log session';
}

/**
 * Get total number of steps
 */
export function getLogSessionTotalSteps(
  _adminMode: boolean,
  flow: LogSessionWizardFlow
): number {
  if (flow === 'meeting') {
    return 4;
  }
  return 9;
}

/**
 * Calculate initial step based on props
 */
export function calculateInitialStep(
  adminMode: boolean,
  initialSessionId?: string,
  _initialStaffId?: string,
  flow: LogSessionWizardFlow = 'class'
): number {
  if (adminMode && initialSessionId) {
    return 1;
  }
  if (!adminMode && initialSessionId && flow === 'meeting') {
    return 1;
  }
  return 0;
}

/**
 * Check if can proceed to next step
 */
export function canProceedToNextLogStep(
  stepIndex: number,
  adminMode: boolean,
  flow: LogSessionWizardFlow,
  formData: Partial<TutorLogFormData>,
  selectedStaffId: string,
  _selectedSession: Tables<'sessions'> | null
): boolean {
  if (flow === 'meeting') {
    if (adminMode) {
      if (stepIndex === 0) {
        return !!selectedStaffId && !!formData.sessionId;
      }
      if (stepIndex === 1) {
        return (formData.staffAttendance || []).length > 0;
      }
      return true;
    }
    if (stepIndex === 0) {
      return !!formData.sessionId;
    }
    if (stepIndex === 1) {
      return (formData.staffAttendance || []).length > 0;
    }
    return true;
  }

  if (flow === 'class' && adminMode) {
    if (stepIndex === 0) {
      return !!selectedStaffId && !!formData.sessionId;
    }
    const afterCombined = stepIndex - 1;
    switch (afterCombined) {
      case 0:
        return (formData.staffAttendance || []).length > 0;
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return true;
      case 7:
        return true;
      default:
        return false;
    }
  }

  const adjustedStepIndex = adminMode ? stepIndex - 1 : stepIndex;

  switch (adjustedStepIndex) {
    case 0:
      return !!formData.sessionId;
    case 1:
      return (formData.staffAttendance || []).length > 0;
    case 2:
      return true;
    case 3:
      return true;
    case 4:
      return true;
    case 5:
      return true;
    case 6:
      return true;
    case 7:
      return true;
    case 8:
      return true;
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
