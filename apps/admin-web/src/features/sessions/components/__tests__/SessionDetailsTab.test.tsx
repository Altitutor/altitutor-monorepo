import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDetailsTab } from '../SessionDetailsTab';
import { renderWithProviders } from '@/shared/test-utils';
import type { Tables } from '@altitutor/shared';

function renderComponent(overrides: Partial<React.ComponentProps<typeof SessionDetailsTab>> = {}) {
  const onAddStudentToSession = jest.fn();
  const onAddStaffToSession = jest.fn();
  const onRemoveStudentFromSession = jest.fn();
  const onRemoveStaffFromSession = jest.fn();
  const onUndoLogAbsenceStudent = jest.fn();
  const onUndoLogAbsenceStaff = jest.fn();

  const result = renderWithProviders(
    <SessionDetailsTab
      session={{
        id: 'session-1',
        start_at: '2026-01-01T00:00:00.000Z',
        end_at: '2026-01-01T01:00:00.000Z',
        class_id: 'class-1',
        class: {
          id: 'class-1',
          day_of_week: 1,
          start_time: '15:00',
          end_time: '16:00',
          subject: { id: 'subject-1', name: 'Math', code: 'MATH' },
        },
      }}
      studentsData={[
        {
          student: { id: 'student-extra', first_name: 'Extra', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-extra',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending-extra',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
        {
          student: { id: 'student-normal', first_name: 'Normal', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-normal',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
      ]}
      staffData={[
        {
          staff: { id: 'staff-1', first_name: 'Staff', last_name: 'Member' } as Tables<'staff'>,
          sessionsStaffId: 'sf-1',
          swappedSessionsStaffId: null,
          plannedStatus: 'attending',
          actualStatus: 'not-logged',
          swappedStaffName: '',
          swappedStaffId: '',
          submittedTutorLog: false,
          plannedAbsence: false,
        },
      ]}
      tutorLog={null}
      allTopics={[]}
      sessionId="session-1"
      isSessionInPast={false}
      currentStaff={null}
      onOpenSession={jest.fn()}
      onOpenStudent={jest.fn()}
      onOpenStaff={jest.fn()}
      onOpenClass={jest.fn()}
      onMessageStudent={jest.fn()}
      onMessageStaff={jest.fn()}
      onOpenTopic={jest.fn()}
      onOpenFile={jest.fn()}
      onLogAbsenceStudent={jest.fn()}
      onLogAbsenceStaff={jest.fn()}
      onUndoLogAbsenceStudent={onUndoLogAbsenceStudent}
      onUndoLogAbsenceStaff={onUndoLogAbsenceStaff}
      onAddStudentToSession={onAddStudentToSession}
      onAddStaffToSession={onAddStaffToSession}
      onRemoveStudentFromSession={onRemoveStudentFromSession}
      onRemoveStaffFromSession={onRemoveStaffFromSession}
      {...overrides}
    />
  );

  return {
    ...result,
    onAddStudentToSession,
    onAddStaffToSession,
    onRemoveStudentFromSession,
    onRemoveStaffFromSession,
    onUndoLogAbsenceStudent,
    onUndoLogAbsenceStaff,
  };
}

describe('SessionDetailsTab', () => {
  it('renders add buttons and fires callbacks', async () => {
    const user = userEvent.setup();
    const { onAddStudentToSession, onAddStaffToSession } = renderComponent();

    await user.click(screen.getByRole('button', { name: /add student/i }));
    await user.click(screen.getByRole('button', { name: /add staff/i }));

    expect(onAddStudentToSession).toHaveBeenCalledTimes(1);
    expect(onAddStaffToSession).toHaveBeenCalledTimes(1);
  });

  it('shows remove from session only for extra students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-extra', first_name: 'Extra', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-extra',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending-extra-trial',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
      ],
    });

    const extraRow = screen.getByText('Extra Student').closest('tr');
    expect(extraRow).not.toBeNull();
    const extraRowButtons = within(extraRow as HTMLElement).getAllByRole('button');
    await user.click(extraRowButtons[extraRowButtons.length - 1]);
    expect(await screen.findByText('Remove from session')).toBeInTheDocument();
  });

  it('does not show remove from session for non-extra students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-normal', first_name: 'Normal', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-normal',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
      ],
    });

    const normalRow = screen.getByText('Normal Student').closest('tr');
    expect(normalRow).not.toBeNull();
    const normalRowButtons = within(normalRow as HTMLElement).getAllByRole('button');
    await user.click(normalRowButtons[normalRowButtons.length - 1]);
    const removeOption = await screen.findByText('Remove from session');
    expect(removeOption).toBeInTheDocument();
    expect(removeOption.closest('[role="menuitem"]')).toHaveClass('text-muted-foreground');
  });

  it('does not show remove from session for invoiced extra students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-invoiced', first_name: 'Invoiced', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-invoiced',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending-extra',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: 'paid',
          plannedAbsence: false,
          hasInvoiceItems: true,
        },
      ],
    });

    const row = screen.getByText('Invoiced Student').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    const removeOption = await screen.findByText('Remove from session');
    expect(removeOption).toBeInTheDocument();
    expect(removeOption.closest('[role="menuitem"]')).toHaveClass('text-muted-foreground');
  });

  it('shows remove from session for staff', async () => {
    const user = userEvent.setup();
    renderComponent();

    const staffRow = screen.getByText('Staff Member').closest('tr');
    expect(staffRow).not.toBeNull();
    const staffRowButtons = within(staffRow as HTMLElement).getAllByRole('button');
    await user.click(staffRowButtons[staffRowButtons.length - 1]);

    expect(await screen.findByText('Remove from session')).toBeInTheDocument();
  });

  it('does not show remove from session for students when session has tutor log', async () => {
    const user = userEvent.setup();
    renderComponent({
      tutorLog: {
        id: 'tlog-1',
        created_by_staff: { first_name: 'Tutor', last_name: 'Logger' },
        topics: [],
      },
      studentsData: [
        {
          student: { id: 'student-extra', first_name: 'Extra', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-extra',
          plannedStatus: 'attending-extra',
          actualStatus: 'attended',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
      ] as React.ComponentProps<typeof SessionDetailsTab>['studentsData'],
      staffData: [],
    });

    const studentRow = screen.getByText('Extra Student').closest('tr');
    expect(studentRow).not.toBeNull();
    const studentRowButtons = within(studentRow as HTMLElement).getAllByRole('button');
    await user.click(studentRowButtons[studentRowButtons.length - 1]);
    const removeOption = await screen.findByText('Remove from session');
    expect(removeOption).toBeInTheDocument();
    expect(removeOption.closest('[role="menuitem"]')).toHaveClass('text-muted-foreground');
  });

  it('does not show remove from session for staff when session has tutor log', async () => {
    const user = userEvent.setup();
    renderComponent({
      tutorLog: {
        id: 'tlog-1',
        created_by_staff: { first_name: 'Tutor', last_name: 'Logger' },
        topics: [],
      },
      studentsData: [],
      staffData: [
        {
          staff: { id: 'staff-1', first_name: 'Staff', last_name: 'Member' } as Tables<'staff'>,
          sessionsStaffId: 'sf-1',
          plannedStatus: 'attending',
          actualStatus: 'attended',
          swappedStaffName: '',
          swappedStaffId: '',
          submittedTutorLog: true,
          plannedAbsence: false,
        },
      ] as React.ComponentProps<typeof SessionDetailsTab>['staffData'],
    });

    const staffRow = screen.getByText('Staff Member').closest('tr');
    expect(staffRow).not.toBeNull();
    const staffRowButtons = within(staffRow as HTMLElement).getAllByRole('button');
    await user.click(staffRowButtons[staffRowButtons.length - 1]);
    const removeOption = await screen.findByText('Remove from session');
    expect(removeOption).toBeInTheDocument();
    expect(removeOption.closest('[role="menuitem"]')).toHaveClass('text-muted-foreground');
  });

  it('shows undo log absence for credited students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-credited', first_name: 'Credited', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-credited',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'credited',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: true,
          hasInvoiceItems: false,
        },
      ],
    });

    const row = screen.getByText('Credited Student').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    expect(await screen.findByText('Undo Log Absence')).toBeInTheDocument();
  });

  it('shows undo log absence for rescheduled students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-rescheduled', first_name: 'Rescheduled', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-rescheduled',
          rescheduledSessionsStudentsId: 'ss-target',
          plannedStatus: 'rescheduled',
          actualStatus: 'not-logged',
          rescheduledDate: 'Tue 01/01 10:00',
          rescheduledSessionId: 'session-target',
          invoiceStatus: null,
          plannedAbsence: true,
          hasInvoiceItems: false,
        },
      ],
    });

    const row = screen.getByText('Rescheduled Student').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    expect(await screen.findByText('Undo Log Absence')).toBeInTheDocument();
  });

  it('shows undo log absence for absent staff', async () => {
    const user = userEvent.setup();
    renderComponent({
      studentsData: [],
      staffData: [
        {
          staff: { id: 'staff-absent', first_name: 'Absent', last_name: 'Tutor' } as Tables<'staff'>,
          sessionsStaffId: 'sf-absent',
          swappedSessionsStaffId: null,
          plannedStatus: 'absent',
          actualStatus: 'not-logged',
          swappedStaffName: '',
          swappedStaffId: '',
          submittedTutorLog: false,
          plannedAbsence: true,
        },
      ],
    });

    const row = screen.getByText('Absent Tutor').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    expect(await screen.findByText('Undo Log Absence')).toBeInTheDocument();
  });

  it('shows undo log absence for swapped staff', async () => {
    const user = userEvent.setup();
    renderComponent({
      studentsData: [],
      staffData: [
        {
          staff: { id: 'staff-swapped', first_name: 'Swapped', last_name: 'Tutor' } as Tables<'staff'>,
          sessionsStaffId: 'sf-swapped',
          swappedSessionsStaffId: 'sf-replacement',
          plannedStatus: 'swapped',
          actualStatus: 'not-logged',
          swappedStaffName: 'Replacement Tutor',
          swappedStaffId: 'staff-replacement',
          submittedTutorLog: false,
          plannedAbsence: true,
        },
      ],
    });

    const row = screen.getByText('Swapped Tutor').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    expect(await screen.findByText('Undo Log Absence')).toBeInTheDocument();
  });

  it('does not show undo log absence for attending students', async () => {
    const user = userEvent.setup();
    renderComponent({
      staffData: [],
      studentsData: [
        {
          student: { id: 'student-attending', first_name: 'Attending', last_name: 'Student' } as Tables<'students'>,
          sessionsStudentsId: 'ss-attending',
          rescheduledSessionsStudentsId: null,
          plannedStatus: 'attending',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
      ],
    });

    const row = screen.getByText('Attending Student').closest('tr');
    expect(row).not.toBeNull();
    const rowButtons = within(row as HTMLElement).getAllByRole('button');
    await user.click(rowButtons[rowButtons.length - 1]);
    expect(screen.queryByText('Undo Log Absence')).not.toBeInTheDocument();
    expect(screen.getByText('Log Absence')).toBeInTheDocument();
  });
});
