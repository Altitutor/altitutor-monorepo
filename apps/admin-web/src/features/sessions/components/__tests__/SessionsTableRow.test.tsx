import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tables } from '@altitutor/shared';
import { renderWithProviders } from '@/shared/test-utils';
import { SessionsTableRow, type SessionsTableRowProps } from '../SessionsTableRow';
import type { UseSessionsTableModalsReturn } from '../../hooks/useSessionsTableModals';
import type { SessionTableStudent } from '../../types/sessions-table';
import { useInvoiceSessionMutation } from '../../hooks/useInvoiceSessionMutation';

jest.mock('../../hooks/useInvoiceSessionMutation');

const mockUseInvoiceSessionMutation = useInvoiceSessionMutation as jest.MockedFunction<
  typeof useInvoiceSessionMutation
>;

function createBaseSession(): Tables<'sessions'> {
  return {
    id: 'session-1',
    start_at: new Date('2024-01-01T10:00:00Z').toISOString(),
    end_at: new Date('2024-01-01T11:00:00Z').toISOString(),
    type: 'CLASS',
    status: 'ACTIVE',
    class_id: null,
    subject_id: null,
    billing_type: 'CLASS',
    admin_shift_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    short_name: null,
    long_name: null,
  };
}

function createStudent(): SessionTableStudent {
  return {
    id: 'student-1',
    first_name: 'John',
    last_name: 'Doe',
    planned_absence: false,
    invoice_status: null,
    sessions_students_id: 'ss-1',
  } as SessionTableStudent;
}

function createBaseProps(overrides: Partial<SessionsTableRowProps> = {}): SessionsTableRowProps {
  const session = createBaseSession();
  const student = createStudent();

  const modals: UseSessionsTableModalsReturn = {
    actionSessionId: null,
    setActionSessionId: () => {},
    isLogSessionModalOpen: false,
    openLogSessionModal: () => {},
    closeLogSessionModal: () => Promise.resolve(),
    studentAbsenceSessionId: null,
    isLogAbsenceDialogOpen: false,
    openLogAbsenceDialog: () => {},
    closeLogAbsenceDialog: () => Promise.resolve(),
    selectedClassId: null,
    isClassModalOpen: false,
    openClassModal: () => {},
    closeClassModal: () => {},
    selectedTutorLogId: null,
    isEditTutorLogModalOpen: false,
    openEditTutorLogModal: () => {},
    closeEditTutorLogModal: () => {},
  };

  const base: SessionsTableRowProps = {
    session,
    visibleColumns: ['invoice'],
    classId: undefined,
    hideClassColumn: false,
    hideTypeColumn: false,
    hideStudentsColumn: false,
    hideBilling: false,
    isStudentAttendanceView: true,
    isStaffAttendanceView: false,
    studentId: student.id,
    staffId: undefined,
    classesById: {},
    sessionStudents: {
      [session.id]: [student as unknown as Tables<'students'>],
    },
    sessionStaff: {
      [session.id]: [] as unknown as Tables<'staff'>[],
    },
    tutorLogs: {},
    allSessions: [session],
    formatDate: (dateString: string) => dateString,
    getTimeRange: () => '10:00am - 11:00am',
    getClassDisplayName: () => 'Class',
    getClassShortDisplayName: () => 'Class',
    onOpenSession: () => {},
    onOpenStudent: () => {},
    onOpenStaff: () => {},
    onUndoLogAbsenceStudent: () => {},
    onUndoLogAbsenceStaff: () => {},
    onRemoveStudentFromSession: () => {},
    onRemoveStaffFromSession: () => {},
    modals,
    currentStaff: null,
    onSessionClick: () => {},
    onClassClick: () => {},
    onCopySessionId: () => Promise.resolve(),
    router: {
      push: () => {},
    },
    uninvoicedSessionsStudentsIds: undefined,
  };

  return {
    ...base,
    ...overrides,
  };
}

describe('SessionsTableRow - invoice column', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows Send invoice button when session is uninvoiced for the student', async () => {
    const mutate = jest.fn();
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const user = userEvent.setup();
    const props = createBaseProps({
      uninvoicedSessionsStudentsIds: new Set(['ss-1']),
    });

    renderWithProviders(<SessionsTableRow {...props} />);

    const button = await screen.findByRole('button', { name: /send invoice/i });
    await user.click(button);

    expect(mutate).toHaveBeenCalledWith('ss-1');
  });

  it('does not show Send invoice button when session is not in uninvoiced set', () => {
    const mutate = jest.fn();
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const props = createBaseProps({
      uninvoicedSessionsStudentsIds: new Set<string>(),
    });

    renderWithProviders(<SessionsTableRow {...props} />);

    expect(screen.queryByRole('button', { name: /send invoice/i })).not.toBeInTheDocument();
  });
});

