import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Tables } from '@altitutor/shared';
import type { AdminDialogShell } from '@/shared/components/dialog-shell';
import type { SessionsCard } from '@/features/sessions/components/SessionsCard';
import { AddToHomeworkHelpDialog } from '../AddToHomeworkHelpDialog';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';
import { sessionsApi } from '@/features/sessions/api/sessions';

type SessionResults = Awaited<ReturnType<typeof sessionsApi.getAllSessionsWithDetails>>;
const mockAdd = jest.fn().mockResolvedValue({});
const mockFresh = jest.fn();
const mockToast = jest.fn();
const mockRefetch = jest.fn();
let mockData: SessionResults;
let mockIsError = false;
const student = { id: 'student', first_name: 'Alex', last_name: 'Student' } as Tables<'students'>;

jest.mock('@/shared/components/dialog-shell', () => ({
  AdminDialogShell: ({ title, children, footer }: ComponentProps<typeof AdminDialogShell>) => <div role="dialog"><h1>{title}</h1>{children}{footer}</div>,
}));
jest.mock('@/shared/components/StudentCard', () => ({ StudentCard: () => <p>Alex Student</p> }));
jest.mock('@/features/sessions/components/SessionsCard', () => ({
  SessionsCard: ({ session }: ComponentProps<typeof SessionsCard>) => <span>{session.id}</span>,
}));
jest.mock('@/features/sessions/api/sessions', () => ({ sessionsApi: { getAllSessionsWithDetails: (...args: unknown[]) => mockFresh(...args) } }));
jest.mock('@/features/sessions/hooks/useSessionsQuery', () => ({
  useAddStudentToSession: () => ({ mutateAsync: mockAdd }),
  useSessionsWithDetails: (args: { rangeStart: string; rangeEnd: string }) => {
    // Use the real API's conversion contract so ISO timestamps fail here too.
    const start = dateStringToUtcStart(args.rangeStart);
    const end = dateStringToUtcEnd(args.rangeEnd);
    return {
      data: { ...mockData, sessions: mockData.sessions.filter(session => session.start_at! >= start && session.start_at! <= end) },
      isLoading: false, isError: mockIsError, refetch: mockRefetch,
    };
  },
}));
jest.mock('@altitutor/ui', () => ({
  ...jest.requireActual<typeof import('@altitutor/ui')>('@altitutor/ui'),
  useToast: () => ({ toast: mockToast }),
}));

function session(id: string, offset = 1, type: Tables<'sessions'>['type'] = 'HOMEWORK_HELP'): Tables<'sessions'> {
  const date = new Date();
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + offset);
  date.setHours(14, 0, 0, 0);
  return {
    id, type, start_at: date.toISOString(), end_at: new Date(date.getTime() + 3600000).toISOString(),
    admin_shift_id: null, billing_type: null, booking_public_token: null, calendar_tombstone_until: null,
    class_id: null, created_at: null, is_schedule_exception: false, long_name: null,
    original_end_at: null, original_start_at: null, room: null, schedule_origin: 'MANUAL',
    schedule_revision_id: null, schedule_slot_id: null, short_name: null, status: 'ACTIVE',
    subject_id: null, updated_at: null,
  };
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['setTimeout', 'clearTimeout'] });
  jest.setSystemTime(new Date('2026-10-05T09:00:00'));
  jest.clearAllMocks();
  mockIsError = false;
  mockAdd.mockResolvedValue({});
  mockData = {
    sessions: [session('first'), session('second', 2), session('next-week', 8)],
    sessionStudents: {}, sessionStaff: {}, tutorLogs: {}, classesById: {}, subjectsById: {},
  };
  mockFresh.mockImplementation(async (args: { rangeStart: string; rangeEnd: string }) => {
    dateStringToUtcStart(args.rangeStart);
    dateStringToUtcEnd(args.rangeEnd);
    return mockData;
  });
});
afterEach(() => jest.useRealTimers());

