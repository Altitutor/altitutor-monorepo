import { render } from '@testing-library/react';
import { StudentSessionsCalendarView } from '@/features/students/components/StudentSessionsCalendarView';
import { StaffSessionsCalendarView } from '@/features/staff/components/modal/tabs/StaffSessionsCalendarView';

jest.mock('@/features/sessions/hooks/useSessionsQuery', () => ({
  useSessionsWithDetails: () => ({ data: undefined }),
}));

jest.mock('@/features/sessions/components/SessionsCard', () => ({
  SessionsCard: () => null,
}));

describe('embedded session calendar grid sizing', () => {
  it.each([
    ['student', <StudentSessionsCalendarView key="student" studentId="student-1" />],
    ['staff', <StaffSessionsCalendarView key="staff" staffId="staff-1" />],
  ])('does not stretch %s hour tracks to fill the modal', (_name, calendar) => {
    const { container } = render(calendar);
    const grid = container.querySelector('.grid');

    expect(grid).not.toHaveClass('min-h-full');
  });
});
