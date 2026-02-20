/**
 * Comprehensive tests for centralized attendance status derivation
 */

import {
  deriveStudentPlannedStatus,
  deriveStudentActualStatus,
  deriveStudentAttendanceStatus,
  deriveStaffPlannedStatus,
  deriveStaffActualStatus,
  deriveStaffAttendanceStatus,
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
} from '../attendanceDerivation';
import {
  STUDENT_PLANNED_STATUSES,
  STUDENT_ACTUAL_STATUSES,
  STAFF_PLANNED_STATUSES,
  STAFF_ACTUAL_STATUSES,
} from '../../constants/attendanceStatuses';
import type {
  StudentAttendanceInput,
  StaffAttendanceInput,
  StudentAttendanceContext,
  StaffAttendanceContext,
} from '../attendanceDerivation';

describe('deriveStudentPlannedStatus', () => {
  const baseContext: StudentAttendanceContext = {
    hasTutorLog: false,
    plannedStudentIds: new Set(['student-1', 'student-2']),
  };

  it('should return attending for normal planned attendance', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: false,
      is_extra: false,
      was_trial: false,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ATTENDING);
  });

  it('should return attending-trial when student was trial', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: false,
      is_extra: false,
      was_trial: true,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ATTENDING_TRIAL);
  });

  it('should return attending-extra for extra student who is also planned', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: false,
      is_extra: true,
      was_trial: false,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ATTENDING_EXTRA);
  });

  it('should return attending-extra-trial for extra trial student who is also planned', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: false,
      is_extra: true,
      was_trial: true,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ATTENDING_EXTRA_TRIAL);
  });

  it('should return absent for planned absence', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_extra: false,
      was_trial: false,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ABSENT);
  });

  it('should return rescheduled when session is rescheduled', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_rescheduled: true,
      rescheduled_session: {
        session: {
          id: 'session-2',
          start_at: '2024-01-20T10:00:00Z',
          class: { start_time: '10:00' },
        },
      },
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.RESCHEDULED);
    expect(result.rescheduledSessionId).toBe('session-2');
    expect(result.rescheduledDate).toContain('10:00');
  });

  it('should return credited when absence is credited', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_credited: true,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.CREDITED);
  });

  it('should return unplanned for unplanned extra student', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-3',
      sessions_students_id: null,
      planned_absence: false,
      is_extra: true,
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.UNPLANNED);
  });

  it('should prioritize rescheduled over credited', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_rescheduled: true,
      is_credited: true,
      rescheduled_session: {
        session: {
          id: 'session-2',
          start_at: '2024-01-20T10:00:00Z',
        },
      },
    };

    const result = deriveStudentPlannedStatus(input, baseContext);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.RESCHEDULED);
  });
});

describe('deriveStudentActualStatus', () => {
  const baseContext: StudentAttendanceContext = {
    hasTutorLog: true,
    plannedStudentIds: new Set(),
  };

  it('should return not-logged when no tutor log exists', () => {
    const input: StudentAttendanceInput = {};
    const context: StudentAttendanceContext = {
      hasTutorLog: false,
      plannedStudentIds: new Set(),
    };

    const result = deriveStudentActualStatus(input, context);

    expect(result).toBe(STUDENT_ACTUAL_STATUSES.NOT_LOGGED);
  });

  it('should return attended when student attended', () => {
    const input: StudentAttendanceInput = {
      actual_attended: true,
      actual_was_trial: false,
    };

    const result = deriveStudentActualStatus(input, baseContext);

    expect(result).toBe(STUDENT_ACTUAL_STATUSES.ATTENDED);
  });

  it('should return attended-trial when student attended and was trial', () => {
    const input: StudentAttendanceInput = {
      actual_attended: true,
      actual_was_trial: true,
    };

    const result = deriveStudentActualStatus(input, baseContext);

    expect(result).toBe(STUDENT_ACTUAL_STATUSES.ATTENDED_TRIAL);
  });

  it('should return did-not-attend when student did not attend', () => {
    const input: StudentAttendanceInput = {
      actual_attended: false,
    };

    const result = deriveStudentActualStatus(input, baseContext);

    expect(result).toBe(STUDENT_ACTUAL_STATUSES.DID_NOT_ATTEND);
  });
});

describe('deriveStudentAttendanceStatus', () => {
  it('should combine planned and actual statuses correctly', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: false,
      was_trial: true,
      actual_attended: true,
      actual_was_trial: true,
    };

    const context: StudentAttendanceContext = {
      hasTutorLog: true,
      plannedStudentIds: new Set(['student-1']),
    };

    const result = deriveStudentAttendanceStatus(input, context);

    expect(result.plannedStatus).toBe(STUDENT_PLANNED_STATUSES.ATTENDING_TRIAL);
    expect(result.actualStatus).toBe(STUDENT_ACTUAL_STATUSES.ATTENDED_TRIAL);
    expect(result.rescheduledSessionId).toBe('');
    expect(result.rescheduledDate).toBe('');
  });
});

