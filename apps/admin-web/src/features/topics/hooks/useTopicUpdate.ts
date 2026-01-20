import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import type { TablesUpdate, Enums } from '@altitutor/shared';
import {
  useUpdateTopic,
  useUpdateTopicIndices,
} from './useTopicsQuery';
import {
  useUpdateTopicFile,
  useUpdateTopicFileIndices,
  topicsFilesKeys,
} from './useTopicsFilesQuery';
import { topicsFilesApi } from '../api/topics-files';
import type { Tables } from '@altitutor/shared';

export interface TopicUpdateData {
  name: string;
  subject_id: string;
  parent_id: string | null;
}

export interface TopicReorderUpdate {
  id: string;
  index: number;
}

export interface FileReorderUpdate {
  id: string;
  index: number;
  type: Enums<'resource_type'>;
}

export interface SolutionLink {
  solutionFileId: string;
  targetFileId: string;
}

export interface TopicUpdateParams {
  topicId: string;
  currentTopic: Tables<'topics'>;
  formData: TopicUpdateData;
  reorderedChildren: TopicReorderUpdate[];
  reorderedFiles: FileReorderUpdate[];
  solutionLinks: SolutionLink[];
  solutionUnlinks: string[];
  currentTopicFiles: Array<Tables<'topics_files'> & { file: Tables<'files'> }>;
}

export interface TopicUpdateResult {
  success: boolean;
  changes: string[];
  error?: string;
}

/**
 * Custom hook for handling complex topic update operations
 * Extracts all mutation orchestration logic from components
 */
