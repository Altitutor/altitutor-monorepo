import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStaffMinimalPaginated } from '../useStaffQuery';
import { staffApi } from '../../api/staff';

jest.mock('../../api/staff', () => ({
  staffApi: {
    listMinimal: jest.fn(),
  },
}));

jest.mock('@/shared/lib/supabase/auth', () => ({
  useAuthStore: (selector: (state: { user: null }) => unknown) => selector({ user: null }),
}));

const mockStaffApi = staffApi as jest.Mocked<typeof staffApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('useStaffMinimalPaginated', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStaffApi.listMinimal.mockResolvedValue({ staff: [], total: 0 });
  });

  it('forwards name, email and phone search fields to the staff list API', async () => {
    renderHook(
      () =>
        useStaffMinimalPaginated({
          search: 'john.doe@altitutor.test',
          searchFields: ['email'],
          page: 1,
          pageSize: 50,
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john.doe@altitutor.test',
          searchFields: ['email'],
        }),
      );
    });
  });
});
