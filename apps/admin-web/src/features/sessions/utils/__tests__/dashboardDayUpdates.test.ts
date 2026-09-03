import {
  buildDashboardDayUpdates,
  hasDashboardDayUpdates,
  type DashboardDaySession,
  type DashboardDayStaff,
  type DashboardDayStudent,
} from '../dashboardDayUpdates';
import type { Tables } from '@altitutor/shared';

function session(overrides: Partial<DashboardDaySession> = {}): DashboardDaySession {
  return {
    id: 'session-1',
    type: 'CLASS',
    class_id: 'class-1',
    start_at: '2026-09-03T06:45:00.000Z',
    end_at: '2026-09-03T08:15:00.000Z',
    original_start_at: '2026-09-03T06:45:00.000Z',
    original_end_at: '2026-09-03T08:15:00.000Z',
    short_name: null,
    long_name: null,
    ...overrides,
  };
}

function student(overrides: Partial<DashboardDayStudent> = {}): DashboardDayStudent {
  return {
    id: 'student-1',
    first_name: 'Alice',
    last_name: 'Chen',
    planned_absence: false,
    is_extra: false,
    sessions_students_id: 'ss-1',
    ...overrides,
  };
}

function staff(overrides: Partial<DashboardDayStaff> = {}): DashboardDayStaff {
  return {
    id: 'staff-1',
    first_name: 'Jane',
    last_name: 'Tutor',
    planned_absence: false,
    is_swapped_in: false,
    ...overrides,
  };
}

const classesById = {
  'class-1': { id: 'class-1', short_name: '12MATH tue 4:15', long_name: 'Year 12 Methods' },
} as unknown as Record<string, Tables<'classes'>>;

const emptySubjects = {} as Record<string, Tables<'subjects'>>;

