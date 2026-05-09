/**
 * Tests for useFileUploadFlow hook
 * Tests the complex file upload orchestration logic
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, type UseMutationResult } from '@tanstack/react-query';
import { useFileUploadFlow } from '../useFileUploadFlow';
import type { FileItem } from '../../utils/fileItemHelpers';
import type { Tables } from '@altitutor/shared';

// Mock the mutation hooks
jest.mock('../useFilesQuery');
jest.mock('../useTopicsFilesQuery');

import { useUploadFile } from '../useFilesQuery';
import { useCreateTopicFile } from '../useTopicsFilesQuery';

const mockUseUploadFile = useUploadFile as jest.MockedFunction<typeof useUploadFile>;
const mockUseCreateTopicFile = useCreateTopicFile as jest.MockedFunction<typeof useCreateTopicFile>;

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
  Wrapper.displayName = 'TestWrapper';
  return Wrapper;
};

describe('useFileUploadFlow', () => {
  let mockUploadMutation: jest.Mock;
  let mockCreateTopicFileMutation: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockUploadMutation = jest.fn();
    mockCreateTopicFileMutation = jest.fn();

    mockUseUploadFile.mockReturnValue({
      mutateAsync: mockUploadMutation,
      mutate: jest.fn(),
      reset: jest.fn(),
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isIdle: true,
      isPaused: false,
      isPending: false,
      isSuccess: false,
      status: 'idle',
      submittedAt: 0,
      variables: undefined,
    } as UseMutationResult<Tables<'files'>, Error, { subjectId: string; topicId: string; file: File }>);

    mockUseCreateTopicFile.mockReturnValue({
      mutateAsync: mockCreateTopicFileMutation,
      mutate: jest.fn(),
      reset: jest.fn(),
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isError: false,
      isIdle: true,
      isPaused: false,
      isPending: false,
      isSuccess: false,
      status: 'idle',
      submittedAt: 0,
      variables: undefined,
    } as unknown as ReturnType<typeof useCreateTopicFile>);
  });

  it('should handle single file upload', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file = new File([''], 'test.pdf');
    const fileItem: FileItem = {
      id: '1',
      file,
      index: 1,
      solutionOfId: null,
    };

    mockUploadMutation.mockResolvedValue({ id: 'file-1' });
    mockCreateTopicFileMutation.mockResolvedValue({ id: 'topic-file-1' });

    await result.current.uploadFiles({
      fileItems: [fileItem],
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
      isSolutions: false,
      solutionOfId: null,
    });

    await waitFor(() => {
      expect(mockUploadMutation).toHaveBeenCalledWith({
        subjectId: 'subject-1',
        topicId: 'topic-1',
        file,
      });
      expect(mockCreateTopicFileMutation).toHaveBeenCalledWith({
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-1',
        is_solutions: false,
        is_solutions_of_id: null,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle single file upload with solution', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file = new File([''], 'solution.pdf');
    const fileItem: FileItem = {
      id: '1',
      file,
      index: 1,
      solutionOfId: null,
    };

    mockUploadMutation.mockResolvedValue({ id: 'file-1' });
    mockCreateTopicFileMutation.mockResolvedValue({ id: 'topic-file-1' });

    await result.current.uploadFiles({
      fileItems: [fileItem],
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
      isSolutions: true,
      solutionOfId: 'parent-topic-file-1',
    });

    await waitFor(() => {
      expect(mockCreateTopicFileMutation).toHaveBeenCalledWith({
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-1',
        is_solutions: true,
        is_solutions_of_id: 'parent-topic-file-1',
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle multiple files upload - regular files only', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    const fileItems: FileItem[] = [
      { id: '1', file: file1, index: 1, solutionOfId: null },
      { id: '2', file: file2, index: 2, solutionOfId: null },
    ];

    mockUploadMutation
      .mockResolvedValueOnce({ id: 'file-1' })
      .mockResolvedValueOnce({ id: 'file-2' });
    mockCreateTopicFileMutation
      .mockResolvedValueOnce({ id: 'topic-file-1' })
      .mockResolvedValueOnce({ id: 'topic-file-2' });

    await result.current.uploadFiles({
      fileItems,
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
    });

    await waitFor(() => {
      expect(mockUploadMutation).toHaveBeenCalledTimes(2);
      expect(mockCreateTopicFileMutation).toHaveBeenCalledTimes(2);
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(1, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-1',
        is_solutions: false,
        is_solutions_of_id: null,
      });
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(2, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-2',
        is_solutions: false,
        is_solutions_of_id: null,
      });
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle multiple files upload with solution relationships', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file1 = new File([''], 'question.pdf');
    const file2 = new File([''], 'solution.pdf');
    const fileItems: FileItem[] = [
      { id: '1', file: file1, index: 1, solutionOfId: null },
      { id: '2', file: file2, index: 2, solutionOfId: '1' }, // solution for file1
    ];

    mockUploadMutation
      .mockResolvedValueOnce({ id: 'file-1' })
      .mockResolvedValueOnce({ id: 'file-2' });
    mockCreateTopicFileMutation
      .mockResolvedValueOnce({ id: 'topic-file-1' })
      .mockResolvedValueOnce({ id: 'topic-file-2' });

    await result.current.uploadFiles({
      fileItems,
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
    });

    await waitFor(() => {
      // Should upload both files first
      expect(mockUploadMutation).toHaveBeenCalledTimes(2);
      
      // Should create regular file first
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(1, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-1',
        is_solutions: false,
        is_solutions_of_id: null,
      });
      
      // Then create solution file with reference to regular file
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(2, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-2',
        is_solutions: true,
        is_solutions_of_id: 'topic-file-1',
      });
      
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should handle multiple solution files for same parent', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file1 = new File([''], 'question.pdf');
    const file2 = new File([''], 'solution1.pdf');
    const file3 = new File([''], 'solution2.pdf');
    const fileItems: FileItem[] = [
      { id: '1', file: file1, index: 1, solutionOfId: null },
      { id: '2', file: file2, index: 2, solutionOfId: '1' },
      { id: '3', file: file3, index: 3, solutionOfId: '1' },
    ];

    mockUploadMutation
      .mockResolvedValueOnce({ id: 'file-1' })
      .mockResolvedValueOnce({ id: 'file-2' })
      .mockResolvedValueOnce({ id: 'file-3' });
    mockCreateTopicFileMutation
      .mockResolvedValueOnce({ id: 'topic-file-1' })
      .mockResolvedValueOnce({ id: 'topic-file-2' })
      .mockResolvedValueOnce({ id: 'topic-file-3' });

    await result.current.uploadFiles({
      fileItems,
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
    });

    await waitFor(() => {
      expect(mockUploadMutation).toHaveBeenCalledTimes(3);
      expect(mockCreateTopicFileMutation).toHaveBeenCalledTimes(3);
      
      // First create regular file
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(1, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-1',
        is_solutions: false,
        is_solutions_of_id: null,
      });
      
      // Then create both solution files
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(2, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-2',
        is_solutions: true,
        is_solutions_of_id: 'topic-file-1',
      });
      expect(mockCreateTopicFileMutation).toHaveBeenNthCalledWith(3, {
        topic_id: 'topic-1',
        type: 'NOTES',
        file_id: 'file-3',
        is_solutions: true,
        is_solutions_of_id: 'topic-file-1',
      });
      
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should sort files by index before uploading', async () => {
    const onSuccess = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onSuccess }),
      { wrapper: createWrapper() }
    );

    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    const fileItems: FileItem[] = [
      { id: '2', file: file2, index: 2, solutionOfId: null },
      { id: '1', file: file1, index: 1, solutionOfId: null },
    ];

    mockUploadMutation
      .mockResolvedValueOnce({ id: 'file-1' })
      .mockResolvedValueOnce({ id: 'file-2' });
    mockCreateTopicFileMutation
      .mockResolvedValueOnce({ id: 'topic-file-1' })
      .mockResolvedValueOnce({ id: 'topic-file-2' });

    await result.current.uploadFiles({
      fileItems,
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
    });

    await waitFor(() => {
      // Should upload in index order (file1 first, then file2)
      expect(mockUploadMutation).toHaveBeenNthCalledWith(1, {
        subjectId: 'subject-1',
        topicId: 'topic-1',
        file: file1,
      });
      expect(mockUploadMutation).toHaveBeenNthCalledWith(2, {
        subjectId: 'subject-1',
        topicId: 'topic-1',
        file: file2,
      });
    });
  });

  it('should call onError when upload fails', async () => {
    const onError = jest.fn();
    const { result } = renderHook(
      () => useFileUploadFlow({ onError }),
      { wrapper: createWrapper() }
    );

    const file = new File([''], 'test.pdf');
    const fileItem: FileItem = {
      id: '1',
      file,
      index: 1,
      solutionOfId: null,
    };

    const error = new Error('Upload failed');
    mockUploadMutation.mockRejectedValue(error);

    await expect(
      result.current.uploadFiles({
        fileItems: [fileItem],
        subjectId: 'subject-1',
        topicId: 'topic-1',
        type: 'NOTES',
      })
    ).rejects.toThrow('Upload failed');

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('should throw error when no files provided', async () => {
    const { result } = renderHook(
      () => useFileUploadFlow(),
      { wrapper: createWrapper() }
    );

    await expect(
      result.current.uploadFiles({
        fileItems: [],
        subjectId: 'subject-1',
        topicId: 'topic-1',
        type: 'NOTES',
      })
    ).rejects.toThrow('No files to upload');
  });

  it('should set isUploading state correctly', async () => {
    const { result } = renderHook(
      () => useFileUploadFlow(),
      { wrapper: createWrapper() }
    );

    expect(result.current.isUploading).toBe(false);

    const file = new File([''], 'test.pdf');
    const fileItem: FileItem = {
      id: '1',
      file,
      index: 1,
      solutionOfId: null,
    };

    // Create a promise that we can control
    let resolveUpload: ((value: Tables<'files'>) => void) | undefined;
    const uploadPromise = new Promise<Tables<'files'>>((resolve) => {
      resolveUpload = resolve;
    });
    mockUploadMutation.mockReturnValue(uploadPromise);
    mockCreateTopicFileMutation.mockResolvedValue({ id: 'topic-file-1' });

    const uploadPromise2 = result.current.uploadFiles({
      fileItems: [fileItem],
      subjectId: 'subject-1',
      topicId: 'topic-1',
      type: 'NOTES',
    });

    // Should be uploading
    await waitFor(() => {
      expect(result.current.isUploading).toBe(true);
    });

    // Resolve the upload
    resolveUpload?.({ 
      id: 'file-1',
      bucket: 'test',
      created_at: null,
      created_by: null,
      deleted_at: null,
      filename: 'test.pdf',
      metadata: {},
      mimetype: 'application/pdf',
      size_bytes: 0,
      storage_path: 'test/test.pdf',
      external_url: null,
      storage_provider: 'supabase',
      updated_at: null,
    } as Tables<'files'>);
    await uploadPromise2;

    // Should be done uploading
    await waitFor(() => {
      expect(result.current.isUploading).toBe(false);
    });
  });
});
