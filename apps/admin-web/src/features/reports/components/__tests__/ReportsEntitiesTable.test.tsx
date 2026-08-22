import { fireEvent, render, screen } from '@testing-library/react';
import { ReportsEntitiesTable } from '../ReportsEntitiesTable';

describe('ReportsEntitiesTable communications rows', () => {
  it('links every participant while keeping View scoped to the check-in session', () => {
    const onEntityClick = jest.fn();
    const onPersonClick = jest.fn();
    const session = {
      id: 'log-1',
      name: 'Weekly check-in',
      link: { kind: 'session' as const, sessionId: 'session-1' },
      meta: { sessionDate: '22 Aug 2026, 10:00 am' },
      people: {
        student: [
          { id: 'student-1', name: 'Alice Student', kind: 'student' as const },
          { id: 'student-2', name: 'Ben Student', kind: 'student' as const },
        ],
        staff: [
          { id: 'staff-1', name: 'Cara Staff', kind: 'staff' as const },
          { id: 'staff-2', name: 'Dev Staff', kind: 'staff' as const },
        ],
      },
    };

    render(
      <ReportsEntitiesTable
        entities={[session]}
        variant="studentCheckIns"
        onEntityClick={onEntityClick}
        onPersonClick={onPersonClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Alice Student' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dev Staff' }));
    expect(onPersonClick).toHaveBeenNthCalledWith(1, session.people.student[0]);
    expect(onPersonClick).toHaveBeenNthCalledWith(2, session.people.staff[1]);

    fireEvent.click(screen.getByRole('button', { name: /view/i }));
    expect(onEntityClick).toHaveBeenCalledWith(session);
  });

  it('shows every receiving and conducting staff member as a link', () => {
    const onPersonClick = jest.fn();
    render(
      <ReportsEntitiesTable
        entities={[
          {
            id: 'log-2',
            name: 'Staff check-in',
            link: { kind: 'session', sessionId: 'session-2' },
            meta: { sessionDate: '22 Aug 2026, 11:00 am' },
            people: {
              staff: [
                { id: 'receiver-1', name: 'First Receiver', kind: 'staff' },
                { id: 'receiver-2', name: 'Second Receiver', kind: 'staff' },
              ],
              conductingStaff: [
                { id: 'host-1', name: 'First Host', kind: 'staff' },
                { id: 'host-2', name: 'Second Host', kind: 'staff' },
              ],
            },
          },
        ]}
        variant="staffCheckIns"
        onEntityClick={jest.fn()}
        onPersonClick={onPersonClick}
      />
    );

    expect(screen.getByRole('columnheader', { name: 'Conducting staff' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Recorded by' })).not.toBeInTheDocument();
    for (const name of ['First Receiver', 'Second Receiver', 'First Host', 'Second Host']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });
});
