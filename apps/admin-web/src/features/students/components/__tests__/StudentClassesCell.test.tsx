import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Tables } from '@altitutor/shared';
import { StudentClassesCell } from '../StudentClassesCell';

jest.mock('@/shared/hooks', () => ({ useCurrentStaff: () => ({ data: { id: 'staff' } }) }));
jest.mock('@/features/enrollments', () => ({
  EnrollStudentModal: ({ subjectId, student }: { subjectId: string; student: { id: string } }) =>
    <div role="dialog" aria-label={`Enrol ${student.id} in ${subjectId}`} />,
}));
const maths = { id: 'maths', name: 'Mathematics', short_name: 'MATH', color: null } as Tables<'subjects'>;
const biology = { id: 'biology', name: 'Biology', short_name: 'BIOL', color: null } as Tables<'subjects'>;

it('shows subjects beside shared class chips and opens subject-scoped enrolment only for missing classes', async () => {
  const openClass = jest.fn();
  const user = userEvent.setup();
  render(<QueryClientProvider client={new QueryClient()}>
    <StudentClassesCell student={{ id: 'alice' } as Tables<'students'>} subjects={[maths, biology]} classes={[
      { id: 'class', subject_id: 'maths', subject: maths, short_name: null, long_name: null, day_of_week: 1, start_time: '16:00' },
    ]} onOpenClass={openClass} />
  </QueryClientProvider>);
  expect(screen.getByText('MATH')).toBeInTheDocument();
  expect(screen.getByText('BIOL')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add class for Mathematics' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Mon 4:00 PM' }));
  expect(openClass).toHaveBeenCalledWith('class');
  await user.click(screen.getByRole('button', { name: 'Add class for Biology' }));
  expect(screen.getByRole('dialog', { name: 'Enrol alice in biology' })).toBeInTheDocument();
});
