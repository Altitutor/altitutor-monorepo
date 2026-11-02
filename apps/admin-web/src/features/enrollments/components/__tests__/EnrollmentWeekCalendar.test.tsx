import { render, screen } from '@testing-library/react';
import type { ClassWithExpandedSubject, Tables } from '@altitutor/shared';
import { EnrollmentWeekCalendar } from '../EnrollmentWeekCalendar';

jest.mock('@/features/sessions/components/SessionsCard', () => ({
  SessionsCard: ({ session }: { session: { id: string } }) => <div>{session.id}</div>,
}));

jest.mock('@/features/sessions/hooks/useSessionsQuery', () => {
  const at = (hours: number, minutes: number) => new Date(2026, 8, 26, hours, minutes).toISOString();
  const details = (sessions: Array<Record<string, unknown>>) => ({
    data: {
      sessions,
      classesById: {},
      subjectsById: {},
      sessionStudents: {},
      sessionStaff: {},
      tutorLogs: {},
    },
  });
  const layoutSessions = [
    { id: '12MATH', type: 'CLASS', start_at: at(9, 30), end_at: at(12, 30) },
    { id: '11PHYS-am', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
    { id: 'IB', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
    { id: '9SCIE', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
    { id: '11BIOL', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
    { id: '9MATH', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
    { id: '11PHYS-pm', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
  ];

  return {
    useSessionsWithDetails: (args?: { classId?: string }) => {
      if (args?.classId === 'target-class') {
        return details([{
          id: 'moved-wed',
          class_id: 'target-class',
          type: 'CLASS',
          subject_id: 'subject-1',
          // 17:00–18:30 in Adelaide, not the 16:00 schedule.
          start_at: '2026-10-28T06:30:00.000Z',
          end_at: '2026-10-28T08:00:00.000Z',
        }]);
      }
      if (args?.classId === 'layout-class') return details(layoutSessions);
      return details([]);
    },
  };
});

const selectedClass = {
  id: 'target-class',
  day_of_week: 3,
  start_time: '16:00:00',
  end_time: '17:30:00',
  schedule_timezone: 'Australia/Adelaide',
  subject_id: 'subject-1',
  billing_type: 'CLASS',
} as ClassWithExpandedSubject;

describe('EnrollmentWeekCalendar', () => {
  it('shows a moved class session instead of the repeating schedule', () => {
    render(
      <EnrollmentWeekCalendar
        studentId="student-1"
        enrollmentDate="2026-10-28"
        selectedClass={selectedClass}
      />,
    );

    expect(screen.getByText('moved-wed')).toBeInTheDocument();
    expect(screen.queryByText(/^potential-/)).not.toBeInTheDocument();
  });

  it('stacks sessions that meet at an endpoint instead of giving each its own column', () => {
    render(
      <EnrollmentWeekCalendar
        studentId={null}
        enrollmentDate={new Date(2026, 8, 26, 12).toISOString()}
        selectedClass={undefined}
        classData={{ id: 'layout-class' } as Tables<'classes'>}
      />,
    );

    const leftOf = (id: string) => screen.getByText(id).parentElement?.style.left ?? '';
    const morningColumns = new Set(['11PHYS-am', 'IB', '9SCIE'].map(leftOf));
    const afternoonColumns = new Set(['11BIOL', '9MATH', '11PHYS-pm'].map(leftOf));

    expect(afternoonColumns).toEqual(morningColumns);
    expect(morningColumns.has(leftOf('12MATH'))).toBe(false);
    expect(new Set([...morningColumns, leftOf('12MATH')]).size).toBe(4);
  });
});
