import {
  getAttendanceCompletionBlockers,
  type TutorLogAttendanceChoice,
} from '@altitutor/shared';

type NamedPerson = { first_name: string | null; last_name: string | null };

export type TutorLogWizardBlockerInput = {
  adminMode: boolean;
  currentStep: number;
  skipSessionStep: boolean;
  sessionId?: string;
  topicsCount: number;
  adminSelectedStaffId?: string | null;
  staffAttendance: Array<{ staffId: string; attended: TutorLogAttendanceChoice | undefined }>;
  studentAttendance: Array<{ studentId: string; attended: TutorLogAttendanceChoice | undefined }>;
  sessionStaff: Array<{ staff_id: string; staff: NamedPerson }>;
  sessionStudents: Array<{ student_id: string; student: NamedPerson }>;
};

function displayName(person: NamedPerson): string {
  return `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim();
}

/**
 * Reasons the tutor log wizard cannot leave the current step.
 * Step indexes match LogSessionModal: staff attendance is actual step 1,
 * student attendance is actual step 2.
 */
export function getTutorLogWizardStepBlockers(input: TutorLogWizardBlockerInput): string[] {
  if (input.adminMode && input.currentStep === 0) {
    if (!input.adminSelectedStaffId) {
      return ['Select the staff member this log is for.'];
    }
    return [];
  }

  const stepIndex = input.adminMode ? input.currentStep - 1 : input.currentStep;
  const actualStepIndex = input.skipSessionStep ? stepIndex + 1 : stepIndex;

  if (actualStepIndex === 0) {
    if (!input.sessionId) return ['Select a session.'];
    return [];
  }

  const staffNames = Object.fromEntries(
    input.sessionStaff.map((row) => [row.staff_id, displayName(row.staff)])
  );
  const studentNames = Object.fromEntries(
    input.sessionStudents.map((row) => [row.student_id, displayName(row.student)])
  );

  if (actualStepIndex === 1) {
    return getAttendanceCompletionBlockers({
      staffIds: input.sessionStaff.map((row) => row.staff_id),
      studentIds: [],
      parentIds: [],
      includeParents: false,
      staffAttendance: input.staffAttendance,
      studentAttendance: [],
      parentAttendance: [],
      staffNames,
    });
  }

  if (actualStepIndex === 2) {
    return getAttendanceCompletionBlockers({
      staffIds: input.sessionStaff.map((row) => row.staff_id),
      studentIds: input.sessionStudents.map((row) => row.student_id),
      parentIds: [],
      includeParents: false,
      staffAttendance: input.staffAttendance,
      studentAttendance: input.studentAttendance,
      parentAttendance: [],
      staffNames,
      studentNames,
    }).filter((blocker) => blocker.includes('(student)') || blocker.includes('(parent)'));
  }

  if (actualStepIndex === 3 && input.topicsCount === 0) {
    return ['Select at least one topic.'];
  }

  return [];
}
