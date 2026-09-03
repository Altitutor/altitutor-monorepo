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
    booking_public_token: null,
    admin_shift_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    short_name: null,
    long_name: null,
    calendar_tombstone_until: null,
    is_schedule_exception: false,
    original_end_at: null,
    original_start_at: null,
    room: null,
    schedule_origin: 'LEGACY',
    schedule_revision_id: null,
    schedule_slot_id: null,
  };
}

function createStudent(): SessionTableStudent {
  return {
    id: 'student-1',
    first_name: 'John',
    last_name: 'Doe',
    planned_absence: false,
    invoice_status_payload: null,
    sessions_students_id: 'ss-1',
  } as SessionTableStudent;
}

function createBaseProps(overrides: Partial<SessionsTableRowProps> = {}): SessionsTableRowProps {
  const session = createBaseSession();
  const student = createStudent();

  const modals: UseSessionsTableModalsReturn = {
    actionSessionId: null,
    logSessionInitialKind: undefined,
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
    subjectsById: {},
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

function renderRow(props: SessionsTableRowProps) {
  return renderWithProviders(
    <table>
      <tbody>
        <SessionsTableRow {...props} />
      </tbody>
    </table>
  );
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

    renderRow(props);

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

    renderRow(props);

    expect(screen.queryByRole('button', { name: /send invoice/i })).not.toBeInTheDocument();
  });

  it('shows the upcoming amount and bill date when an invoice has not been created', () => {
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const props = createBaseProps({
      invoicePreviewsBySessionId: {
        'session-1': {
          amountCents: 10208,
          currency: 'aud',
          billingDate: '31 Dec',
          action: 'bill',
        },
      },
    });

    renderRow(props);

    expect(screen.getByText('$102.08')).toBeInTheDocument();
    expect(screen.getByText('Bills 31 Dec')).toBeInTheDocument();
  });

  it('shows invoice number, amount, and status in one clickable link', async () => {
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const student = createStudent();
    student.invoice_status_payload = {
      invoice_id: 'invoice-1',
      status: 'paid',
      paid_at: '2024-01-02T00:00:00Z',
    };
    const props = createBaseProps({
      sessionStudents: { 'session-1': [student] },
      invoiceDetailsById: {
        'invoice-1': {
          invoiceNumber: 'ALT-1234',
          amountCents: 10208,
          currency: 'aud',
        },
      },
    });

    renderRow(props);

    const link = screen.getByRole('button', { name: /ALT-1234.*\$102\.08.*Paid \(2 Jan\)/i });
    expect(link).toBeInTheDocument();
  });
});
