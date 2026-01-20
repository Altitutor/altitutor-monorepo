/**
 * Tests for useStaffSearch hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { useStaffSearch } from '../useStaffSearch';
import { staffApi } from '@/features/staff/api/staff';

// Mock staff API
jest.mock('@/features/staff/api/staff', () => ({
  staffApi: {
    listMinimal: jest.fn(),
  },
}));

const mockStaffApi = staffApi as jest.Mocked<typeof staffApi>;

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

describe('useStaffSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch staff when search query is provided', async () => {
    const mockStaff = [
      {
        id: 'staff-1',
        first_name: 'John',
        last_name: 'Doe',
        role: 'TUTOR',
        status: 'ACTIVE',
        email: 'john@example.com',
        phone_number: '1234567890',
      },
    ];

    mockStaffApi.listMinimal.mockResolvedValue({
      staff: mockStaff,
      total: 1,
    });

    const { result } = renderHook(() => useStaffSearch('John'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.staff).toHaveLength(1);
    expect(result.current.data?.staff[0].first_name).toBe('John');
    expect(mockStaffApi.listMinimal).toHaveBeenCalledWith({
      search: 'John',
      statuses: ['ACTIVE'],
      limit: 100,
      offset: 0,
      orderBy: 'last_name',
      ascending: true,
      excludeClassSearch: false,
    });
  });

  it('should not fetch when search query is empty', () => {
    const { result } = renderHook(() => useStaffSearch(''), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockStaffApi.listMinimal).not.toHaveBeenCalled();
  });

  it('should not fetch when search query is only whitespace', () => {
    const { result } = renderHook(() => useStaffSearch('   '), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(result.current.data).toBeUndefined();
    expect(mockStaffApi.listMinimal).not.toHaveBeenCalled();
  });

  it('should trim search query before fetching', async () => {
    mockStaffApi.listMinimal.mockResolvedValue({
      staff: [],
      total: 0,
    });

    const { result } = renderHook(() => useStaffSearch('  John  '), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'John',
      })
    );
  });

  it('should handle error state', async () => {
    const error = new Error('Failed to fetch');
    mockStaffApi.listMinimal.mockRejectedValue(error);

    const { result } = renderHook(() => useStaffSearch('John'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });

  it('should respect enabled option', () => {
    const { result } = renderHook(() => useStaffSearch('John', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.isFetching).toBe(false);
    expect(mockStaffApi.listMinimal).not.toHaveBeenCalled();
  });
});
