/**
 * Tests for useTopicUpdate hook
 * Tests the business logic for topic update orchestration
 * 
 * Note: Full integration tests would require React Query setup.
 * These tests focus on verifying the hook structure and basic functionality.
 */

import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import React, { type ReactNode } from 'react';
import type { Tables, Enums } from '@altitutor/shared';
import * as topicsFilesApiModule from '../../api/topics-files';
import * as useTopicsQueryModule from '../useTopicsQuery';

// Mock the hooks and API before importing the hook
const mockToast = jest.fn();

// Helper to create mock mutation results that satisfy UseMutationResult interface
// Using Partial to allow flexibility while maintaining type safety
const createMockMutationResult = <TData = unknown, TError = Error, TVariables = unknown, TContext = unknown>(
  overrides?: { isPending?: boolean }
): Partial<UseMutationResult<TData, TError, TVariables, TContext>> & Pick<UseMutationResult<TData, TError, TVariables, TContext>, 'mutate' | 'isPending'> => {
  const statusValue: 'idle' | 'pending' | 'error' | 'success' = overrides?.isPending ? 'pending' : 'idle';
  const mockResult = {
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isPending: overrides?.isPending ?? false,
    isError: false,
    isSuccess: false,
    data: undefined as TData | undefined,
    error: null as TError | null,
    variables: undefined as TVariables | undefined,
    reset: jest.fn(),
    status: statusValue,
    failureCount: 0,
    failureReason: null as TError | null,
    submittedAt: 0,
    context: undefined as TContext | undefined,
  };
  return mockResult as Partial<UseMutationResult<TData, TError, TVariables, TContext>> & Pick<UseMutationResult<TData, TError, TVariables, TContext>, 'mutate' | 'isPending'>;
};

// Create typed mock results
const createUpdateTopicMock = () => createMockMutationResult<Tables<'topics'>, Error, { id: string; data: Tables<'topics'> }, unknown>();
const createUpdateTopicIndicesMock = () => createMockMutationResult<void, Error, Array<{ id: string; index: number }>, unknown>();
const createUpdateTopicFileMock = () => createMockMutationResult<Tables<'topics_files'>, Error, { id: string; data: Tables<'topics_files'> }, unknown>();
const createUpdateTopicFileIndicesMock = () => createMockMutationResult<void, Error, Array<{ id: string; index: number }>, unknown>();

const mockMutations = {
  useUpdateTopic: jest.fn(() => createUpdateTopicMock()),
  useUpdateTopicIndices: jest.fn(() => createUpdateTopicIndicesMock()),
  useUpdateTopicFile: jest.fn(() => createUpdateTopicFileMock()),
  useUpdateTopicFileIndices: jest.fn(() => createUpdateTopicFileIndicesMock()),
};

jest.mock('../useTopicsQuery', () => ({
  useUpdateTopic: jest.fn(() => mockMutations.useUpdateTopic() as ReturnType<typeof useTopicsQueryModule.useUpdateTopic>),
  useUpdateTopicIndices: jest.fn(() => mockMutations.useUpdateTopicIndices() as ReturnType<typeof useTopicsQueryModule.useUpdateTopicIndices>),
}));

jest.mock('../useTopicsFilesQuery', () => ({
  useUpdateTopicFile: jest.fn(() => mockMutations.useUpdateTopicFile()),
  useUpdateTopicFileIndices: jest.fn(() => mockMutations.useUpdateTopicFileIndices()),
  topicsFilesKeys: {
    byTopic: (topicId: string) => ['topics-files', 'topic', topicId],
  },
}));

jest.mock('../../api/topics-files', () => ({
  topicsFilesApi: {
    getTopicFilesByTopic: jest.fn(() => Promise.resolve([])),
  },
}));

jest.mock('@altitutor/ui', () => ({
  useToast: jest.fn(() => ({
    toast: mockToast,
  })),
}));

import { useTopicUpdate } from '../useTopicUpdate';

