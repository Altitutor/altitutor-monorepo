/**
 * Tests for session data processing utilities
 * Tests attendance map building and data processing functions
 */

import {
  buildStudentAttendanceMap,
  buildStaffAttendanceMap,
  processSessionStudents,
  processSessionStaff,
} from '../sessionDataProcessing';
import type { Tables } from '@altitutor/shared';

describe('buildStudentAttendanceMap', () => {
  it('should build attendance map from tutor log', () => {
    const tutorLog = {
      studentAttendance: [
        { student_id: 'student-1', attended: true },
        { student_id: 'student-2', attended: false },
      ],
    };

    const result = buildStudentAttendanceMap(tutorLog);

    expect(result).toEqual({
      'student-1': { attended: true },
      'student-2': { attended: false },
    });
  });

  it('should return empty object when tutor log has no student attendance', () => {
    const tutorLog = {};
    const result = buildStudentAttendanceMap(tutorLog);
    expect(result).toEqual({});
  });

  it('should return empty object when tutor log is null', () => {
    const result = buildStudentAttendanceMap(null);
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
        { staff_id: 'staff-1', attended: true, type: 'PRIMARY' },
        { staff_id: 'staff-2', attended: false },
      ],
    };

    const result = buildStaffAttendanceMap(tutorLog);

    expect(result).toEqual({
      'staff-1': { attended: true, type: 'PRIMARY' },
      'staff-2': { attended: false },
    });
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

describe('processSessionStudents', () => {
  const mockStudent: Tables<'students'> = {
    id: 'student-1',
    first_name: 'John',
    last_name: 'Doe',
    status: 'ACTIVE',
    active_at: null,
    registered_at: null,
    discontinued_at: null,
    curriculum: null,
    year_level: null,
    school: null,
    email: null,
    phone: null,
    created_at: null,
    updated_at: null,
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    created_by: null,
    user_id: null,
    invite_token: null,
    onboarding_progress: {},
    timezone: 'Australia/Adelaide',
    ucat_target_score_s1: null,
    ucat_target_score_s2: null,
    ucat_target_score_s3: null,
    ucat_test_date: null,
    ucat_onboarding_completed_at: null,
    ucat_online_tier_override: 'default',
    ucat_pro_trial_consumed_at: null,
  };

  it('should process student with planned attendance', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: false,
        is_extra: false,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: null,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result).toHaveLength(1);
    expect(result[0].plannedStatus).toBe('attending');
    expect(result[0].actualStatus).toBe('not-logged');
    expect(result[0].plannedAbsence).toBe(false);
  });

  it('should process student with planned absence', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: true,
        is_extra: false,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: null,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result[0].plannedStatus).toBe('absent');
    expect(result[0].plannedAbsence).toBe(true);
  });

  it('should process student with rescheduled session', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: true,
        is_extra: false,
        is_rescheduled: true,
        is_credited: false,
        rescheduled_session: {
          session: {
            id: 'session-2',
            start_at: '2024-01-20T10:00:00Z',
            class: { start_time: '10:00' },
          },
        },
        invoice_status_payload: null,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result[0].plannedStatus).toBe('rescheduled');
    expect(result[0].rescheduledDate).toContain('10:00');
    expect(result[0].rescheduledSessionId).toBe('session-2');
  });

  it('should process student with credited absence', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: true,
        is_extra: false,
        is_rescheduled: false,
        is_credited: true,
        credited_at: '2026-02-20T00:00:00.000Z',
        invoice_status_payload: null,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result[0].plannedStatus).toBe('credited');
    expect(result[0].creditedDisplayDate).toBe('20/02/2026');
  });

  it('should process unplanned student', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: null,
        student: mockStudent,
        planned_absence: false,
        is_extra: true,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: null,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result[0].plannedStatus).toBe('unplanned');
  });

  it('should process student with actual attendance logged', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: false,
        is_extra: false,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: null,
      },
    ];

    const actualAttendance = {
      'student-1': { attended: true },
    };

    const result = processSessionStudents(sessionsStudents, actualAttendance, true);

    expect(result[0].actualStatus).toBe('attended');
  });

  it('should process student who did not attend', () => {
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: false,
        is_extra: false,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: null,
      },
    ];

    const actualAttendance = {
      'student-1': { attended: false },
    };

    const result = processSessionStudents(sessionsStudents, actualAttendance, true);

    expect(result[0].actualStatus).toBe('did-not-attend');
  });

  it('should handle invoice status', () => {
    const payload = { status: 'paid', paid_at: '2024-01-15T00:00:00Z' };
    const sessionsStudents = [
      {
        student_id: 'student-1',
        sessions_students_id: 'ss-1',
        student: mockStudent,
        planned_absence: false,
        is_extra: false,
        is_rescheduled: false,
        is_credited: false,
        invoice_status_payload: payload,
      },
    ];

    const result = processSessionStudents(sessionsStudents, {}, false);

    expect(result[0].invoiceStatus).toEqual(payload);
    expect(result[0].hasInvoiceItems).toBe(true);
  });
});

