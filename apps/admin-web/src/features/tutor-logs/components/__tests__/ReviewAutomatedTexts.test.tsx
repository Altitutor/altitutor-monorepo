import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Step9Confirmation } from '../steps/Step9Confirmation';
import type { TutorLogFormData } from '../../types';

jest.mock('../../hooks/useStep9ConfirmationData', () => ({
  useStep9ConfirmationData: () => ({ isLoading: false, data: {
    session: { type: 'TRIAL_SESSION' },
    studentsMap: new Map([
      ['student-on', { id: 'student-on', first_name: 'Alex', last_name: 'Student' }],
      ['student-absent', { id: 'student-absent', first_name: 'Absent', last_name: 'Student' }],
    ]),
    parentsMap: new Map([['parent-on', { id: 'parent-on', first_name: 'Pat', last_name: 'Parent' }]]),
  } }),
}));

function Review() {
  const [formData, update] = useState<Partial<TutorLogFormData>>({
    sessionId: 'session',
    studentAttendance: [{ studentId: 'student-on', attended: true }, { studentId: 'student-absent', attended: false }],
    parentAttendance: [{ parentId: 'parent-on', attended: true }],
  });
  const [review, setReview] = useState(true);
  const props = { formData, onUpdate: (patch: Partial<TutorLogFormData>) => update(previous => ({ ...previous, ...patch })) };
  return <>
    <button onClick={() => setReview(!review)}>Previous / Review</button>
    {review && <Step9Confirmation {...props} />}
  </>;
}

it('defaults attended people on, permits independent choices, and retains them when returning to Review', () => {
  render(<Review />);
  const student = screen.getByRole('switch', { name: 'Send automated texts to Alex Student' });
  const parent = screen.getByRole('switch', { name: 'Send automated texts to Pat Parent' });
  expect(student).toBeChecked();
  expect(parent).toBeChecked();
  expect(screen.queryByRole('switch', { name: /Absent Student/ })).not.toBeInTheDocument();
  fireEvent.click(student);
  expect(student).not.toBeChecked();
  expect(parent).toBeChecked();
  fireEvent.click(screen.getByText('Previous / Review'));
  fireEvent.click(screen.getByText('Previous / Review'));
  expect(screen.getByRole('switch', { name: /Alex Student/ })).not.toBeChecked();
  fireEvent.click(screen.getByRole('switch', { name: /Pat Parent/ }));
  expect(screen.getAllByRole('switch').every(toggle => toggle.getAttribute('aria-checked') === 'false')).toBe(true);
  fireEvent.click(screen.getByRole('switch', { name: /Alex Student/ }));
  expect(screen.getByRole('switch', { name: /Alex Student/ })).toBeChecked();
});
