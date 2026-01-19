import { useState, useCallback } from 'react';
import type { Enums } from '@altitutor/shared';
import { useUploadFile } from './useFilesQuery';
import { useCreateTopicFile } from './useTopicsFilesQuery';
import type { FileItem } from '../utils/fileItemHelpers';

export interface UseFileUploadFlowParams {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface UseFileUploadFlowReturn {
  isUploading: boolean;
  uploadFiles: (params: {
    fileItems: FileItem[];
    subjectId: string;
    topicId: string;
    type: Enums<'resource_type'>;
    isSolutions?: boolean;
    solutionOfId?: string | null;
  }) => Promise<void>;
}

/**
 * Hook for orchestrating file upload flow
 * Handles the complex logic of uploading files and creating topic file links
 * Separated from UI component for testability and reusability
 */
export function useFileUploadFlow({
  onSuccess,
  onError,
}: UseFileUploadFlowParams = {}): UseFileUploadFlowReturn {
  const [isUploading, setIsUploading] = useState(false);
  const uploadFileMutation = useUploadFile();
  const createTopicFileMutation = useCreateTopicFile();

  const uploadFiles = useCallback(
    async (params: {
      fileItems: FileItem[];
      subjectId: string;
      topicId: string;
      type: Enums<'resource_type'>;
      isSolutions?: boolean;
      solutionOfId?: string | null;
    }) => {
      const { fileItems, subjectId, topicId, type, isSolutions = false, solutionOfId = null } = params;

      if (fileItems.length === 0) {
        throw new Error('No files to upload');
      }

      try {
        setIsUploading(true);

        // Handle single file case (backward compatibility)
        if (fileItems.length === 1) {
          const fileItem = fileItems[0];

          // Upload file to storage and create file record
          const fileRecord = await uploadFileMutation.mutateAsync({
            subjectId,
            topicId,
            file: fileItem.file,
          });

          // Create topic_files link
          await createTopicFileMutation.mutateAsync({
            topic_id: topicId,
            type,
            file_id: fileRecord.id,
            is_solutions: isSolutions,
            is_solutions_of_id: isSolutions ? solutionOfId : null,
          });

          onSuccess?.();
          return;
        }

        // Handle multiple files case
        // Sort files by index
        const sortedFiles = [...fileItems].sort((a, b) => a.index - b.index);

        // Separate regular files and solution files
        const regularFileItems = sortedFiles.filter((f) => !f.solutionOfId);
        const solutionFileItems = sortedFiles.filter((f) => f.solutionOfId);

        // Step 1: Upload all files
        const uploadPromises = sortedFiles.map(async (fileItem) => {
          const fileRecord = await uploadFileMutation.mutateAsync({
            subjectId,
            topicId,
            file: fileItem.file,
          });
          return {
            fileRecord,
            fileItem,
          };
        });

        const uploadResults = await Promise.all(uploadPromises);

        // Create a map of file item IDs to file records
        const fileItemIdToFileRecord = new Map<string, typeof uploadResults[0]>();
        uploadResults.forEach((result) => {
          fileItemIdToFileRecord.set(result.fileItem.id, result);
        });

        // Step 2: Create topic_files for regular files first
        const fileItemIdToTopicFileId = new Map<string, string>();

        for (const fileItem of regularFileItems) {
          const uploadResult = fileItemIdToFileRecord.get(fileItem.id);
          if (uploadResult) {
            const topicFile = await createTopicFileMutation.mutateAsync({
              topic_id: topicId,
              type,
              file_id: uploadResult.fileRecord.id,
              is_solutions: false,
              is_solutions_of_id: null,
            });
            fileItemIdToTopicFileId.set(fileItem.id, topicFile.id);
          }
        }

        // Step 3: Create topic_files for solution files
        for (const solutionItem of solutionFileItems) {
          const uploadResult = fileItemIdToFileRecord.get(solutionItem.id);
          const targetTopicFileId = fileItemIdToTopicFileId.get(solutionItem.solutionOfId!);

          if (uploadResult && targetTopicFileId) {
            await createTopicFileMutation.mutateAsync({
              topic_id: topicId,
              type,
              file_id: uploadResult.fileRecord.id,
              is_solutions: true,
              is_solutions_of_id: targetTopicFileId,
            });
          }
        }

        onSuccess?.();
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error('Failed to upload files');
        console.error('Failed to upload files:', err);
        onError?.(err);
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [uploadFileMutation, createTopicFileMutation, onSuccess, onError]
  );

  return {
    isUploading,
    uploadFiles,
  };
}