describe('processSessionStaff', () => {
  const mockStaff: Tables<'staff'> = {
    id: 'staff-1',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'TUTOR',
    status: 'ACTIVE',
    email: null,
    phone_number: null,
    created_at: null,
    updated_at: null,
    invite_token: null,
    user_id: null,
    office_key_number: null,
    has_parking_remote: null,
    notes: null,
    availability_monday: null,
    availability_tuesday: null,
    availability_wednesday: null,
    availability_thursday: null,
    availability_friday: null,
    availability_saturday_am: null,
    availability_saturday_pm: null,
    availability_sunday_am: null,
    availability_sunday_pm: null,
    drafting_availability: null,
    trial_session_availability: null,
    subsidy_interview_availability: null,
    current_tier_number: 1,
    employment_started_at: '2024-01-01T00:00:00.000Z',
    metric_overrides: {},
  };

  it('should process staff with planned attendance', () => {
    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: false,
        is_swapped: false,
        swapped_staff: null,
      },
    ];

    const result = processSessionStaff(sessionsStaff, {}, false);

    expect(result).toHaveLength(1);
    expect(result[0].plannedStatus).toBe('attending');
    expect(result[0].actualStatus).toBe('not-logged');
    expect(result[0].plannedAbsence).toBe(false);
  });

  it('should process staff with planned absence', () => {
    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: true,
        is_swapped: false,
        swapped_staff: null,
      },
    ];

    const result = processSessionStaff(sessionsStaff, {}, false);

    expect(result[0].plannedStatus).toBe('absent');
    expect(result[0].plannedAbsence).toBe(true);
  });

  it('should process staff with swapped attendance', () => {
    const swappedStaff: Tables<'staff'> = {
      ...mockStaff,
      id: 'staff-2',
      first_name: 'Bob',
      last_name: 'Johnson',
    };

    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: true,
        is_swapped: true,
        swapped_staff: swappedStaff,
      },
    ];

    const result = processSessionStaff(sessionsStaff, {}, false);

    expect(result[0].plannedStatus).toBe('swapped');
    expect(result[0].swappedStaffName).toBe('Bob Johnson');
    expect(result[0].swappedStaffId).toBe('staff-2');
  });

  it('should process staff with actual attendance logged', () => {
    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: false,
        is_swapped: false,
        swapped_staff: null,
      },
    ];

    const actualAttendance = {
      'staff-1': { attended: true, type: 'PRIMARY' },
    };

    const result = processSessionStaff(sessionsStaff, actualAttendance, true);

    expect(result[0].actualStatus).toBe('attended');
    expect(result[0].staffType).toBe('PRIMARY');
  });

  it('should identify staff who submitted tutor log', () => {
    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: false,
        is_swapped: false,
        swapped_staff: null,
      },
    ];

    const result = processSessionStaff(sessionsStaff, {}, true, 'staff-1');

    expect(result[0].submittedTutorLog).toBe(true);
  });

  it('should identify staff who did not submit tutor log', () => {
    const sessionsStaff = [
      {
        staff_id: 'staff-1',
        staff: mockStaff,
        planned_absence: false,
        is_swapped: false,
        swapped_staff: null,
      },
    ];

    const result = processSessionStaff(sessionsStaff, {}, true, 'staff-2');

    expect(result[0].submittedTutorLog).toBe(false);
  });
});
