import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Tables } from '@altitutor/shared';
import { renderWithProviders } from '@/shared/test-utils';
import { SessionsTableRow, type SessionsTableRowProps } from '../SessionsTableRow';
import type { UseSessionsTableModalsReturn } from '../../hooks/useSessionsTableModals';
import type { SessionTableStaff, SessionTableStudent } from '../../types/sessions-table';
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

function createStaff(overrides: Partial<SessionTableStaff> = {}): SessionTableStaff {
  return {
    id: 'staff-1',
    first_name: 'Alex',
    last_name: 'Tutor',
    planned_absence: false,
    sessions_staff_id: 'sstaff-1',
    ...overrides,
  } as SessionTableStaff;
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
    staffAbsenceSessionId: null,
    isLogStaffAbsenceDialogOpen: false,
    openLogStaffAbsenceDialog: () => {},
    closeLogStaffAbsenceDialog: () => Promise.resolve(),
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
          fullAmountCents: 10208,
          creditAppliedCents: 0,
          balanceAddedCents: 0,
          currency: 'aud',
          billingDate: '31 Dec',
          action: 'bill',
        },
      },
    });

    renderRow(props);

    expect(screen.getByText('$102.08')).toBeInTheDocument();
    expect(screen.getByText('Bills 31 Dec')).toBeInTheDocument();
    expect(screen.queryByText('Credit applied')).not.toBeInTheDocument();
  });

  it('shows the credit-adjusted upcoming amount', () => {
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const props = createBaseProps({
      invoicePreviewsBySessionId: {
        'session-1': {
          amountCents: 6000,
          fullAmountCents: 10000,
          creditAppliedCents: 4000,
          balanceAddedCents: 0,
          currency: 'aud',
          billingDate: '31 Dec',
          action: 'bill',
        },
      },
    });

    renderRow(props);

    expect(screen.getByText('$100.00')).toHaveClass('line-through');
    expect(screen.getByText('$60.00')).toBeInTheDocument();
    expect(screen.getByText('Credit applied')).toBeInTheDocument();
  });

  it('shows a positive customer balance added to the upcoming amount', () => {
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);

    const props = createBaseProps({
      invoicePreviewsBySessionId: {
        'session-1': {
          amountCents: 12000,
          fullAmountCents: 10000,
          creditAppliedCents: 0,
          balanceAddedCents: 2000,
          currency: 'aud',
          billingDate: '31 Dec',
          action: 'bill',
        },
      },
    });

    renderRow(props);

    expect(screen.getByText('$100.00')).toHaveClass('line-through');
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('Balance added')).toBeInTheDocument();
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


describe('SessionsTableRow - absence treatment', () => {
  beforeEach(() => {
    mockUseInvoiceSessionMutation.mockReturnValue({ mutate: jest.fn(), isPending: false } as unknown as ReturnType<typeof useInvoiceSessionMutation>);
  });

  it.each([
    [false, false, 'Charge'],
    [false, true, 'Credit'],
    [true, false, 'Replacement'],
  ] as const)('shows absent independently of %s/%s treatment flags', (is_rescheduled, is_credited, label) => {
    const student = { ...createStudent(), planned_absence: true, is_rescheduled, is_credited };
    renderRow(createBaseProps({ visibleColumns: ['planned_attendance', 'actual_attendance', 'absence_treatment'], sessionStudents: { 'session-1': [student] } }));
    expect(screen.getByText('Absent')).toBeInTheDocument();
    expect(screen.getByText('Unlogged')).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('opens the linked replacement session from the treatment column', async () => {
    const onOpenSession = jest.fn();
    const student = { ...createStudent(), planned_absence: true, is_rescheduled: true, rescheduled_session: { session: { id: 'target-session', start_at: null, class: null } } };
    renderRow(createBaseProps({ visibleColumns: ['planned_attendance', 'absence_treatment'], sessionStudents: { 'session-1': [student] }, onOpenSession }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Replacement' }));
    expect(onOpenSession).toHaveBeenCalledWith('target-session');
  });
});

describe('SessionsTableRow - staff log / undo absence actions', () => {
  beforeEach(() => {
    mockUseInvoiceSessionMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useInvoiceSessionMutation>);
  });

  function createStaffAttendanceProps(
    staff: SessionTableStaff,
    overrides: Partial<SessionsTableRowProps> = {},
  ): SessionsTableRowProps {
    return createBaseProps({
      isStudentAttendanceView: false,
      isStaffAttendanceView: true,
      studentId: undefined,
      staffId: staff.id,
      sessionStudents: { 'session-1': [] },
      sessionStaff: { 'session-1': [staff as unknown as Tables<'staff'>] },
      onUndoLogAbsenceStaff: jest.fn(),
      currentStaff: { id: 'current-staff-1' },
      ...overrides,
    });
  }

  it('shows log staff absence when staff has no logged absence', async () => {
    const openLogStaffAbsenceDialog = jest.fn();
    const user = userEvent.setup();
    const props = createStaffAttendanceProps(createStaff({ planned_absence: false }));
    props.modals = { ...props.modals, openLogStaffAbsenceDialog };

    renderRow(props);
    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Log staff absence')).toBeInTheDocument();
    expect(screen.queryByText('Undo log absence')).not.toBeInTheDocument();

    await user.click(screen.getByText('Log staff absence'));
    expect(openLogStaffAbsenceDialog).toHaveBeenCalledWith('session-1');
  });

  it('shows log staff absence as disabled when the session already has a tutor log', async () => {
    const openLogStaffAbsenceDialog = jest.fn();
    const user = userEvent.setup();
    const props = createStaffAttendanceProps(createStaff({ planned_absence: false }), {
      tutorLogs: {
        'session-1': {
          id: 'tutor-log-1',
          created_by: 'current-staff-1',
          created_by_name: { first_name: 'Pat', last_name: 'Admin' },
        },
      },
    });
    props.modals = { ...props.modals, openLogStaffAbsenceDialog };

    renderRow(props);
    await user.click(screen.getByRole('button', { name: '' }));

    const logItem = screen.getByText('Log staff absence');
    expect(logItem).toBeInTheDocument();
    expect(screen.queryByText('Undo log absence')).not.toBeInTheDocument();

    await user.click(logItem);
    expect(openLogStaffAbsenceDialog).not.toHaveBeenCalled();
  });

  it('shows undo log absence when staff has a planned absence', async () => {
    const user = userEvent.setup();
    renderRow(createStaffAttendanceProps(createStaff({ planned_absence: true })));

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Undo log absence')).toBeInTheDocument();
    expect(screen.queryByText('Log staff absence')).not.toBeInTheDocument();
  });

  it('shows undo log absence when staff is swapped', async () => {
    const user = userEvent.setup();
    renderRow(
      createStaffAttendanceProps(
        createStaff({
          planned_absence: true,
          is_swapped: true,
          swapped_staff: { id: 'staff-2', first_name: 'Sam', last_name: 'Cover' },
        }),
      ),
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('Undo log absence')).toBeInTheDocument();
    expect(screen.queryByText('Log staff absence')).not.toBeInTheDocument();
  });
});
