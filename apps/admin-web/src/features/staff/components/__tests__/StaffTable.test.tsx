import { screen } from '@testing-library/react';
import { StaffTable } from '../StaffTable';
import { useStaffMinimalPaginated, useCurrentStaff } from '../../hooks/useStaffQuery';
import { renderWithProviders } from '@/shared/test-utils';

jest.mock('../../hooks/useStaffQuery', () => ({
  useStaffMinimalPaginated: jest.fn(),
  useCurrentStaff: jest.fn(),
}));

jest.mock('@/features/quick-filters/hooks/useQuickFilters', () => ({
  useQuickFilters: () => ({ data: [] }),
}));

jest.mock('@/features/subjects', () => ({
  useSubjects: () => ({ data: [] }),
}));

jest.mock('@/shared/contexts/QuickActionsContext', () => ({
  useQuickActions: () => ({ openCheckInModal: jest.fn() }),
}));

jest.mock('@/shared/components/ActionsMenu', () => ({
  ActionsMenu: () => null,
}));

jest.mock('../AddStaffModal', () => ({
  AddStaffModal: () => null,
}));

jest.mock('../modal', () => ({
  ViewStaffModal: () => null,
}));

jest.mock('@/features/classes', () => ({
  ViewClassModal: () => null,
}));

jest.mock('@/features/sessions/components', () => ({
  LogStaffAbsenceDialog: () => null,
}));

jest.mock('../modal/SendInviteDialog', () => ({
  SendInviteDialog: () => null,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/staff',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedUseStaffMinimalPaginated = jest.mocked(useStaffMinimalPaginated);
const mockedUseCurrentStaff = jest.mocked(useCurrentStaff);

const staffMember = {
  id: 'staff-1',
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@altitutor.test',
  phone_number: '+61400000010',
  role: 'TUTOR',
  status: 'ACTIVE',
  classes: [],
  subjects: [],
};

describe('StaffTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseCurrentStaff.mockReturnValue({
      data: { id: 'current-staff' },
    } as unknown as ReturnType<typeof useCurrentStaff>);
    mockedUseStaffMinimalPaginated.mockReturnValue({
      data: { staff: [staffMember], total: 1 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useStaffMinimalPaginated>);
  });

  it('shows a Staff member column with name, email and phone', () => {
    renderWithProviders(<StaffTable />);

    expect(screen.getByRole('columnheader', { name: /staff member/i })).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john.doe@altitutor.test · +61400000010')).toBeInTheDocument();
  });

  it('searches name, email or phone by default', () => {
    renderWithProviders(<StaffTable />);

    expect(screen.getByPlaceholderText('Search name, email or phone...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all fields/i })).toBeInTheDocument();
    expect(mockedUseStaffMinimalPaginated).toHaveBeenCalledWith(
      expect.objectContaining({
        searchFields: ['name', 'email', 'phone'],
      }),
    );
  });
});
