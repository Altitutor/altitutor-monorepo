import { useEffect, useState } from 'react';
import { useFilePreview as useGenericFilePreview } from '@/shared/hooks/useFilePreview';
import { topicsFilesApi } from '../api/topics-files';
import { filesApi } from '../api/files';
import { topicsApi } from '../api/topics';
import type { Tables } from '@altitutor/shared';

/**
 * Topics-specific wrapper for useFilePreview hook
 * Provides backward compatibility with topic-specific metadata structure
 */
export interface TopicFilePreviewData {
  file: Tables<'files'> | null;
  topicFile: (Tables<'topics_files'> & { topic: Tables<'topics'> }) | null;
  previewUrl: string | null;
  isLoading: boolean;
  isLoadingPreview: boolean;
  error: Error | null;
}

export interface UseTopicFilePreviewParams {
  isOpen: boolean;
  fileId?: string | null;
  topicFileId?: string | null;
  getSignedUrlFn?: (path: string) => Promise<string>;
}

/**
 * Wrapper hook that provides topic-specific metadata structure
 * Uses the generic useFilePreview hook internally
 */
export function useFilePreview({
  isOpen,
  fileId,
  topicFileId,
  getSignedUrlFn,
}: UseTopicFilePreviewParams): TopicFilePreviewData {
  const [topicFileByFileId, setTopicFileByFileId] = useState<
    (Tables<'topics_files'> & { topic: Tables<'topics'> }) | null
  >(null);

  const result = useGenericFilePreview({
    isOpen,
    fileId,
    junctionTableId: topicFileId,
    getSignedUrlFn,
    getMetadataFn: topicFileId
      ? async (id: string) => {
          // Fetch topic file with file and topic details
          const tf = await topicsFilesApi.getTopicFile(id);
          if (!tf) {
            throw new Error('Topic file not found');
          }

          const fileData = await filesApi.getFile(tf.file_id);
          if (!fileData) {
            throw new Error('File not found');
          }

          const topicData = await topicsApi.getTopic(tf.topic_id);
          if (!topicData) {
            throw new Error('Topic not found');
          }

          return {
            file: fileData,
            metadata: {
              topicFile: { ...tf, topic: topicData },
            },
          };
        }
      : undefined,
  });

  // If fileId was provided but no topicFileId, try to find topic file by fileId
  useEffect(() => {
    const loadTopicFileByFileId = async () => {
      if (!isOpen || !fileId || topicFileId || result.file?.id !== fileId) {
        return;
      }

      try {
        const tf = await topicsFilesApi.getTopicFileByFileId(fileId);
        if (tf) {
          setTopicFileByFileId(tf);
        }
      } catch (error) {
        // Topic file not found, that's okay - file can exist without topic file
      }
    };

    loadTopicFileByFileId();
  }, [isOpen, fileId, topicFileId, result.file]);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTopicFileByFileId(null);
    }
  }, [isOpen]);

  // Transform generic metadata to topic-specific structure
  const topicFile = result.metadata?.topicFile || topicFileByFileId;

  return {
    file: result.file,
    topicFile: topicFile as (Tables<'topics_files'> & { topic: Tables<'topics'> }) | null,
    previewUrl: result.previewUrl,
    isLoading: result.isLoading,
    isLoadingPreview: result.isLoadingPreview,
    error: result.error,
  };
}