describe('deriveStaffPlannedStatus', () => {
  it('should return attending for normal planned attendance', () => {
    const input: StaffAttendanceInput = {
      planned_absence: false,
      was_trial: false,
    };

    const result = deriveStaffPlannedStatus(input);

    expect(result.status).toBe(STAFF_PLANNED_STATUSES.ATTENDING);
  });

  it('should return attending-trial when staff was trial', () => {
    const input: StaffAttendanceInput = {
      planned_absence: false,
      was_trial: true,
    };

    const result = deriveStaffPlannedStatus(input);

    expect(result.status).toBe(STAFF_PLANNED_STATUSES.ATTENDING_TRIAL);
  });

  it('should return absent for planned absence', () => {
    const input: StaffAttendanceInput = {
      planned_absence: true,
      is_swapped: false,
    };

    const result = deriveStaffPlannedStatus(input);

    expect(result.status).toBe(STAFF_PLANNED_STATUSES.ABSENT);
  });

  it('should return swapped when staff is swapped', () => {
    const input: StaffAttendanceInput = {
      planned_absence: true,
      is_swapped: true,
      swapped_staff: {
        id: 'staff-2',
        first_name: 'Bob',
        last_name: 'Johnson',
      },
    };

    const result = deriveStaffPlannedStatus(input);

    expect(result.status).toBe(STAFF_PLANNED_STATUSES.SWAPPED);
    expect(result.swappedStaffId).toBe('staff-2');
    expect(result.swappedStaffName).toBe('Bob Johnson');
  });

  it('should handle swapped staff with empty name parts', () => {
    const input: StaffAttendanceInput = {
      planned_absence: true,
      is_swapped: true,
      swapped_staff: {
        id: 'staff-2',
        first_name: 'Bob',
        last_name: '',
      },
    };

    const result = deriveStaffPlannedStatus(input);

    expect(result.swappedStaffName).toBe('Bob');
  });
});

describe('deriveStaffActualStatus', () => {
  const baseContext: StaffAttendanceContext = {
    hasTutorLog: true,
  };

  it('should return not-logged when no tutor log exists', () => {
    const input: StaffAttendanceInput = {};
    const context: StaffAttendanceContext = {
      hasTutorLog: false,
    };

    const result = deriveStaffActualStatus(input, context);

    expect(result).toBe(STAFF_ACTUAL_STATUSES.NOT_LOGGED);
  });

  it('should return attended when staff attended', () => {
    const input: StaffAttendanceInput = {
      actual_attended: true,
      actual_was_trial: false,
    };

    const result = deriveStaffActualStatus(input, baseContext);

    expect(result).toBe(STAFF_ACTUAL_STATUSES.ATTENDED);
  });

  it('should return attended-trial when staff attended and was trial', () => {
    const input: StaffAttendanceInput = {
      actual_attended: true,
      actual_was_trial: true,
    };

    const result = deriveStaffActualStatus(input, baseContext);

    expect(result).toBe(STAFF_ACTUAL_STATUSES.ATTENDED_TRIAL);
  });

  it('should return did-not-attend when staff did not attend', () => {
    const input: StaffAttendanceInput = {
      actual_attended: false,
    };

    const result = deriveStaffActualStatus(input, baseContext);

    expect(result).toBe(STAFF_ACTUAL_STATUSES.DID_NOT_ATTEND);
  });
});

describe('deriveStaffAttendanceStatus', () => {
  it('should combine planned and actual statuses correctly', () => {
    const input: StaffAttendanceInput = {
      planned_absence: true,
      is_swapped: true,
      swapped_staff: {
        id: 'staff-2',
        first_name: 'Bob',
        last_name: 'Johnson',
      },
      actual_attended: true,
    };

    const context: StaffAttendanceContext = {
      hasTutorLog: true,
    };

    const result = deriveStaffAttendanceStatus(input, context);

    expect(result.plannedStatus).toBe(STAFF_PLANNED_STATUSES.SWAPPED);
    expect(result.actualStatus).toBe(STAFF_ACTUAL_STATUSES.ATTENDED);
    expect(result.swappedStaffId).toBe('staff-2');
    expect(result.swappedStaffName).toBe('Bob Johnson');
  });

  it('should combine planned trial and actual trial statuses correctly', () => {
    const input: StaffAttendanceInput = {
      planned_absence: false,
      was_trial: true,
      actual_attended: true,
      actual_was_trial: true,
    };

    const context: StaffAttendanceContext = {
      hasTutorLog: true,
    };

    const result = deriveStaffAttendanceStatus(input, context);

    expect(result.plannedStatus).toBe(STAFF_PLANNED_STATUSES.ATTENDING_TRIAL);
    expect(result.actualStatus).toBe(STAFF_ACTUAL_STATUSES.ATTENDED_TRIAL);
  });
});

