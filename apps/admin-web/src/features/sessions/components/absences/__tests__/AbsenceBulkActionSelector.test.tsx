import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RescheduleSession, StudentSession } from '../../../types/absence';
import { AbsenceBulkActionSelector } from '../AbsenceBulkActionSelector';

const mockReplacementSession = {
  id: 'replacement-session',
  start_at: '2026-09-10T09:00:00.000Z',
  end_at: '2026-09-10T10:00:00.000Z',
  class_id: 'replacement-class',
  type: 'GROUP_SESSION',
  billing_type: 'GROUP',
  status: 'ACTIVE',
  subject_id: 'subject-1',
  short_name: 'Replacement',
  long_name: 'Replacement session',
  created_at: null,
  updated_at: null,
} as RescheduleSession;

jest.mock('../../../hooks', () => ({
  useAvailableRescheduleSessions: () => ({
    data: [mockReplacementSession],
    isLoading: false,
  }),
}));

jest.mock('../../SessionsCard', () => ({
  SessionsCard: ({ session }: { session: { id: string } }) => <div>Session {session.id}</div>,
}));

jest.mock('../../WeekViewCalendar', () => ({
  WeekViewCalendar: ({
    sessions,
    onToggleSession,
  }: {
    sessions: Array<{ id: string }>;
    onToggleSession: (id: string) => void;
  }) => <button onClick={() => onToggleSession(sessions[0].id)}>Choose replacement</button>,
}));

const sessions = [
  {
    ...mockReplacementSession,
    id: 'original-session-1',
    class_id: 'original-class-1',
    sessionsStudentsId: 'assignment-1',
  },
  {
    ...mockReplacementSession,
    id: 'original-session-2',
    class_id: 'original-class-2',
    sessionsStudentsId: 'assignment-2',
  },
] as StudentSession[];

describe('AbsenceBulkActionSelector', () => {
  it('supports reschedule and credit decisions in the same absence batch', async () => {
    const onDecisionsChange = jest.fn();

    render(
      <AbsenceBulkActionSelector
        sessions={sessions}
        studentId="student-1"
        onDecisionsChange={onDecisionsChange}
        onBack={jest.fn()}
        onConfirm={jest.fn()}
        canProceed={false}
      />,
    );

    const rescheduleOptions = screen.getAllByLabelText('Reschedule');
    const creditOptions = screen.getAllByLabelText('Credit');

    fireEvent.click(rescheduleOptions[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Choose replacement' }));
    fireEvent.click(creditOptions[1]);

    await waitFor(() => {
      expect(onDecisionsChange).toHaveBeenLastCalledWith([
        {
          sessionId: 'original-session-1',
          action: 'reschedule',
          targetSessionId: 'replacement-session',
          targetSession: mockReplacementSession,
        },
        {
          sessionId: 'original-session-2',
          action: 'credit',
          targetSessionId: undefined,
          targetSession: undefined,
        },
      ]);
    });
  });
});
