/**
 * Tests for React Query hooks for tutor logs
 */

import React, { ReactNode } from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSessionForLogging } from '../useSessionForLogging';
import { useUnloggedSessionsForStaff } from '../useUnloggedSessionsForStaff';
import { useTopicsByIds } from '../useTopicsByIds';
import { useStudentsByIds } from '../useStudentsByIds';
import { useTopicsWithSubjects } from '../useTopicsWithSubjects';
import { useTopicFilesByTopicIds } from '../useTopicFilesByTopicIds';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
jest.mock('@/shared/lib/supabase/client', () => ({
  getSupabaseClient: jest.fn(),
}));

const mockGetSupabaseClient = getSupabaseClient as jest.MockedFunction<typeof getSupabaseClient>;

// Create a mock Supabase client
const createMockSupabaseClient = () => {
  const mockClient = {
    from: jest.fn(),
    rpc: jest.fn(),
  } as unknown as SupabaseClient<Database>;

  return mockClient;
};

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

describe('Tutor Logs Hooks', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockGetSupabaseClient.mockReturnValue(mockSupabase as ReturnType<typeof getSupabaseClient>);
  });

  describe('useSessionForLogging', () => {
    it('should fetch session data with class, subject, staff, and students', async () => {
      const mockSession = {
        id: 'session-1',
        class_id: 'class-1',
        start_at: '2024-01-01T10:00:00Z',
        class: {
          id: 'class-1',
          subject: {
            id: 'subject-1',
            name: 'Math',
          },
        },
      };

      const mockStaffData = [
        {
          staff: { id: 'staff-1', first_name: 'John', last_name: 'Doe' },
          planned_absence: false,
        },
      ];

      const mockStudentsData = [
        {
          id: 'ss-1',
          student: { id: 'student-1', first_name: 'Jane', last_name: 'Smith' },
          planned_absence: false,
          is_extra: false,
        },
      ];

      let callCount = 0;
      (mockSupabase.from as jest.Mock).mockImplementation((table: string) => {
        callCount++;
        if (callCount === 1) {
          // Session query
          const sessionQuery = {
            select: jest.fn(),
            eq: jest.fn(),
            single: jest.fn().mockResolvedValue({
              data: mockSession,
              error: null,
            }),
          };
          sessionQuery.select.mockReturnValue(sessionQuery);
          sessionQuery.eq.mockReturnValue(sessionQuery);
          return sessionQuery;
        } else if (callCount === 2) {
          // Staff query
          const staffQuery = {
            select: jest.fn(),
            eq: jest.fn().mockResolvedValue({
              data: mockStaffData,
              error: null,
            }),
          };
          staffQuery.select.mockReturnValue(staffQuery);
          return staffQuery;
        } else if (callCount === 3) {
          // Students query
          const studentsQuery = {
            select: jest.fn(),
            eq: jest.fn().mockResolvedValue({
              data: mockStudentsData,
              error: null,
            }),
          };
          studentsQuery.select.mockReturnValue(studentsQuery);
          return studentsQuery;
        } else if (table === 'classes_students') {
          // Classes students query (for enrollment check)
          const classesStudentsQuery = {
            select: jest.fn(),
            eq: jest.fn(),
            in: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
          classesStudentsQuery.select.mockReturnValue(classesStudentsQuery);
          classesStudentsQuery.eq.mockReturnValue(classesStudentsQuery);
          return classesStudentsQuery;
        } else {
          // Fallback
          const fallbackQuery = {
            select: jest.fn(),
            eq: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          };
          fallbackQuery.select.mockReturnValue(fallbackQuery);
          return fallbackQuery;
        }
      });

      const { result } = renderHook(() => useSessionForLogging('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.session?.id).toBe('session-1');
      expect(result.current.data?.classData?.id).toBe('class-1');
      expect(result.current.data?.subject?.name).toBe('Math');
      expect(result.current.data?.staff).toHaveLength(1);
      expect(result.current.data?.students).toHaveLength(1);
    });

    it('should not fetch when sessionId is null', () => {
      const { result } = renderHook(() => useSessionForLogging(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle session not found error', async () => {
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      });

      const { result } = renderHook(() => useSessionForLogging('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.session).toBeNull();
      expect(result.current.data?.staff).toEqual([]);
      expect(result.current.data?.students).toEqual([]);
    });

    it('should handle error state', async () => {
      const error = new Error('Failed to fetch');
      (mockSupabase.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error,
        }),
      });

      const { result } = renderHook(() => useSessionForLogging('session-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe('useUnloggedSessionsForStaff', () => {
    it('should fetch unlogged sessions for staff', async () => {
      const mockRpcResult = {
        sessions: [
          { id: 'session-1', start_at: '2024-01-01T10:00:00Z' },
          { id: 'session-2', start_at: '2024-01-02T10:00:00Z' },
        ],
        sessionStudents: { 'session-1': [], 'session-2': [] },
        sessionStaff: { 'session-1': [], 'session-2': [] },
        classesById: {},
        subjectsById: {},
        total: 2,
      };

      const mockExistingLogs = [
        { session_id: 'session-3' },
      ];

      // Mock RPC call
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      // Mock tutor_logs query
      const mockLogsQuery = {
        select: jest.fn().mockResolvedValue({
          data: mockExistingLogs,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockLogsQuery);

      const { result } = renderHook(() => useUnloggedSessionsForStaff('staff-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.sessions).toHaveLength(2);
      expect(result.current.data?.sessions[0].id).toBe('session-1');
      expect(mockSupabase.rpc).toHaveBeenCalled();
    });

    it('should filter out sessions with existing tutor logs', async () => {
      const mockRpcResult = {
        sessions: [
          { id: 'session-1', start_at: '2024-01-01T10:00:00Z' },
          { id: 'session-2', start_at: '2024-01-02T10:00:00Z' },
        ],
        sessionStudents: {},
        sessionStaff: {},
        classesById: {},
        subjectsById: {},
        total: 2,
      };

      const mockExistingLogs = [
        { session_id: 'session-1' },
      ];

      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcResult,
        error: null,
      });

      const mockLogsQuery = {
        select: jest.fn().mockResolvedValue({
          data: mockExistingLogs,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockLogsQuery);

      const { result } = renderHook(() => useUnloggedSessionsForStaff('staff-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      // Should filter out session-1 since it has a log
      expect(result.current.data?.sessions).toHaveLength(1);
      expect(result.current.data?.sessions[0].id).toBe('session-2');
    });

    it('should not fetch when staffId is null', () => {
      const { result } = renderHook(() => useUnloggedSessionsForStaff(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
    });

    it('should handle RPC error', async () => {
      const error = new Error('RPC failed');
      (mockSupabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error,
      });

      const { result } = renderHook(() => useUnloggedSessionsForStaff('staff-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe('useTopicsByIds', () => {
    it('should fetch topics by IDs', async () => {
      const mockTopics = [
        { id: 'topic-1', name: 'Algebra', subject_id: 'subject-1' },
        { id: 'topic-2', name: 'Geometry', subject_id: 'subject-1' },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockTopics,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useTopicsByIds(['topic-1', 'topic-2']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe('topic-1');
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['topic-1', 'topic-2']);
    });

    it('should not fetch when topicIds is empty', () => {
      const { result } = renderHook(() => useTopicsByIds([]), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
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

      const { result } = renderHook(() => useTopicsByIds(['topic-1']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe('useStudentsByIds', () => {
    it('should fetch students by IDs', async () => {
      const mockStudents = [
        { id: 'student-1', first_name: 'John', last_name: 'Doe' },
        { id: 'student-2', first_name: 'Jane', last_name: 'Smith' },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockStudents,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useStudentsByIds(['student-1', 'student-2']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe('student-1');
      expect(mockQuery.in).toHaveBeenCalledWith('id', ['student-1', 'student-2']);
    });

    it('should not fetch when studentIds is empty', () => {
      const { result } = renderHook(() => useStudentsByIds([]), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
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

      const { result } = renderHook(() => useStudentsByIds(['student-1']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toBeDefined();
    });
  });

  describe('useTopicsWithSubjects', () => {
    it('should fetch topics with subjects and return map', async () => {
      const mockTopics = [
        {
          id: 'topic-1',
          subject_id: 'subject-1',
          subjects: { id: 'subject-1', name: 'Math' },
        },
        {
          id: 'topic-2',
          subject_id: 'subject-1',
          subjects: { id: 'subject-1', name: 'Math' },
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockTopics,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useTopicsWithSubjects(['topic-1', 'topic-2']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data).toBeInstanceOf(Map);
      expect(result.current.data?.get('subject-1')?.name).toBe('Math');
    });

    it('should not fetch when topicIds is empty', () => {
      const { result } = renderHook(() => useTopicsWithSubjects([]), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle topics without subjects', async () => {
      const mockTopics = [
        {
          id: 'topic-1',
          subject_id: null,
          subjects: null,
        },
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: mockTopics,
          error: null,
        }),
      };

      (mockSupabase.from as jest.Mock).mockReturnValue(mockQuery);

      const { result } = renderHook(() => useTopicsWithSubjects(['topic-1']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.size).toBe(0);
    });
  });

  describe('useTopicFilesByTopicIds', () => {
    it('should fetch topic files for multiple topics', async () => {
      const mockFiles1 = [
        {
          id: 'tf-1',
          topic_id: 'topic-1',
          file: { id: 'file-1', filename: 'notes.pdf' },
        },
      ];

      const mockFiles2 = [
        {
          id: 'tf-2',
          topic_id: 'topic-2',
          file: { id: 'file-2', filename: 'worksheet.pdf' },
        },
      ];

      // Setup mock to return different queries for each call
      let callCount = 0;
      (mockSupabase.from as jest.Mock).mockImplementation(() => {
        callCount++;
        let orderCallCount = 0;
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockImplementation((_column: string) => {
            orderCallCount++;
            // First order() call returns this for chaining, second returns the promise
            if (orderCallCount === 1) {
              return query;
            } else {
              // Second order() call returns the promise
              if (callCount === 1) {
                return Promise.resolve({
                  data: mockFiles1,
                  error: null,
                });
              } else {
                return Promise.resolve({
                  data: mockFiles2,
                  error: null,
                });
              }
            }
          }),
        };
        return query;
      });

      const { result } = renderHook(() => useTopicFilesByTopicIds(['topic-1', 'topic-2']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 3000 });

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.['topic-1']).toBeDefined();
      expect(result.current.data?.['topic-2']).toBeDefined();
    });

    it('should not fetch when topicIds is empty', () => {
      const { result } = renderHook(() => useTopicFilesByTopicIds([]), {
        wrapper: createWrapper(),
      });

      expect(result.current.isFetching).toBe(false);
      expect(result.current.data).toBeUndefined(); // React Query doesn't run queryFn when enabled: false
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully and continue with other topics', async () => {
      // Mock first topic to succeed, second to fail
      let callCount = 0;
      (mockSupabase.from as jest.Mock).mockImplementation(() => {
        callCount++;
        let orderCallCount = 0;
        const query = {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockImplementation((_column: string) => {
            orderCallCount++;
            // First order() call returns this for chaining, second returns the promise
            if (orderCallCount === 1) {
              return query;
            } else {
              // Second order() call returns the promise
              if (callCount === 1) {
                return Promise.resolve({
                  data: [{ id: 'tf-1', topic_id: 'topic-1', file: { id: 'file-1' } }],
                  error: null,
                });
              } else {
                // Return error for second topic
                return Promise.resolve({
                  data: null,
                  error: { code: 'ERROR', message: 'Failed' },
                });
              }
            }
          }),
        };
        return query;
      });

      const { result } = renderHook(() => useTopicFilesByTopicIds(['topic-1', 'topic-2']), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        // Hook should succeed even if one topic fails (errors are logged but don't throw)
        expect(result.current.isSuccess).toBe(true);
      }, { timeout: 5000 });

      // Should still have data for topic-1 even though topic-2 failed
      expect(result.current.data?.['topic-1']).toBeDefined();
      // topic-2 should not be in the map since it failed
      expect(result.current.data?.['topic-2']).toBeUndefined();
    });
  });
});
