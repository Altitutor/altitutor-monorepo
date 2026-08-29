import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ParentsTable } from '../ParentsTable';
import { useParentsList, useDeleteParent } from '../../hooks/useParentsQuery';
import { renderWithProviders } from '@/shared/test-utils';

jest.mock('../../hooks/useParentsQuery', () => ({
  useParentsList: jest.fn(),
  useDeleteParent: jest.fn(),
}));

jest.mock('@/features/quick-filters/hooks/useQuickFilters', () => ({
  useQuickFilters: () => ({ data: [] }),
}));

jest.mock('@/shared/hooks', () => ({
  useCurrentStaff: () => ({ data: { id: 'staff-1' } }),
}));

jest.mock('@/shared/contexts/QuickActionsContext', () => ({
  useQuickActions: () => ({ openCheckInModal: jest.fn() }),
}));

jest.mock('@/features/students/components/ViewParentModal', () => ({
  ViewParentModal: () => null,
}));

jest.mock('@/shared/components/ActionsMenu', () => ({
  ActionsMenu: () => null,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => '/parents',
  useSearchParams: () => new URLSearchParams(),
}));

const mockedUseParentsList = jest.mocked(useParentsList);
const mockedUseDeleteParent = jest.mocked(useDeleteParent);

const parent = {
  id: 'parent-1',
  first_name: 'Robert',
  last_name: 'Williams',
  email: 'robert.williams@parent.test',
  phone: '+61420000001',
  students: [],
};

describe('ParentsTable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseDeleteParent.mockReturnValue({
      mutateAsync: jest.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useDeleteParent>);
    mockedUseParentsList.mockReturnValue({
      data: { parents: [parent], total: 150 },
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: jest.fn(),
    } as unknown as ReturnType<typeof useParentsList>);
  });

  it('shows a Parent column with name, email and phone', () => {
    renderWithProviders(<ParentsTable />);

    expect(screen.getByRole('columnheader', { name: /parent/i })).toBeInTheDocument();
    expect(screen.getByText('Robert Williams')).toBeInTheDocument();
    expect(screen.getByText('robert.williams@parent.test · +61420000001')).toBeInTheDocument();
  });

  it('searches name, email or phone by default', () => {
    renderWithProviders(<ParentsTable />);

    expect(screen.getByPlaceholderText('Search name, email or phone...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /all fields/i })).toBeInTheDocument();
    expect(mockedUseParentsList).toHaveBeenCalledWith(
      expect.objectContaining({
        searchFields: ['name', 'email', 'phone'],
      }),
    );
  });

  it('keeps the selected page when a page number is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ParentsTable />);

    await user.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      expect(mockedUseParentsList).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 }),
      );
    });
  });
});
