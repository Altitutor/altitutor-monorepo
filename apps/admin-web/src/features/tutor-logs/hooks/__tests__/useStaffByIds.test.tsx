/**
 * Tests for useStaffByIds hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { useStaffByIds } from '../useStaffByIds';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

// Create a wrapper with QueryClient
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

describe('useStaffByIds', () => {
  let mockSupabase: SupabaseClient<Database>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn(),
    } as unknown as SupabaseClient<Database>;
    mockGetSupabaseClient.mockReturnValue(mockSupabase);
  });

  it('should fetch staff by IDs and return a map', async () => {
    const mockStaff = [
      { id: 'staff-1', first_name: 'John', last_name: 'Doe' },
      { id: 'staff-2', first_name: 'Jane', last_name: 'Smith' },
    ];

    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: mockStaff,
        error: null,
      }),
    };

    (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useStaffByIds(['staff-1', 'staff-2']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeDefined();
    expect(result.current.data?.['staff-1']).toEqual({ first_name: 'John', last_name: 'Doe' });
    expect(result.current.data?.['staff-2']).toEqual({ first_name: 'Jane', last_name: 'Smith' });
    expect(mockQuery.in).toHaveBeenCalledWith('id', ['staff-1', 'staff-2']);
  });

  it('should return empty object when staffIds is empty', () => {
    const { result } = renderHook(() => useStaffByIds([]), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('should handle error state', async () => {
    const error = new Error('Failed to fetch');
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: null,
        error,
      }),
    };

    (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

    const { result } = renderHook(() => useStaffByIds(['staff-1']), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('should sort staff IDs in query key for stable caching', async () => {
    const mockQuery = {
      select: jest.fn().mockReturnThis(),
      in: jest.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

    // Use the same QueryClient wrapper to test caching
    const wrapper = createWrapper();

    const { result: result1 } = renderHook(() => useStaffByIds(['staff-2', 'staff-1']), {
      wrapper,
    });

    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Clear the mock call count
    (mockSupabase.from as jest.Mock).mockClear();

    const { result: result2 } = renderHook(() => useStaffByIds(['staff-1', 'staff-2']), {
      wrapper,
    });

    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Both should use the same cached data since IDs are sorted in the query key
    // React Query should cache based on the sorted query key
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