describe('buildDashboardDayUpdates', () => {
  it('returns no updates for a normal class session', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session()],
      sessionStudents: { 'session-1': [student()] },
      sessionStaff: { 'session-1': [staff()] },
      classesById,
      subjectsById: emptySubjects,
      classStaffAssignments: [
        {
          class_id: 'class-1',
          staff_id: 'staff-1',
          assigned_at: '2026-01-01T00:00:00.000Z',
          unassigned_at: null,
        },
      ],
    });

    expect(hasDashboardDayUpdates(updates)).toBe(false);
  });

  it('lists meetings and omits class and admin-shift sessions', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [
        session({ id: 'meeting-1', type: 'ADMIN_MEETING', class_id: null, short_name: null }),
        session({ id: 'check-in-1', type: 'CHECK_IN', class_id: null }),
        session({ id: 'trial-1', type: 'TRIAL_SESSION', class_id: null, short_name: 'TRIAL sun 6 sep 11:15' }),
        session({ id: 'subsidy-1', type: 'SUBSIDY_INTERVIEW', class_id: null }),
        session({ id: 'shift-1', type: 'ADMIN_SHIFT', class_id: null }),
        session({ id: 'class-session', type: 'CLASS' }),
      ],
      sessionStudents: {
        'trial-1': [student({ is_extra: true })],
      },
      sessionStaff: {
        'meeting-1': [staff({ first_name: 'Matt', last_name: 'Chua' })],
      },
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.meetings.map((item) => item.sessionId)).toEqual([
      'meeting-1',
      'check-in-1',
      'subsidy-1',
      'trial-1',
    ]);
    expect(updates.meetings[0]?.attendeeNames).toBe('Matt Chua');
    expect(updates.meetings[0]?.sessionLabel).toBe('Admin Meeting');
    expect(updates.extraStudents).toEqual([]);
  });

  it('lists class sessions whose time differs from the original schedule', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [
        session({
          start_at: '2026-09-03T07:30:00.000Z',
          end_at: '2026-09-03T09:00:00.000Z',
          original_start_at: '2026-09-03T06:45:00.000Z',
          original_end_at: '2026-09-03T08:15:00.000Z',
        }),
        session({
          id: 'same-time-room-change',
          original_start_at: '2026-09-03T06:45:00.000Z',
          original_end_at: '2026-09-03T08:15:00.000Z',
        }),
      ],
      sessionStudents: {},
      sessionStaff: {},
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.timeChanges).toHaveLength(1);
    expect(updates.timeChanges[0]).toMatchObject({
      sessionId: 'session-1',
      sessionLabel: '12MATH tue 4:15',
      originalStartAt: '2026-09-03T06:45:00.000Z',
    });
  });

  it('lists a class moved onto this day and a class moved off this day', () => {
    const updates = buildDashboardDayUpdates({
      viewDate: '2026-09-03',
      sessions: [
        session({
          id: 'arrived',
          start_at: '2026-09-03T07:30:00.000Z',
          end_at: '2026-09-03T09:00:00.000Z',
          original_start_at: '2026-09-02T06:45:00.000Z',
          original_end_at: '2026-09-02T08:15:00.000Z',
          short_name: '11BIOL arrived',
        }),
        session({
          id: 'left',
          start_at: '2026-09-07T07:30:00.000Z',
          end_at: '2026-09-07T09:00:00.000Z',
          original_start_at: '2026-09-03T06:45:00.000Z',
          original_end_at: '2026-09-03T08:15:00.000Z',
          short_name: '11BIOL left',
        }),
      ],
      sessionStudents: {
        left: [student({ planned_absence: true })],
      },
      sessionStaff: {},
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.timeChanges.map((item) => item.sessionId)).toEqual(['arrived', 'left']);
    expect(updates.studentAbsences).toEqual([]);
  });

  it('lists meeting attendees as students, parents, then staff', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session({ type: 'SUBSIDY_INTERVIEW', class_id: null, short_name: 'SUBSIDY sun 6 sep 11:15' })],
      sessionStudents: { 'session-1': [student()] },
      sessionParents: {
        'session-1': [{ id: 'parent-1', first_name: 'Priya', last_name: 'Chen' }],
      },
      sessionStaff: { 'session-1': [staff({ first_name: 'Samantha', last_name: 'Valerio' })] },
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.meetings).toEqual([
      expect.objectContaining({
        sessionLabel: 'SUBSIDY sun 6 sep 11:15',
        attendeeNames: 'Alice Chen, Priya Chen, Samantha Valerio',
      }),
    ]);
  });

  it('lists student absences and planned extra students on teaching sessions', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session()],
      sessionStudents: {
        'session-1': [
          student({ planned_absence: true }),
          student({
            id: 'student-2',
            first_name: 'Bob',
            last_name: 'Lee',
            is_extra: true,
          }),
          student({
            id: 'student-3',
            first_name: 'Cara',
            last_name: 'Ng',
            is_extra: true,
            planned_absence: true,
            sessions_students_id: 'ss-3',
          }),
          student({
            id: 'student-4',
            first_name: 'Dan',
            last_name: 'Unplanned',
            is_extra: true,
            sessions_students_id: null,
          }),
        ],
      },
      sessionStaff: {},
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.studentAbsences.map((item) => item.personName)).toEqual(['Alice Chen', 'Cara Ng']);
    expect(updates.extraStudents.map((item) => item.personName)).toEqual(['Bob Lee']);
  });

  it('does not list extra students on meetings', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session({ type: 'ADMIN_MEETING', class_id: null })],
      sessionStudents: {
        'session-1': [student({ is_extra: true })],
      },
      sessionStaff: {},
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.extraStudents).toEqual([]);
  });

  it('lists a trial session as a meeting rather than an extra student', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session({ type: 'TRIAL_SESSION', class_id: null, short_name: 'TRIAL sun 6 sep 11:15' })],
      sessionStudents: {
        'session-1': [student({ is_extra: true })],
      },
      sessionStaff: { 'session-1': [staff({ first_name: 'Tahlia', last_name: 'A' })] },
      classesById,
      subjectsById: emptySubjects,
    });

    expect(updates.meetings).toHaveLength(1);
    expect(updates.meetings[0]?.sessionLabel).toBe('TRIAL sun 6 sep 11:15');
    expect(updates.extraStudents).toEqual([]);
  });

  it('lists a staff swap as one row and keeps unpaired absences and extra staff', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session()],
      sessionStudents: {},
      sessionStaff: {
        'session-1': [
          staff({
            planned_absence: true,
            is_swapped: true,
            swapped_staff: { id: 'staff-2', first_name: 'Sam', last_name: 'Cover' },
          }),
          staff({
            id: 'staff-2',
            first_name: 'Sam',
            last_name: 'Cover',
            is_swapped_in: true,
          }),
          staff({
            id: 'staff-3',
            first_name: 'Pat',
            last_name: 'Extra',
          }),
          staff({
            id: 'staff-4',
            first_name: 'Riley',
            last_name: 'Away',
            planned_absence: true,
          }),
        ],
      },
      classesById,
      subjectsById: emptySubjects,
      classStaffAssignments: [
        {
          class_id: 'class-1',
          staff_id: 'staff-1',
          assigned_at: '2026-01-01T00:00:00.000Z',
          unassigned_at: null,
        },
        {
          class_id: 'class-1',
          staff_id: 'staff-4',
          assigned_at: '2026-01-01T00:00:00.000Z',
          unassigned_at: null,
        },
      ],
    });

    expect(updates.staffSwaps).toEqual([
      expect.objectContaining({
        kind: 'staff_swap',
        personName: 'Jane Tutor',
        incomingName: 'Sam Cover',
        sessionLabel: '12MATH tue 4:15',
      }),
    ]);
    expect(updates.staffAbsences.map((item) => item.personName)).toEqual(['Riley Away']);
    expect(updates.extraStaff.map((item) => item.personName)).toEqual(['Pat Extra']);
  });

  it('pairs an absence with the only swapped-in staff when the explicit swap link is missing', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session()],
      sessionStudents: {},
      sessionStaff: {
        'session-1': [
          staff({ planned_absence: true }),
          staff({
            id: 'staff-2',
            first_name: 'Test',
            last_name: 'Admin',
            is_swapped_in: true,
          }),
        ],
      },
      classesById,
      subjectsById: emptySubjects,
      classStaffAssignments: [
        {
          class_id: 'class-1',
          staff_id: 'staff-1',
          assigned_at: '2026-01-01T00:00:00.000Z',
          unassigned_at: null,
        },
      ],
    });

    expect(updates.staffSwaps).toEqual([
      expect.objectContaining({
        personName: 'Jane Tutor',
        incomingName: 'Test Admin',
      }),
    ]);
    expect(updates.staffAbsences).toEqual([]);
    expect(updates.extraStaff).toEqual([]);
  });

  it('does not treat regular class staff as extra when assignment data is missing', () => {
    const updates = buildDashboardDayUpdates({
      sessions: [session()],
      sessionStudents: {},
      sessionStaff: { 'session-1': [staff()] },
      classesById,
      subjectsById: emptySubjects,
      classStaffAssignments: [],
    });

    expect(updates.extraStaff).toEqual([]);
  });
});