describe('useTopicUpdate', () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => JSX.Element;

  const createMockTopic = (overrides?: Partial<Tables<'topics'>>): Tables<'topics'> => ({
    id: 'topic-1',
    name: 'Test Topic',
    subject_id: 'subject-1',
    parent_id: null,
    index: 1,
    code: 'T1',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    ...overrides,
  });

  const createMockTopicFile = (
    id: string,
    type: Enums<'resource_type'> = 'NOTES',
    isSolutions = false
  ): Tables<'topics_files'> & { file: Tables<'files'> } => ({
    id,
    topic_id: 'topic-1',
    file_id: `file-${id}`,
    type,
    index: 1,
    code: `CODE-${id}`,
    is_solutions: isSolutions,
    is_solutions_of_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    file: {
      id: `file-${id}`,
      filename: `file-${id}.pdf`,
      mimetype: 'application/pdf',
      size_bytes: 1000,
      storage_path: `path/to/file-${id}.pdf`,
      storage_provider: 'supabase',
      bucket: 'resources',
      metadata: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      deleted_at: null,
    },
  });

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    wrapper = ({ children }: { children: ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    jest.clearAllMocks();
    mockToast.mockClear();

    // Reset all mocks to default state
    const defaultMockResult = createUpdateTopicMock();
    defaultMockResult.mutate = jest.fn((variables, options) => {
      setTimeout(() => {
        if (options?.onSuccess) {
          const result: Tables<'topics'> = { ...variables.data, id: variables.id };
          const context = { rollback: jest.fn() };
          // onSuccess signature: (data, variables, onMutateResult, context)
          (options.onSuccess as unknown as (data: Tables<'topics'>, variables: { id: string; data: Tables<'topics'> }, onMutateResult: unknown, context: { rollback: () => void }) => void)(
            result, variables, undefined, context
          );
        }
      }, 0);
    }) as typeof defaultMockResult.mutate;
    mockMutations.useUpdateTopic.mockReturnValue(defaultMockResult);
    
    const defaultIndicesResult = createUpdateTopicIndicesMock();
    defaultIndicesResult.mutate = jest.fn((variables, options) => {
      setTimeout(() => {
        if (options?.onSuccess) {
          const context = { rollback: jest.fn() };
          (options.onSuccess as unknown as (data: void, variables: Array<{ id: string; index: number }>, onMutateResult: unknown, context: { rollback: () => void }) => void)(
            undefined, variables, undefined, context
          );
        }
      }, 0);
    }) as typeof defaultIndicesResult.mutate;
    mockMutations.useUpdateTopicIndices.mockReturnValue(defaultIndicesResult);
    
    const defaultFileResult = createUpdateTopicFileMock();
    defaultFileResult.mutate = jest.fn((variables, options) => {
      setTimeout(() => {
        if (options?.onSuccess) {
          const result: Tables<'topics_files'> = { ...variables.data, id: variables.id };
          const context = { rollback: jest.fn() };
          (options.onSuccess as unknown as (data: Tables<'topics_files'>, variables: { id: string; data: Tables<'topics_files'> }, onMutateResult: unknown, context: { rollback: () => void }) => void)(
            result, variables, undefined, context
          );
        }
      }, 0);
    }) as typeof defaultFileResult.mutate;
    mockMutations.useUpdateTopicFile.mockReturnValue(defaultFileResult);
    
    const defaultFileIndicesResult = createUpdateTopicFileIndicesMock();
    defaultFileIndicesResult.mutate = jest.fn((variables, options) => {
      setTimeout(() => {
        if (options?.onSuccess) {
          const context = { rollback: jest.fn() };
          (options.onSuccess as unknown as (data: void, variables: Array<{ id: string; index: number }>, onMutateResult: unknown, context: { rollback: () => void }) => void)(
            undefined, variables, undefined, context
          );
        }
      }, 0);
    }) as typeof defaultFileIndicesResult.mutate;
    mockMutations.useUpdateTopicFileIndices.mockReturnValue(defaultFileIndicesResult);
  });

  describe('hasTopicChanged logic', () => {
    it('should detect when topic name changes', async () => {
      const currentTopic = createMockTopic({ name: 'Old Name' });
      const formData = {
        name: 'New Name',
        subject_id: 'subject-1',
        parent_id: null,
      };

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData,
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Topic details');
    });

    it('should detect when subject_id changes', async () => {
      const currentTopic = createMockTopic({ subject_id: 'subject-1' });
      const formData = {
        name: 'Test Topic',
        subject_id: 'subject-2',
        parent_id: null,
      };

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData,
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Topic details');
    });

    it('should detect when parent_id changes', async () => {
      const currentTopic = createMockTopic({ parent_id: null });
      const formData = {
        name: 'Test Topic',
        subject_id: 'subject-1',
        parent_id: 'parent-1',
      };

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData,
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Topic details');
    });

    it('should not update when nothing changes', async () => {
      const currentTopic = createMockTopic();
      const formData = {
        name: currentTopic.name,
        subject_id: currentTopic.subject_id,
        parent_id: currentTopic.parent_id,
      };

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData,
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).not.toContain('Topic details');
    });
  });

  describe('reordering children', () => {
    it('should update children order when reordered', async () => {
      const currentTopic = createMockTopic();
      const reorderedChildren = [
        { id: 'child-1', index: 1 },
        { id: 'child-2', index: 2 },
      ];

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData: {
          name: currentTopic.name,
          subject_id: currentTopic.subject_id,
          parent_id: currentTopic.parent_id,
        },
        reorderedChildren,
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Topic order');
    });
  });

  describe('solution linking/unlinking', () => {
    it('should unlink solutions', async () => {
      const currentTopic = createMockTopic();
      const solutionUnlinks = ['solution-1', 'solution-2'];

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData: {
          name: currentTopic.name,
          subject_id: currentTopic.subject_id,
          parent_id: currentTopic.parent_id,
        },
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks,
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Solution links');
    });

    it('should link solutions', async () => {
      const currentTopic = createMockTopic();
      const topicFiles = [
        createMockTopicFile('file-1', 'NOTES'),
        createMockTopicFile('solution-1', 'NOTES', true),
      ];
      const solutionLinks = [
        { solutionFileId: 'solution-1', targetFileId: 'file-1' },
      ];

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData: {
          name: currentTopic.name,
          subject_id: currentTopic.subject_id,
          parent_id: currentTopic.parent_id,
        },
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks,
        solutionUnlinks: [],
        currentTopicFiles: topicFiles,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('Solution links');
    });
  });

  describe('file type updates', () => {
    it('should update file types when changed', async () => {
      const currentTopic = createMockTopic();
      const topicFiles = [
        createMockTopicFile('file-1', 'NOTES'),
        createMockTopicFile('solution-1', 'NOTES', true),
      ];
      const reorderedFiles = [
        { id: 'file-1', index: 1, type: 'PRACTICE_QUESTIONS' as Enums<'resource_type'> },
      ];

      jest.mocked(topicsFilesApiModule.topicsFilesApi.getTopicFilesByTopic).mockResolvedValue(topicFiles);

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData: {
          name: currentTopic.name,
          subject_id: currentTopic.subject_id,
          parent_id: currentTopic.parent_id,
        },
        reorderedChildren: [],
        reorderedFiles,
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: topicFiles,
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.changes).toContain('File types');
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      const currentTopic = createMockTopic();
      
      const errorMockResult = createUpdateTopicMock();
      errorMockResult.mutate = jest.fn((variables, options) => {
        // Simulate async error
        setTimeout(() => {
          if (options?.onError) {
            const error = new Error('Update failed');
            const context = { rollback: jest.fn() };
            // onError signature: (error, variables, onMutateResult, context)
            (options.onError as unknown as (error: Error, variables: { id: string; data: Tables<'topics'> }, onMutateResult: unknown, context: { rollback: () => void }) => void)(
              error, variables, undefined, context
            );
          }
        }, 0);
      }) as typeof errorMockResult.mutate;
      jest.mocked(useTopicsQueryModule.useUpdateTopic).mockReturnValue(errorMockResult as ReturnType<typeof useTopicsQueryModule.useUpdateTopic>);

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      const updateResult = await result.current.updateTopic({
        topicId: 'topic-1',
        currentTopic,
        formData: {
          name: 'New Name',
          subject_id: currentTopic.subject_id,
          parent_id: currentTopic.parent_id,
        },
        reorderedChildren: [],
        reorderedFiles: [],
        solutionLinks: [],
        solutionUnlinks: [],
        currentTopicFiles: [],
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.error).toBeDefined();
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });
  });

  describe('isPending state', () => {
    it('should return isPending true when any mutation is pending', () => {
      // Update mock before rendering hook
      const pendingMockResult = createUpdateTopicMock();
      pendingMockResult.isPending = true;
      pendingMockResult.status = 'pending' as const;
      jest.mocked(useTopicsQueryModule.useUpdateTopic).mockReturnValueOnce(pendingMockResult as ReturnType<typeof useTopicsQueryModule.useUpdateTopic>);

      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      expect(result.current.isPending).toBe(true);
    });

    it('should return isPending false when no mutations are pending', () => {
      // All mocks are reset to isPending: false in beforeEach
      const { result } = renderHook(() => useTopicUpdate(), { wrapper });

      expect(result.current.isPending).toBe(false);
    });
  });
});
