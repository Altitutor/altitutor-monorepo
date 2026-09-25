import {
  getAttendanceCompletionBlockers,
  hasCompleteParentAttendanceForSession,
  hasCompleteStaffAttendanceForSession,
  hasCompleteStudentAttendanceForSession,
  isTutorLogAttendanceChoiceResolved,
  meetingAttendanceStepIsComplete,
} from '../attendance-form';

describe('isTutorLogAttendanceChoiceResolved', () => {
  it('accepts true and false only', () => {
    expect(isTutorLogAttendanceChoiceResolved(true)).toBe(true);
    expect(isTutorLogAttendanceChoiceResolved(false)).toBe(true);
    expect(isTutorLogAttendanceChoiceResolved(null)).toBe(false);
    expect(isTutorLogAttendanceChoiceResolved(undefined)).toBe(false);
  });
});

describe('hasCompleteStaffAttendanceForSession', () => {
  it('requires at least one staff member and a choice for each', () => {
    expect(hasCompleteStaffAttendanceForSession([], [])).toBe(false);
    expect(
      hasCompleteStaffAttendanceForSession(['s1'], [{ staffId: 's1', attended: null }])
    ).toBe(false);
    expect(
      hasCompleteStaffAttendanceForSession(['s1'], [{ staffId: 's1', attended: true }])
    ).toBe(true);
  });
});

describe('hasCompleteStudentAttendanceForSession', () => {
  it('allows empty student roster', () => {
    expect(hasCompleteStudentAttendanceForSession([], [])).toBe(true);
  });

  it('requires a choice for each student', () => {
    expect(
      hasCompleteStudentAttendanceForSession(['st1'], [{ studentId: 'st1', attended: null }])
    ).toBe(false);
    expect(
      hasCompleteStudentAttendanceForSession(['st1'], [{ studentId: 'st1', attended: false }])
    ).toBe(true);
  });
});

describe('hasCompleteParentAttendanceForSession', () => {
  it('allows empty parent roster', () => {
    expect(hasCompleteParentAttendanceForSession([], [])).toBe(true);
  });
});

describe('getAttendanceCompletionBlockers', () => {
  it('lists unresolved people by role', () => {
    expect(
      getAttendanceCompletionBlockers({
        staffIds: ['s1'],
        studentIds: ['st1'],
        parentIds: ['p1'],
        includeParents: true,
        staffAttendance: [{ staffId: 's1', attended: null }],
        studentAttendance: [{ studentId: 'st1', attended: false }],
        parentAttendance: [{ parentId: 'p1', attended: null }],
        staffNames: { s1: 'Sam Staff' },
        studentNames: { st1: 'Stu Dent' },
        parentNames: { p1: 'Pat Parent' },
      })
    ).toEqual([
      'Sam Staff (staff) — select Attended or Did not attend.',
      'Pat Parent (parent) — select Attended or Did not attend.',
    ]);
  });
});

describe('meetingAttendanceStepIsComplete', () => {
  it('requires staff, students, and parents when present', () => {
    expect(
      meetingAttendanceStepIsComplete({
        staffIds: ['s1'],
        studentIds: ['st1'],
        parentIds: ['p1'],
        staffAttendance: [{ staffId: 's1', attended: true }],
        studentAttendance: [{ studentId: 'st1', attended: true }],
        parentAttendance: [{ parentId: 'p1', attended: null }],
      })
    ).toBe(false);

    expect(
      meetingAttendanceStepIsComplete({
        staffIds: ['s1'],
        studentIds: [],
        parentIds: ['p1'],
        staffAttendance: [{ staffId: 's1', attended: true }],
        studentAttendance: [],
        parentAttendance: [{ parentId: 'p1', attended: false }],
      })
    ).toBe(true);
  });
});
