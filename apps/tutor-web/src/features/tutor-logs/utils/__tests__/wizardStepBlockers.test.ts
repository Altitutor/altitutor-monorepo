import { getTutorLogWizardStepBlockers } from '../wizardStepBlockers';

const assignedStaff = {
  staff_id: 'staff-1',
  staff: { first_name: 'Sam', last_name: 'Tutor' },
};

const enrolledStudent = {
  student_id: 'student-1',
  student: { first_name: 'Stu', last_name: 'Dent' },
};

describe('getTutorLogWizardStepBlockers', () => {
  it('does not ask to assign staff on student attendance when a staff member is already assigned', () => {
    const blockers = getTutorLogWizardStepBlockers({
      adminMode: false,
      currentStep: 1,
      skipSessionStep: true,
      sessionId: 'session-1',
      topicsCount: 0,
      staffAttendance: [{ staffId: 'staff-1', attended: true }],
      studentAttendance: [{ studentId: 'student-1', attended: true }],
      sessionStaff: [assignedStaff],
      sessionStudents: [enrolledStudent],
    });

    expect(blockers).not.toContain('Assign at least one staff member to this session.');
    expect(blockers).toEqual([]);
  });

  it('still asks for a student attendance choice on that step', () => {
    const blockers = getTutorLogWizardStepBlockers({
      adminMode: false,
      currentStep: 1,
      skipSessionStep: true,
      sessionId: 'session-1',
      topicsCount: 0,
      staffAttendance: [{ staffId: 'staff-1', attended: true }],
      studentAttendance: [{ studentId: 'student-1', attended: null }],
      sessionStaff: [assignedStaff],
      sessionStudents: [enrolledStudent],
    });

    expect(blockers).toEqual(['Stu Dent (student) — select Attended or Did not attend.']);
  });

  it('asks to assign staff only on the staff step when the session has none', () => {
    const blockers = getTutorLogWizardStepBlockers({
      adminMode: false,
      currentStep: 0,
      skipSessionStep: true,
      sessionId: 'session-1',
      topicsCount: 0,
      staffAttendance: [],
      studentAttendance: [],
      sessionStaff: [],
      sessionStudents: [enrolledStudent],
    });

    expect(blockers).toEqual(['Assign at least one staff member to this session.']);
  });
});