function open() {
  const onClose = jest.fn();
  render(<AddToHomeworkHelpDialog isOpen onClose={onClose} student={student} />);
  return onClose;
}

it('keeps selections across weeks and adds nothing until the review is confirmed', async () => {
  const close = open();
  expect(screen.getByRole('button', { name: 'Add (0)' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'first' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
  fireEvent.click(screen.getByRole('button', { name: 'next-week' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add (2)' }));
  expect(screen.getByRole('heading', { name: 'Review homework help sessions' })).toBeInTheDocument();
  expect(mockAdd).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm add (2)' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mockFresh).toHaveBeenCalledWith({
    types: ['HOMEWORK_HELP'], rangeStart: '2026-10-06', rangeEnd: '2026-10-13',
  });
  expect(mockAdd.mock.calls).toEqual([
    [{ sessionId: 'first', studentId: 'student' }],
    [{ sessionId: 'next-week', studentId: 'student' }],
  ]);
});

it('excludes other session types, past sessions, logged sessions, and existing attendance', () => {
  mockData.sessions.push(session('class', 1, 'CLASS'), session('past', -1), session('logged'), session('already-added'));
  mockData.tutorLogs.logged = { id: 'log', created_by: 'staff', created_by_name: { first_name: 'Staff', last_name: 'Member' } };
  mockData.sessionStudents['already-added'] = [student];
  open();
  for (const name of ['class', 'past', 'logged', 'already-added']) {
    expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
  }
});

it('retains only failed additions so retry does not duplicate successful sessions', async () => {
  const close = open();
  mockAdd.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce({});
  fireEvent.click(screen.getByRole('button', { name: 'first' }));
  fireEvent.click(screen.getByRole('button', { name: 'second' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add (2)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirm add (2)' }));
  await screen.findByText(/Network unavailable/);
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm add (1)' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mockAdd.mock.calls.map(([args]) => args.sessionId)).toEqual(['first', 'second', 'second']);
});

it('rechecks session availability and skips attendance added by another administrator', async () => {
  const close = open();
  fireEvent.click(screen.getByRole('button', { name: 'first' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add (1)' }));
  mockData.sessionStudents.first = [student];
  fireEvent.click(screen.getByRole('button', { name: 'Confirm add (1)' }));
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1));
  expect(mockAdd).not.toHaveBeenCalled();
});

it('keeps the review open when a selected session becomes unavailable', async () => {
  const close = open();
  fireEvent.click(screen.getByRole('button', { name: 'first' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add (1)' }));
  mockData.sessions = [];
  fireEvent.click(screen.getByRole('button', { name: 'Confirm add (1)' }));
  await screen.findByText(/no longer available/);
  expect(mockAdd).not.toHaveBeenCalled();
  expect(close).not.toHaveBeenCalled();
});

it('supports keyboard selection, back navigation, and resets after reopening', () => {
  const onClose = jest.fn();
  const { rerender } = render(<AddToHomeworkHelpDialog isOpen onClose={onClose} student={student} />);
  fireEvent.keyDown(screen.getByRole('button', { name: 'first' }), { key: ' ' });
  expect(screen.getByRole('button', { name: 'first' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Add (1)' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('button', { name: 'Add (1)' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
  expect(mockAdd).not.toHaveBeenCalled();
  rerender(<AddToHomeworkHelpDialog isOpen={false} onClose={onClose} student={student} />);
  rerender(<AddToHomeworkHelpDialog isOpen onClose={onClose} student={student} />);
  expect(screen.getByRole('button', { name: 'Add (0)' })).toBeDisabled();
});

it('shows session loading failures and offers retry', () => {
  mockIsError = true;
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockAdd).not.toHaveBeenCalled();
});


it('includes Sunday but keeps the following Monday in the next week', () => {
  mockData.sessions = [session('sunday', 6), session('monday', 7)];
  open();
  expect(screen.getByRole('button', { name: 'sunday' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'monday' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Next week' }));
  expect(screen.getByRole('button', { name: 'monday' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'sunday' })).not.toBeInTheDocument();
});
