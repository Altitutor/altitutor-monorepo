import { render, screen } from '@testing-library/react';
import { TodaySessionsCalendarView } from '../TodaySessionsCalendarView';

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

global.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

function at(hours: number, minutes: number): string {
  return new Date(2026, 8, 26, hours, minutes).toISOString();
}

jest.mock('../../hooks/useSessionsQuery', () => ({
  useSessionsWithDetails: () => ({
    data: {
      sessions: [
        { id: '12MATH', type: 'CLASS', start_at: at(9, 30), end_at: at(12, 30) },
        { id: '11PHYS-am', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
        { id: 'IB', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
        { id: '9SCIE', type: 'CLASS', start_at: at(9, 30), end_at: at(11, 0) },
        { id: '11BIOL', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
        { id: '9MATH', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
        { id: '11PHYS-pm', type: 'CLASS', start_at: at(11, 0), end_at: at(12, 30) },
      ],
      classesById: {},
      subjectsById: {},
      sessionStudents: {},
      sessionStaff: {},
    },
  }),
}));

jest.mock('../SessionsCard', () => ({
  SessionsCard: ({ session }: { session: { id: string } }) => <div>{session.id}</div>,
}));

function leftOf(id: string): string {
  const card = screen.getByText(id).parentElement;
  return card?.style.left ?? '';
}

describe('TodaySessionsCalendarView column packing', () => {
  it('stacks the 11:00 sessions under the 9:30 sessions on 26 Sep', () => {
    render(<TodaySessionsCalendarView date="2026-09-26" />);

    const morningColumns = new Set(['11PHYS-am', 'IB', '9SCIE'].map(leftOf));
    const afternoonColumns = new Set(['11BIOL', '9MATH', '11PHYS-pm'].map(leftOf));

    expect(afternoonColumns).toEqual(morningColumns);
    expect(morningColumns.has(leftOf('12MATH'))).toBe(false);
    expect(new Set([...morningColumns, leftOf('12MATH')]).size).toBe(4);
  });
});
