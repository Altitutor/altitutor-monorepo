import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  }: {
    children: ReactNode;
    footer: ReactNode;
    title: string;
    subtitle: string;
  }) => (
    <div>
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
  AbsenceMessageScreen: () => <div>Message</div>,
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
});
