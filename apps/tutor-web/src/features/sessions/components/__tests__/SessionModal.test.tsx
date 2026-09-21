import React from 'react';
import { render, screen } from '@testing-library/react';
import { SessionModal } from '../SessionModal';
import type { UseSessionModalDataReturn } from '../../hooks/useSessionModalData';
import type { FlattenedSessionDetail } from '../../utils/session-helpers';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockUseSessionModalData = jest.fn();

jest.mock('../../hooks/useSessionModalData', () => ({
  useSessionModalData: (...args: unknown[]) => mockUseSessionModalData(...args),
}));

jest.mock('../../hooks/useSessionNotes', () => ({
  useSessionNotes: () => ({ data: [] }),
}));

jest.mock('../SessionNotes', () => ({
  SessionNotes: () => null,
}));

jest.mock('@altitutor/ui', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div>{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  SheetDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  AccountClassBadge: () => null,
  Button: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  SessionInfoGrid: () => <div>session-info</div>,
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

function checkInSession(): FlattenedSessionDetail {
  return {
    session_id: 'session-1',
    session_type: 'CHECK_IN',
    class_id: null,
    subject_id: null,
    start_at: '2026-09-20T01:00:00.000Z',
    end_at: '2026-09-20T01:30:00.000Z',
    day_of_week: null,
    start_time: null,
    end_time: null,
    room: null,
    class_level: null,
    class_status: null,
    subject_name: null,
    subject_curriculum: null,
    subject_discipline: null,
    subject_level: null,
    subject_color: null,
    subject_year_level: null,
    subject_short_name: null,
    subject_long_name: null,
    students: [],
    staff: [],
    parents: [{ id: 'p1', first_name: 'Pat', last_name: 'Parent' }],
  };
}

function modalData(overrides: Partial<UseSessionModalDataReturn> = {}): UseSessionModalDataReturn {
  return {
    session: checkInSession(),
    tutorLog: null,
    allTopics: [],
    studentsData: [],
    staffData: [],
    parentsData: [
      {
        parent: { id: 'p1', first_name: 'Pat', last_name: 'Parent' },
        attendanceStatus: 'not-logged',
      },
    ],
    subject: null,
    isLoading: false,
    refresh: jest.fn(),
    ...overrides,
  };
}

describe('SessionModal parents', () => {
  beforeEach(() => {
    mockUseSessionModalData.mockReset();
  });

  it('shows a parents section on check-in sessions', () => {
    mockUseSessionModalData.mockReturnValue(modalData());

    render(<SessionModal isOpen sessionId="session-1" onClose={jest.fn()} />);

    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.getByText('Pat Parent')).toBeInTheDocument();
  });

  it('does not show a parents section on class sessions', () => {
    mockUseSessionModalData.mockReturnValue(
      modalData({
        session: { ...checkInSession(), session_type: 'CLASS' },
      })
    );

    render(<SessionModal isOpen sessionId="session-1" onClose={jest.fn()} />);

    expect(screen.queryByText('Parents (1)')).not.toBeInTheDocument();
    expect(screen.queryByText('Pat Parent')).not.toBeInTheDocument();
  });
});
