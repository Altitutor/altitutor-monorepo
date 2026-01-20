/**
 * Tests for useStudentSubjects hook
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentSubjects } from '../useStudentSubjects';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables } from '@altitutor/shared';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

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

describe('useStudentSubjects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch student subjects when studentId is provided', async () => {
    const mockSubjects: Tables<'subjects'>[] = [
      {
        id: '1',
        name: 'Mathematics',
        curriculum: 'SACE',
        discipline: 'MATHEMATICS',
        year_level: 10,
        color: null,
        level: null,
        long_name: null,
        short_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'English',
        curriculum: 'SACE',
        discipline: 'ENGLISH',
        year_level: 10,
        color: null,
        level: null,
        long_name: null,
        short_name: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          { subject_details: mockSubjects[0] },
          { subject_details: mockSubjects[1] },
        ],
        error: null,
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as any);

    const { result } = renderHook(() => useStudentSubjects('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockSubjects);
    expect(mockSelect).toHaveBeenCalledWith('subject_details:subjects(*)');
  });

    it('should return empty array when studentId is undefined', () => {
      const { result } = renderHook(() => useStudentSubjects(undefined), {
        wrapper: createWrapper(),
      });

      // Query should be disabled when studentId is undefined
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockGetSupabaseClient).not.toHaveBeenCalled();
    });

  it('should not fetch when enabled is false', () => {
    renderHook(() => useStudentSubjects('student-1', false), {
      wrapper: createWrapper(),
    });

    expect(mockGetSupabaseClient).not.toHaveBeenCalled();
  });

  it('should handle error state', async () => {
    const error = new Error('Failed to fetch');
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: null,
        error,
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as any);

    const { result } = renderHook(() => useStudentSubjects('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toEqual(error);
  });

  it('should filter out null subject_details', async () => {
    const mockSelect = jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({
        data: [
          { subject_details: { id: '1', name: 'Math' } },
          { subject_details: null },
          { subject_details: { id: '2', name: 'English' } },
        ],
        error: null,
      }),
    });

    mockGetSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: mockSelect,
      }),
    } as any);

    const { result } = renderHook(() => useStudentSubjects('student-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].name).toBe('Math');
    expect(result.current.data?.[1].name).toBe('English');
  });
});