export function useTopicUpdate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const updateTopicMutation = useUpdateTopic();
  const updateTopicIndices = useUpdateTopicIndices();
  const updateTopicFile = useUpdateTopicFile();
  const updateTopicFileIndices = useUpdateTopicFileIndices();

  /**
   * Helper to call mutation without showing toast (to avoid multiple toasts)
   */
  const mutateSilently = useCallback(
    <T,>(mutation: any, variables: T): Promise<any> => {
      return new Promise((resolve, reject) => {
        mutation.mutate(variables, {
          onSuccess: (data: any) => {
            resolve(data);
          },
          onError: (error: any) => {
            reject(error);
          },
        });
      });
    },
    []
  );

  /**
   * Check if topic data has changed
   */
  const hasTopicChanged = useCallback(
    (
      currentTopic: Tables<'topics'>,
      formData: TopicUpdateData
    ): boolean => {
      return (
        currentTopic.name !== formData.name ||
        currentTopic.subject_id !== formData.subject_id ||
        (currentTopic.parent_id || null) !== formData.parent_id
      );
    },
    []
  );

  /**
   * Update topic basic information
   */
  const updateTopicDetails = useCallback(
    async (
      topicId: string,
      topicData: TablesUpdate<'topics'>
    ): Promise<void> => {
      await mutateSilently(updateTopicMutation, { id: topicId, data: topicData });
    },
    [updateTopicMutation, mutateSilently]
  );

  /**
   * Update topic children order
   */
  const updateChildrenOrder = useCallback(
    async (reorderedChildren: TopicReorderUpdate[]): Promise<void> => {
      await mutateSilently(updateTopicIndices, reorderedChildren);
    },
    [updateTopicIndices, mutateSilently]
  );

  /**
   * Unlink solutions and convert to regular files
   */
  const unlinkSolutions = useCallback(
    async (solutionUnlinks: string[]): Promise<void> => {
      for (const solutionFileId of solutionUnlinks) {
        await mutateSilently(updateTopicFile, {
          id: solutionFileId,
          data: {
            is_solutions_of_id: null,
            is_solutions: false,
          },
        });
      }
    },
    [updateTopicFile, mutateSilently]
  );

  /**
   * Link solutions to target files
   */
  const linkSolutions = useCallback(
    async (
      solutionLinks: SolutionLink[],
      topicFiles: Array<Tables<'topics_files'> & { file: Tables<'files'> }>
    ): Promise<void> => {
      for (const link of solutionLinks) {
        // Find the target file to get its type
        const targetFile = topicFiles.find((f) => f.id === link.targetFileId);
        await mutateSilently(updateTopicFile, {
          id: link.solutionFileId,
          data: {
            is_solutions_of_id: link.targetFileId,
            // Update solution type to match target file type
            type: targetFile?.type,
          },
        });
      }
    },
    [updateTopicFile, mutateSilently]
  );

  /**
   * Update file types (including their solutions)
   */
  const updateFileTypes = useCallback(
    async (
      typeChanges: FileReorderUpdate[],
      topicId: string
    ): Promise<void> => {
      // Refresh files to get latest state (including solution links)
      await queryClient.invalidateQueries({
        queryKey: topicsFilesKeys.byTopic(topicId),
      });
      const refreshedFiles = await topicsFilesApi.getTopicFilesByTopic(topicId);

      // Update types for files that changed, including their solutions
      for (const fileUpdate of typeChanges) {
        await mutateSilently(updateTopicFile, {
          id: fileUpdate.id,
          data: { type: fileUpdate.type },
        });

        // Also update type for any solution files linked to this file
        const linkedSolutions = refreshedFiles.filter(
          (f) => f.is_solutions && f.is_solutions_of_id === fileUpdate.id
        );
        for (const solution of linkedSolutions) {
          await mutateSilently(updateTopicFile, {
            id: solution.id,
            data: { type: fileUpdate.type },
          });
        }
      }
    },
    [queryClient, updateTopicFile, mutateSilently]
  );

  /**
   * Update file order
   */
  const updateFileOrder = useCallback(
    async (reorderedFiles: FileReorderUpdate[]): Promise<void> => {
      // Pass explicit indices directly - batch_update will ensure sequential order
      await mutateSilently(
        updateTopicFileIndices,
        reorderedFiles.map((f) => ({ id: f.id, index: f.index }))
      );
    },
    [updateTopicFileIndices, mutateSilently]
  );

  /**
   * Main function to orchestrate all topic updates
   * Handles the complex sequence of mutations in the correct order
   */
  const updateTopic = useCallback(
    async (params: TopicUpdateParams): Promise<TopicUpdateResult> => {
      const {
        topicId,
        currentTopic,
        formData,
        reorderedChildren,
        reorderedFiles,
        solutionLinks,
        solutionUnlinks,
        currentTopicFiles,
      } = params;

      const changes: string[] = [];

      try {
        // 1. Update topic basic information if changed
        const topicChanged = hasTopicChanged(currentTopic, formData);
        if (topicChanged) {
          const topicData: TablesUpdate<'topics'> = {
            name: formData.name,
            subject_id: formData.subject_id,
            parent_id: formData.parent_id,
          };
          await updateTopicDetails(topicId, topicData);
          changes.push('Topic details');
        }

        // 2. Update children indices if they were reordered
        if (reorderedChildren.length > 0) {
          await updateChildrenOrder(reorderedChildren);
          changes.push('Topic order');
        }

        // IMPORTANT: Update solutions first (unlink/convert), then link, then update indices
        // This ensures type changes are applied before we recalculate indices

        // 3. Unlink solutions and convert to regular files if needed (do this first)
        if (solutionUnlinks.length > 0) {
          await unlinkSolutions(solutionUnlinks);
          if (!changes.includes('Solution links')) {
            changes.push('Solution links');
          }
        }

        // 4. Link solutions (after unlinking, so we know the final state)
        if (solutionLinks.length > 0) {
          await linkSolutions(solutionLinks, currentTopicFiles);
          if (!changes.includes('Solution links')) {
            changes.push('Solution links');
          }
        }

        // 5. Update file types and indices if they were reordered (do this last, after all type changes)
        // First, update types for files that changed type (including their solutions)
        const typeChanges = reorderedFiles.filter((f) => {
          const originalFile = currentTopicFiles.find((orig) => orig.id === f.id);
          return originalFile && originalFile.type !== f.type;
        });

        if (typeChanges.length > 0) {
          await updateFileTypes(typeChanges, topicId);
          changes.push('File types');
        }

        // 6. Then update indices (batch_update will ensure sequential order)
        if (reorderedFiles.length > 0) {
          await updateFileOrder(reorderedFiles);
          changes.push('File order');
        }

        // Show single grouped toast notification
        if (changes.length > 0) {
          toast({
            title: 'Success',
            description: `Updated: ${changes.join(', ')}`,
          });
        }

        return {
          success: true,
          changes,
        };
      } catch (error) {
        console.error('Failed to update topic:', error);
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to update topic';
        
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });

        return {
          success: false,
          changes: [],
          error: errorMessage,
        };
      }
    },
    [
      hasTopicChanged,
      updateTopicDetails,
      updateChildrenOrder,
      unlinkSolutions,
      linkSolutions,
      updateFileTypes,
      updateFileOrder,
      toast,
    ]
  );

  return {
    updateTopic,
    isPending:
      updateTopicMutation.isPending ||
      updateTopicIndices.isPending ||
      updateTopicFile.isPending ||
      updateTopicFileIndices.isPending,
  };
}
