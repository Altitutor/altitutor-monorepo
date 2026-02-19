import React from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionDetailsTab } from '../SessionDetailsTab';
import { renderWithProviders } from '@/shared/test-utils';

function renderComponent(overrides: Partial<React.ComponentProps<typeof SessionDetailsTab>> = {}) {
  const onAddStudentToSession = jest.fn();
  const onAddStaffToSession = jest.fn();
  const onRemoveStudentFromSession = jest.fn();
  const onRemoveStaffFromSession = jest.fn();

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
          student: { id: 'student-extra', first_name: 'Extra', last_name: 'Student' } as any,
          plannedStatus: 'attending-extra',
          actualStatus: 'not-logged',
          rescheduledDate: '',
          invoiceStatus: null,
          plannedAbsence: false,
          hasInvoiceItems: false,
        },
        {
          student: { id: 'student-normal', first_name: 'Normal', last_name: 'Student' } as any,
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
          staff: { id: 'staff-1', first_name: 'Staff', last_name: 'Member' } as any,
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
      onSendBookingConfirmation={jest.fn()}
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
          student: { id: 'student-extra', first_name: 'Extra', last_name: 'Student' } as any,
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
          student: { id: 'student-normal', first_name: 'Normal', last_name: 'Student' } as any,
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
    expect(screen.queryByText('Remove from session')).not.toBeInTheDocument();
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
});
