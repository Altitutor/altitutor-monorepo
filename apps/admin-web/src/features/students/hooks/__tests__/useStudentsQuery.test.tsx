/**
 * Tests for React Query hooks for students
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useStudents,
  useStudent,
  useStudentsMinimal,
  useStudentDetails,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  studentsKeys,
} from '../useStudentsQuery';
import { studentsApi } from '../../api/students';
import type { Tables } from '@altitutor/shared';

// Mock the API
jest.mock('../../api/students', () => ({
  studentsApi: {
    getAllStudents: jest.fn(),
    getStudent: jest.fn(),
    listMinimal: jest.fn(),
    getStudentDetails: jest.fn(),
    createStudent: jest.fn(),
    updateStudent: jest.fn(),
    deleteStudent: jest.fn(),
  },
}));

const mockStudentsApi = studentsApi as jest.Mocked<typeof studentsApi>;

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

describe('useStudents hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useStudents', () => {
    it('should fetch all students', async () => {
      const mockStudents = [
        { id: '1', first_name: 'John', last_name: 'Doe', status: 'ACTIVE' },
        { id: '2', first_name: 'Jane', last_name: 'Smith', status: 'ACTIVE' },
      ];
      mockStudentsApi.getAllStudents.mockResolvedValue(mockStudents as Tables<'students'>[]);

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockStudents);
      expect(mockStudentsApi.getAllStudents).toHaveBeenCalledTimes(1);
    });

    it('should handle error state', async () => {
      const error = new Error('Failed to fetch');
      mockStudentsApi.getAllStudents.mockRejectedValue(error);

      const { result } = renderHook(() => useStudents(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toEqual(error);
    });
  });

  describe('useStudent', () => {
    it('should fetch single student when id provided', async () => {
      const mockStudent = { id: '1', first_name: 'John', last_name: 'Doe' };
      mockStudentsApi.getStudent.mockResolvedValue(mockStudent as Tables<'students'>);

      const { result } = renderHook(() => useStudent('1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockStudent);
      expect(mockStudentsApi.getStudent).toHaveBeenCalledWith('1');
    });

    it('should not fetch when id is empty', () => {
      const { result } = renderHook(() => useStudent(''), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockStudentsApi.getStudent).not.toHaveBeenCalled();
    });
  });

  describe('useStudentsMinimal', () => {
    it('should fetch minimal student list with params', async () => {
      const mockResponse = {
        students: [{ id: '1', first_name: 'John', last_name: 'Doe' }],
        total: 1,
      };
      mockStudentsApi.listMinimal.mockResolvedValue(mockResponse as Awaited<ReturnType<typeof studentsApi.listMinimal>>);

      const params = {
        search: 'John',
        statuses: ['ACTIVE'] as Tables<'students'>['status'][],
        page: 1,
        pageSize: 50,
      };

      const { result } = renderHook(() => useStudentsMinimal(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockResponse);
      expect(mockStudentsApi.listMinimal).toHaveBeenCalled();
    });

    it('should calculate offset correctly for pagination', async () => {
      const mockResponse = { students: [], total: 0 };
      mockStudentsApi.listMinimal.mockResolvedValue(mockResponse as Awaited<ReturnType<typeof studentsApi.listMinimal>>);

      const params = {
        page: 3,
        pageSize: 20,
      };

      renderHook(() => useStudentsMinimal(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(mockStudentsApi.listMinimal).toHaveBeenCalled();
      });

      // offset should be (3 - 1) * 20 = 40
      const callArgs = mockStudentsApi.listMinimal.mock.calls[0][0];
      expect(callArgs.offset).toBe(40);
    });
  });

  describe('useStudentDetails', () => {
    it('should fetch student details when enabled', async () => {
      const mockDetails = {
        student: { id: '1', first_name: 'John' },
        subjects: [],
        classes: [],
      };
      mockStudentsApi.getStudentDetails.mockResolvedValue(mockDetails as unknown as Awaited<ReturnType<typeof studentsApi.getStudentDetails>>);

      const { result } = renderHook(() => useStudentDetails('1', true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toEqual(mockDetails);
      expect(mockStudentsApi.getStudentDetails).toHaveBeenCalledWith('1');
    });

    it('should not fetch when disabled', () => {
      renderHook(() => useStudentDetails('1', false), {
        wrapper: createWrapper(),
      });

      expect(mockStudentsApi.getStudentDetails).not.toHaveBeenCalled();
    });
  });

  describe('useCreateStudent', () => {
    it('should create student and invalidate queries', async () => {
      const newStudent = { first_name: 'John', last_name: 'Doe' };
      const createdStudent = { id: '1', ...newStudent };
      mockStudentsApi.createStudent.mockResolvedValue(createdStudent as Awaited<ReturnType<typeof studentsApi.createStudent>>);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useCreateStudent(), {
        wrapper,
      });

      result.current.mutate(newStudent as Parameters<typeof studentsApi.createStudent>[0]);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // React Query passes variables as first argument, context as second
      expect(mockStudentsApi.createStudent).toHaveBeenCalledWith(newStudent, expect.anything());
      expect(result.current.data).toEqual(createdStudent);
    });
  });

  describe('useUpdateStudent', () => {
    it('should update student and update cache', async () => {
      const updatedStudent = { id: '1', first_name: 'Jane', last_name: 'Doe' };
      mockStudentsApi.updateStudent.mockResolvedValue(updatedStudent as Awaited<ReturnType<typeof studentsApi.updateStudent>>);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useUpdateStudent(), {
        wrapper,
      });

      result.current.mutate({
        id: '1',
        data: { first_name: 'Jane' },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockStudentsApi.updateStudent).toHaveBeenCalledWith('1', { first_name: 'Jane' });
    });
  });

  describe('useDeleteStudent', () => {
    it('should delete student and remove from cache', async () => {
      mockStudentsApi.deleteStudent.mockResolvedValue(undefined);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      // Pre-populate cache
      queryClient.setQueryData(studentsKeys.detailFull('1'), { student: { id: '1' } });

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => useDeleteStudent(), {
        wrapper,
      });

      result.current.mutate('1');

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // React Query passes variables as first argument, context as second
      expect(mockStudentsApi.deleteStudent).toHaveBeenCalledWith('1', expect.anything());
      // Check that query was removed
      const query = queryClient.getQueryCache().find({ queryKey: studentsKeys.detailFull('1') });
      expect(query).toBeUndefined();
    });
  });

  describe('query keys', () => {
    it('should generate correct query keys', () => {
      expect(studentsKeys.all).toEqual(['students']);
      expect(studentsKeys.detail('123')).toEqual(['students', 'detail', '123']);
      expect(studentsKeys.byStatus('ACTIVE')).toEqual(['students', 'byStatus', 'ACTIVE']);
    });
  });
});
