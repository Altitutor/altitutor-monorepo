import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ClassWithExpandedSubject, Tables } from '@altitutor/shared';
import { ChangeClassStep2SelectDate } from '../ChangeClassStep2SelectDate';
import { sessionCalendarDate } from '../../../hooks/useClassTransferSessions';

jest.mock('@altitutor/ui', () => ({
  SearchableSelect: ({ items, value, onValueChange, ariaLabel }: {
    items: { id: string; label: string }[];
    value: { id: string } | null;
    onValueChange: (item: { id: string; label: string } | undefined) => void;
    ariaLabel: string;
  }) => <select aria-label={ariaLabel} value={value?.id ?? ''}
    onChange={event => onValueChange(items.find(item => item.id === event.target.value))}>
    <option value="">Choose a session</option>
    {items.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
  </select>,
}));
jest.mock('../../../hooks/useClassTransferSessions', () => ({
  ...jest.requireActual('../../../hooks/useClassTransferSessions'),
  useClassTransferSessions: () => ({ data: [
    { id: 'old-final', class_id: 'old', start_at: '2026-09-09T08:15:00Z' },
    { id: 'old-next', class_id: 'old', start_at: '2026-09-16T08:15:00Z' },
    { id: 'new-first', class_id: 'new', start_at: '2026-09-19T01:30:00Z' },
  ], isLoading: false, error: null }),
}));
jest.mock('@/shared/lib/supabase/client', () => ({ getSupabaseClient: jest.fn() }));

function DateStep() {
  const [lastOldClassDate, onLastDateChange] = useState('');
  const [firstNewClassDate, onFirstDateChange] = useState('');
  return <ChangeClassStep2SelectDate
    oldClass={{ id: 'old', long_name: 'Wednesday class', schedule_timezone: 'Australia/Adelaide' } as Tables<'classes'>}
    selectedNewClass={{ id: 'new', long_name: 'Saturday class', schedule_timezone: 'Australia/Adelaide' } as ClassWithExpandedSubject}
    {...{ lastOldClassDate, firstNewClassDate, onLastDateChange, onFirstDateChange }}
  />;
}

it('keeps the chosen final Wednesday when the first Saturday is selected independently', () => {
  render(<DateStep />);
  const oldDate = screen.getByLabelText('Last date in old class');
  const newDate = screen.getByLabelText('First date in new class');
  fireEvent.change(oldDate, { target: { value: '2026-09-09' } });
  fireEvent.change(newDate, { target: { value: '2026-09-19' } });
  expect(oldDate).toHaveValue('2026-09-09');
  expect(newDate).toHaveValue('2026-09-19');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByText(/Both selected dates are included/)).toBeInTheDocument();
});

it('uses the class timezone at midnight and across daylight saving', () => {
  expect(sessionCalendarDate('2026-10-03T14:00:00Z', 'Australia/Adelaide')).toBe('2026-10-03');
  expect(sessionCalendarDate('2026-10-04T14:00:00Z', 'Australia/Adelaide')).toBe('2026-10-05');
});
