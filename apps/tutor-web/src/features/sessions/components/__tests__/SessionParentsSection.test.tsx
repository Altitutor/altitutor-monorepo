import React from 'react';
import { render, screen } from '@testing-library/react';
import { SessionParentsSection } from '../SessionParentsSection';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('@altitutor/ui', () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table>{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children }: { children: React.ReactNode }) => <td>{children}</td>,
}));

describe('SessionParentsSection', () => {
  it('lists linked parents and their tutor-log attendance', () => {
    render(
      <SessionParentsSection
        parentsData={[
          {
            parent: { id: 'p1', first_name: 'Pat', last_name: 'Parent' },
            attendanceStatus: 'attended',
          },
        ]}
      />
    );

    expect(screen.getByText('Parents (1)')).toBeInTheDocument();
    expect(screen.getByText('Pat Parent')).toBeInTheDocument();
    expect(screen.getByText('Attended')).toBeInTheDocument();
  });

  it('shows an empty state when no parents are linked', () => {
    render(<SessionParentsSection parentsData={[]} />);

    expect(screen.getByText('Parents (0)')).toBeInTheDocument();
    expect(screen.getByText('No parents linked')).toBeInTheDocument();
  });
});
