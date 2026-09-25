import type { Tables } from '@altitutor/shared';
import {
  assertResolvedAttendanceRows,
  getAttendanceCompletionBlockers,
  hasCompleteParentAttendanceForSession,
  hasCompleteStaffAttendanceForSession,
  hasCompleteStudentAttendanceForSession,
  isTutorLogAttendanceChoiceResolved,
  meetingAttendanceStepIsComplete,
} from '@altitutor/shared';
import type { TutorLogFormData } from '../types';

export type LogSessionAttendanceContext = {
  staffIds: string[];
  studentIds: string[];
  parentIds: string[];
  sessionType: string | null;
};

export function normalizeTutorLogFormDataForSubmit(
  data: TutorLogFormData
): TutorLogFormData {
  return {
    ...data,
    staffAttendance: assertResolvedAttendanceRows(data.staffAttendance || [], 'Staff attendance'),
    studentAttendance: assertResolvedAttendanceRows(
      data.studentAttendance || [],
      'Student attendance'
    ),
    parentAttendance: assertResolvedAttendanceRows(
      data.parentAttendance || [],
      'Parent attendance'
    ),
  };
}

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
  if (adminMode && initialSessionId && flow !== 'meeting') {
    return 1;
  }
  if (!adminMode && initialSessionId && flow === 'meeting') {
    return 1;
  }
  return 0;
}

export type LogSessionMemberLabels = {
  staffNames: Record<string, string>;
  studentNames: Record<string, string>;
  parentNames: Record<string, string>;
};

/**
 * Human-readable reasons the user cannot advance from the current wizard step.
 */
export function getLogSessionStepBlockers(
  stepIndex: number,
  adminMode: boolean,
  flow: LogSessionWizardFlow,
  formData: Partial<TutorLogFormData>,
  selectedStaffId: string,
  attendanceContext?: LogSessionAttendanceContext,
  labels?: LogSessionMemberLabels
): string[] {
  const blockers: string[] = [];
  const staffAttendance = formData.staffAttendance || [];
  const studentAttendance = formData.studentAttendance || [];
  const parentAttendance = formData.parentAttendance || [];

  const attendanceBlockers =
    attendanceContext && labels
      ? getAttendanceCompletionBlockers({
          staffIds: attendanceContext.staffIds,
          studentIds: attendanceContext.studentIds,
          parentIds: attendanceContext.parentIds,
          includeParents: attendanceContext.sessionType !== 'CLASS',
          staffAttendance,
          studentAttendance,
          parentAttendance,
          staffNames: labels.staffNames,
          studentNames: labels.studentNames,
          parentNames: labels.parentNames,
        })
      : [];

  if (flow === 'meeting') {
    if (adminMode) {
      if (stepIndex === 0) {
        if (!selectedStaffId) blockers.push('Select the staff member this log is for.');
        if (!formData.sessionId) blockers.push('Select a session.');
        return blockers;
      }
      if (stepIndex === 1) return attendanceBlockers;
      return blockers;
    }
    if (stepIndex === 0) {
      if (!formData.sessionId) blockers.push('Select a session.');
      return blockers;
    }
    if (stepIndex === 1) return attendanceBlockers;
    return blockers;
  }

  if (flow === 'class' && adminMode) {
    if (stepIndex === 0) {
      if (!selectedStaffId) blockers.push('Select the staff member this log is for.');
      if (!formData.sessionId) blockers.push('Select a session.');
      return blockers;
    }
    const afterCombined = stepIndex - 1;
    if (afterCombined === 0) {
      return attendanceBlockers.filter(
        (b) => b.includes('(staff)') || b.startsWith('Assign at least one staff')
      );
    }
    if (afterCombined === 1) {
      return attendanceBlockers.filter(
        (b) => b.includes('(student)') || b.includes('(parent)')
      );
    }
    return blockers;
  }

  const adjustedStepIndex = adminMode ? stepIndex - 1 : stepIndex;
  if (adjustedStepIndex === 0) {
    if (!formData.sessionId) blockers.push('Select a session.');
    return blockers;
  }
  if (adjustedStepIndex === 1) {
    return attendanceBlockers.filter(
      (b) => b.includes('(staff)') || b.startsWith('Assign at least one staff')
    );
  }
  if (adjustedStepIndex === 2) {
    return attendanceBlockers.filter((b) => b.includes('(student)') || b.includes('(parent)'));
  }
  return blockers;
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
  _selectedSession: Tables<'sessions'> | null,
  attendanceContext?: LogSessionAttendanceContext
): boolean {
  const staffAttendance = formData.staffAttendance || [];
  const studentAttendance = formData.studentAttendance || [];
  const parentAttendance = formData.parentAttendance || [];

  const staffComplete = attendanceContext
    ? hasCompleteStaffAttendanceForSession(attendanceContext.staffIds, staffAttendance)
    : staffAttendance.length > 0 &&
      staffAttendance.every((row) => isTutorLogAttendanceChoiceResolved(row.attended));

  const studentsComplete = attendanceContext
    ? hasCompleteStudentAttendanceForSession(attendanceContext.studentIds, studentAttendance)
    : studentAttendance.every((row) => isTutorLogAttendanceChoiceResolved(row.attended));

  const parentsComplete =
    !attendanceContext ||
    attendanceContext.sessionType === 'CLASS' ||
    hasCompleteParentAttendanceForSession(attendanceContext.parentIds, parentAttendance);

  const meetingAttendanceComplete =
    attendanceContext &&
    meetingAttendanceStepIsComplete({
      staffIds: attendanceContext.staffIds,
      studentIds: attendanceContext.studentIds,
      parentIds: attendanceContext.parentIds,
      staffAttendance,
      studentAttendance,
      parentAttendance,
    });

  if (flow === 'meeting') {
    if (adminMode) {
      if (stepIndex === 0) {
        return !!selectedStaffId && !!formData.sessionId;
      }
      if (stepIndex === 1) {
        return meetingAttendanceComplete === true;
      }
      return true;
    }
    if (stepIndex === 0) {
      return !!formData.sessionId;
    }
    if (stepIndex === 1) {
      return meetingAttendanceComplete === true;
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
        return staffComplete;
      case 1:
        return studentsComplete && parentsComplete;
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
      return staffComplete;
    case 2:
      return studentsComplete && parentsComplete;
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
    .filter((sa) => sa.attended === true)
    .map((sa) => sa.studentId);
}