describe('buildStudentAttendanceMap', () => {
  it('should build attendance map from tutor log', () => {
    const tutorLog = {
      studentAttendance: [
        { student_id: 'student-1', attended: true, was_trial: false },
        { student_id: 'student-2', attended: false },
        { student_id: 'student-3', attended: true, was_trial: true },
      ],
    };

    const result = buildStudentAttendanceMap(tutorLog);

    expect(result).toEqual({
      'student-1': { attended: true, was_trial: false },
      'student-2': { attended: false },
      'student-3': { attended: true, was_trial: true },
    });
  });

  it('should return empty object when tutor log is null', () => {
    const result = buildStudentAttendanceMap(null);
    expect(result).toEqual({});
  });

  it('should return empty object when tutor log has no student attendance', () => {
    const tutorLog = {};
    const result = buildStudentAttendanceMap(tutorLog);
    expect(result).toEqual({});
  });

  it('should handle empty attendance array', () => {
    const tutorLog = { studentAttendance: [] };
    const result = buildStudentAttendanceMap(tutorLog);
    expect(result).toEqual({});
  });
});

describe('buildStaffAttendanceMap', () => {
  it('should build attendance map from tutor log with type', () => {
    const tutorLog = {
      staffAttendance: [
        { staff_id: 'staff-1', attended: true, type: 'MAIN_TUTOR' },
        { staff_id: 'staff-2', attended: false },
      ],
    };

    const result = buildStaffAttendanceMap(tutorLog);

    expect(result).toEqual({
      'staff-1': { attended: true, type: 'MAIN_TUTOR' },
      'staff-2': { attended: false },
    });
  });

  it('should build attendance map with was_trial', () => {
    const tutorLog = {
      staffAttendance: [
        { staff_id: 'staff-1', attended: true, type: 'MAIN_TUTOR', was_trial: true },
        { staff_id: 'staff-2', attended: true, was_trial: false },
      ],
    };

    const result = buildStaffAttendanceMap(tutorLog);

    expect(result).toEqual({
      'staff-1': { attended: true, type: 'MAIN_TUTOR', was_trial: true },
      'staff-2': { attended: true, was_trial: false },
    });
  });

  it('should return empty object when tutor log is null', () => {
    const result = buildStaffAttendanceMap(null);
    expect(result).toEqual({});
  });

  it('should return empty object when tutor log has no staff attendance', () => {
    const tutorLog = {};
    const result = buildStaffAttendanceMap(tutorLog);
    expect(result).toEqual({});
  });

  it('should handle attendance without type', () => {
    const tutorLog = {
      staffAttendance: [
        { staff_id: 'staff-1', attended: true },
      ],
    };

    const result = buildStaffAttendanceMap(tutorLog);
    expect(result).toEqual({
      'staff-1': { attended: true },
    });
  });
});

describe('Edge cases and complex scenarios', () => {
  it('should handle student extra status correctly when not in plannedStudentIds', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-3',
      sessions_students_id: 'ss-3',
      planned_absence: false,
      is_extra: true,
      was_trial: false,
    };

    const context: StudentAttendanceContext = {
      hasTutorLog: false,
      plannedStudentIds: new Set(['student-1', 'student-2']), // student-3 not in set
    };

    const result = deriveStudentPlannedStatus(input, context);

    // Should be regular attending, not attending-extra
    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.ATTENDING);
  });

  it('should handle rescheduled date formatting correctly', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_rescheduled: true,
      rescheduled_session: {
        session: {
          id: 'session-2',
          start_at: '2024-01-15T14:30:00Z',
          class: { start_time: '14:30' },
        },
      },
    };

    const context: StudentAttendanceContext = {
      hasTutorLog: false,
      plannedStudentIds: new Set(),
    };

    const result = deriveStudentPlannedStatus(input, context);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.RESCHEDULED);
    expect(result.rescheduledDate).toContain('14:30');
  });

  it('should handle rescheduled without class time', () => {
    const input: StudentAttendanceInput = {
      student_id: 'student-1',
      sessions_students_id: 'ss-1',
      planned_absence: true,
      is_rescheduled: true,
      rescheduled_session: {
        session: {
          id: 'session-2',
          start_at: '2024-01-15T14:30:00Z',
          class: null,
        },
      },
    };

    const context: StudentAttendanceContext = {
      hasTutorLog: false,
      plannedStudentIds: new Set(),
    };

    const result = deriveStudentPlannedStatus(input, context);

    expect(result.status).toBe(STUDENT_PLANNED_STATUSES.RESCHEDULED);
    expect(result.rescheduledDate).toBeTruthy();
  });
});
