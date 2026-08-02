import { render, screen, within } from '@testing-library/react';
import { OnlineStudentsTable } from '../OnlineStudentsTable';
import { useOnlineStudentsMinimal } from '../../hooks/useStudentsQuery';

jest.mock('../../hooks/useStudentsQuery', () => ({
  useOnlineStudentsMinimal: jest.fn(),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockedUseOnlineStudentsMinimal = jest.mocked(useOnlineStudentsMinimal);

describe('OnlineStudentsTable', () => {
  it('renders one Student row with every online product relationship', () => {
    mockedUseOnlineStudentsMinimal.mockReturnValue({
      data: {
        students: [
          {
            id: 'student-1',
            first_name: 'Dual',
            last_name: 'Student',
            email: 'dual@student.test',
            phone: '+61400000000',
            school: null,
            curriculum: null,
            year_level: null,
            in_person_status: 'ACTIVE',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
            online_since: '2026-01-02T00:00:00Z',
            entitlement: 'PAID',
            subscription_status: 'active',
            products: [
              {
                product: 'UCAT_WEB',
                started_at: '2026-01-02T00:00:00Z',
                closed_at: null,
              },
              {
                product: 'STUDENT_WEB',
                started_at: '2026-01-03T00:00:00Z',
                closed_at: null,
              },
            ],
          },
        ],
        total: 1,
      },
      isLoading: false,
      isFetching: false,
      error: null,
    } as ReturnType<typeof useOnlineStudentsMinimal>);

    render(<OnlineStudentsTable />);

    expect(screen.getAllByText('Dual Student')).toHaveLength(1);
    const studentRow = screen.getByText('Dual Student').closest('tr');
    expect(studentRow).not.toBeNull();
    expect(within(studentRow!).getByText('UCATWeb')).toBeInTheDocument();
    expect(within(studentRow!).getByText('StudentWeb')).toBeInTheDocument();
    expect(within(studentRow!).getByText('Paid')).toBeInTheDocument();
  });
});
