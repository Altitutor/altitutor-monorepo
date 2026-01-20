import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentSubjectsForIds } from '../useStudentSubjectsForIds';
import { studentsApi } from '../../api/students';
import type { Tables } from '@altitutor/shared';

jest.mock('../../api/students');

const mockStudentsApi = studentsApi as jest.Mocked<typeof studentsApi>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
  Wrapper.displayName = 'QueryClientWrapper';
  return Wrapper;
};

describe('useStudentSubjectsForIds', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch student subjects for given IDs', async () => {
    const studentIds = ['student-1', 'student-2'];
    const mockData = {
      studentSubjects: {
        'student-1': [{ id: 'subject-1', name: 'Math' }] as Tables<'subjects'>[],
        'student-2': [{ id: 'subject-2', name: 'English' }] as Tables<'subjects'>[],
      },
      studentClasses: {},
      classSubjects: {},
    };

    mockStudentsApi.getDetailsForStudentIds.mockResolvedValue(mockData);

    const { result } = renderHook(
      () => useStudentSubjectsForIds(studentIds),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockStudentsApi.getDetailsForStudentIds).toHaveBeenCalledWith(studentIds);
    expect(result.current.data).toEqual(mockData.studentSubjects);
  });

  it('should not fetch when studentIds array is empty', () => {
    const { result } = renderHook(
      () => useStudentSubjectsForIds([]),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockStudentsApi.getDetailsForStudentIds).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', () => {
    const studentIds = ['student-1'];
    
    const { result } = renderHook(
      () => useStudentSubjectsForIds(studentIds, false),
      { wrapper: createWrapper() }
    );

    expect(result.current.isFetching).toBe(false);
    expect(mockStudentsApi.getDetailsForStudentIds).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const studentIds = ['student-1'];
    const error = new Error('Failed to fetch');

    mockStudentsApi.getDetailsForStudentIds.mockRejectedValue(error);

    const { result } = renderHook(
      () => useStudentSubjectsForIds(studentIds),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBe(error);
  });

  it('should sort student IDs for consistent query keys', async () => {
    const studentIds = ['student-2', 'student-1'];
    const mockData = {
      studentSubjects: {},
      studentClasses: {},
      classSubjects: {},
    };

    mockStudentsApi.getDetailsForStudentIds.mockResolvedValue(mockData);

    renderHook(
      () => useStudentSubjectsForIds(studentIds),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(mockStudentsApi.getDetailsForStudentIds).toHaveBeenCalled();
    });

    // Should be called with sorted IDs for consistent caching
    expect(mockStudentsApi.getDetailsForStudentIds).toHaveBeenCalledWith(['student-2', 'student-1']);
  });
});
