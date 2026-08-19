import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { PropsWithChildren } from 'react';

import { useAuthStore } from '@/shared/lib/supabase/auth';
import { staffApi } from '../../api/staff';
import { useCurrentStaff } from '../useStaffQuery';

jest.mock('../../api/staff', () => ({
  staffApi: {
    getByUserId: jest.fn(),
  },
}));

const mockGetByUserId = jest.mocked(staffApi.getByUserId);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useCurrentStaff', () => {
  afterEach(() => {
    useAuthStore.setState({ user: null, loading: true });
    jest.clearAllMocks();
  });

  it('refetches the staff record when the authenticated identity changes', async () => {
    mockGetByUserId.mockImplementation(async (userId) => ({
      id: `staff-for-${userId}`,
      user_id: userId,
    }) as never);
    useAuthStore.setState({
      user: { id: 'user-a' } as never,
      loading: false,
    });

    const { result } = renderHook(() => useCurrentStaff(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.data?.id).toBe('staff-for-user-a');
    });

    useAuthStore.setState({ user: { id: 'user-b' } as never });

    await waitFor(() => {
      expect(result.current.data?.id).toBe('staff-for-user-b');
    });
    expect(mockGetByUserId).toHaveBeenNthCalledWith(1, 'user-a');
    expect(mockGetByUserId).toHaveBeenNthCalledWith(2, 'user-b');
  });
});
