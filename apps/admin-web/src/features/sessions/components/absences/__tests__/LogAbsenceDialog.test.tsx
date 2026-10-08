import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { LogAbsenceDialog } from '../LogAbsenceDialog';

const mutateAsync = jest.fn();

const mockStudent = {
  id: 'student-1',
  first_name: 'Alex',
  last_name: 'Student',
};

const mockSession = {
  id: 'session-1',
  sessionsStudentsId: 'assignment-1',
};

jest.mock('../../../hooks', () => ({
  useStudentFutureSessions: () => ({ data: [mockSession], isLoading: false }),
  useLogAbsences: () => ({ mutateAsync }),
}));

jest.mock('../../../hooks/useAbsenceInitialData', () => ({
  useMissingStudentSession: () => ({ data: null }),
  useInitialStudentForAbsence: () => ({ data: mockStudent }),
}));

jest.mock('@/features/students/hooks', () => ({
  useStudentsSearchForAbsence: () => ({
    data: { students: [], total: 0 },
    isLoading: false,
  }),
}));

jest.mock('@/shared/components', () => ({
  AdminDialogShell: ({
    children,
    footer,
    title,
    subtitle,
    closeDisabled,
    onClose,
  }: {
    children: ReactNode;
    footer: ReactNode;
    title: string;
    subtitle: string;
    closeDisabled?: boolean;
    onClose: () => void;
  }) => (
    <div>
      <button disabled={closeDisabled} onClick={onClose}>Close</button>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
      {footer}
    </div>
  ),
}));

jest.mock('@/shared/components/StudentCard', () => ({
  StudentCard: () => <div>Student</div>,
}));

jest.mock('../AbsenceSessionSelector', () => ({
  AbsenceSessionSelector: () => <div>Sessions</div>,
}));

jest.mock('../AbsenceBulkActionSelector', () => ({
  AbsenceBulkActionSelector: ({
    onDecisionsChange,
  }: {
    onDecisionsChange: (decisions: Array<{ sessionId: string; action: 'credit' }>) => void;
  }) => (
    <button onClick={() => onDecisionsChange([{ sessionId: 'session-1', action: 'credit' }])}>
      Choose credit
    </button>
  ),
}));

jest.mock('../AbsenceMessageScreen', () => ({
  AbsenceMessageScreen: ({
    billingWarning,
    billingStatus,
  }: {
    billingWarning?: string;
    billingStatus?: string;
  }) => (
    <div>
      Message {billingWarning}
      <span data-testid="billing-status">{billingStatus}</span>
    </div>
  ),
}));

describe('LogAbsenceDialog', () => {
  beforeEach(() => {
    mutateAsync.mockReset();
    mutateAsync.mockResolvedValue({ success: true });
  });

  it('shows only an optional internal note and submits a stable internal reason category', async () => {
    render(
      <LogAbsenceDialog
        isOpen
        onClose={jest.fn()}
        staffId="staff-1"
        initialStudentId="student-1"
        initialSessionId="session-1"
      />,
    );

    await screen.findByRole('heading', { name: 'Process Absences' });

    expect(screen.queryByText('Approved absence')).not.toBeInTheDocument();
    expect(screen.queryByText('Extended absence')).not.toBeInTheDocument();
    expect(screen.queryByText('Admin discretion')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Internal note (optional)'), {
      target: { value: 'Parent called before class' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choose credit' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm All Actions/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Confirm All Actions/ }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        operations: [
          {
            student_id: 'student-1',
            original_sessions_students_id: 'assignment-1',
            action: 'credit',
            target_session_id: undefined,
          },
        ],
        staffId: 'staff-1',
        reason: {
          category: 'approved_absence',
          note: 'Parent called before class',
        },
      });
    });
  });

  it('shows staff when billing was queued for retry after the absence was saved', async () => {
    mutateAsync.mockResolvedValueOnce({
      success: true,
      billing: { status: 'queued' },
      warning: 'Absence saved; billing queued for retry.',
    });

    render(
      <LogAbsenceDialog
        isOpen
        onClose={jest.fn()}
        staffId="staff-1"
        initialStudentId="student-1"
        initialSessionId="session-1"
      />,
    );

    await screen.findByRole('heading', { name: 'Process Absences' });
    fireEvent.click(screen.getByRole('button', { name: 'Choose credit' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Confirm All Actions/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Confirm All Actions/ }));

    expect(await screen.findByText(/Absence saved; billing queued for retry\./)).toBeInTheDocument();
    expect(screen.getByTestId('billing-status')).toHaveTextContent('queued');
  });
});


it('shows progress and prevents repeat submissions while billing is processing', async () => {
  mutateAsync.mockReset();
  let finish!: (result: { success: boolean }) => void;
  mutateAsync.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
  render(<LogAbsenceDialog isOpen onClose={jest.fn()} staffId="staff-1" initialStudentId="student-1" initialSessionId="session-1" />);
  await screen.findByRole('heading', { name: 'Process Absences' });
  fireEvent.click(screen.getByRole('button', { name: 'Choose credit' }));
  fireEvent.click(screen.getByRole('button', { name: /Confirm All Actions/ }));
  expect(screen.getByRole('button', { name: /Processing absences/ })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Saving absences and applying billing changes');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  expect(screen.getByLabelText('Internal note (optional)')).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: /Processing absences/ }));
  expect(mutateAsync).toHaveBeenCalledTimes(1);
  await act(async () => finish({ success: true }));
  expect(await screen.findByText('Message')).toBeInTheDocument();
});


it('releases the submission lock and allows retry after a failed request', async () => {
  mutateAsync.mockReset();
  mutateAsync.mockRejectedValueOnce(new Error('Billing request failed'));
  render(<LogAbsenceDialog isOpen onClose={jest.fn()} staffId="staff-1" initialStudentId="student-1" initialSessionId="session-1" />);
  await screen.findByRole('heading', { name: 'Process Absences' });
  fireEvent.click(screen.getByRole('button', { name: 'Choose credit' }));
  fireEvent.click(screen.getByRole('button', { name: /Confirm All Actions/ }));
  expect(await screen.findByText('Billing request failed')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Go Back' }));
  expect(screen.getByRole('button', { name: /Confirm All Actions/ })).toBeEnabled();
});
