/**
 * Tests for useStaffSearch hook
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStaffSearch } from '../useStaffSearch';
import { staffApi } from '@/features/staff/api/staff';

// Mock the staff API
jest.mock('@/features/staff/api/staff', () => ({
  staffApi: {
    listMinimal: jest.fn(),
  },
}));

const mockStaffApi = staffApi as jest.Mocked<typeof staffApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
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

  it('should fetch staff with default options', async () => {
    const mockStaff = [
      {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        role: 'TUTOR',
        status: 'ACTIVE',
        email: 'john@example.com',
        phone_number: '1234567890',
      },
      {
        id: '2',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'TUTOR',
        status: 'ACTIVE',
        email: 'jane@example.com',
        phone_number: '0987654321',
      },
    ];

    mockStaffApi.listMinimal.mockResolvedValue({
      staff: mockStaff,
      total: 2,
    } as any);

    const { result } = renderHook(() => useStaffSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.staff).toHaveLength(2);
    expect(result.current.data?.total).toBe(2);
    expect(mockStaffApi.listMinimal).toHaveBeenCalledWith({
      search: 'john',
      statuses: ['ACTIVE'],
      limit: 100,
      offset: 0,
      orderBy: 'last_name',
      ascending: true,
      excludeClassSearch: false,
    });
  });

  it('should trim search query', async () => {
    mockStaffApi.listMinimal.mockResolvedValue({
      staff: [],
      total: 0,
    } as any);

    renderHook(() => useStaffSearch('  john  '), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'john',
        })
      );
    });
  });

  it('should use empty search when query is empty', async () => {
    mockStaffApi.listMinimal.mockResolvedValue({
      staff: [],
      total: 0,
    } as any);

    renderHook(() => useStaffSearch(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
        expect.objectContaining({
          search: undefined,
        })
      );
    });
  });

  it('should use custom statuses', async () => {
    mockStaffApi.listMinimal.mockResolvedValue({
      staff: [],
      total: 0,
    } as any);

    renderHook(() => useStaffSearch('john', { statuses: ['ACTIVE', 'INACTIVE'] }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: ['ACTIVE', 'INACTIVE'],
        })
      );
    });
  });

  it('should use custom limit', async () => {
    mockStaffApi.listMinimal.mockResolvedValue({
      staff: [],
      total: 0,
    } as any);

    renderHook(() => useStaffSearch('john', { limit: 50 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockStaffApi.listMinimal).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
        })
      );
    });
  });

  it('should not fetch when enabled is false', () => {
    renderHook(() => useStaffSearch('john', { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(mockStaffApi.listMinimal).not.toHaveBeenCalled();
  });

  it('should handle error state', async () => {
    const error = new Error('Failed to fetch');
    mockStaffApi.listMinimal.mockRejectedValue(error);

    const { result } = renderHook(() => useStaffSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
  });

  it('should transform staff data correctly', async () => {
    const mockStaff = [
      {
        id: '1',
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
    } as any);

    const { result } = renderHook(() => useStaffSearch('john'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.staff[0]).toMatchObject({
      id: '1',
      first_name: 'John',
      last_name: 'Doe',
      role: 'TUTOR',
      status: 'ACTIVE',
      email: 'john@example.com',
      phone_number: '1234567890',
      created_at: null,
      updated_at: null,
    });
  });
});
