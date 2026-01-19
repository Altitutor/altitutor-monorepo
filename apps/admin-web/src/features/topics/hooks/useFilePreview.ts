import { useEffect, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { topicsFilesApi } from '../api/topics-files';
import { filesApi } from '../api/files';
import { topicsApi } from '../api/topics';
import { getSignedUrl } from '@/shared/lib/supabase/storage';

export interface FilePreviewData {
  file: Tables<'files'> | null;
  topicFile: (Tables<'topics_files'> & { topic: Tables<'topics'> }) | null;
  previewUrl: string | null;
  isLoading: boolean;
  isLoadingPreview: boolean;
  error: Error | null;
}

export interface UseFilePreviewParams {
  isOpen: boolean;
  fileId?: string | null;
  topicFileId?: string | null;
}

/**
 * Custom hook for fetching file preview data
 * Handles all data fetching logic separated from UI component
 */
export function useFilePreview({
  isOpen,
  fileId,
  topicFileId,
}: UseFilePreviewParams): FilePreviewData {
  const [file, setFile] = useState<Tables<'files'> | null>(null);
  const [topicFile, setTopicFile] = useState<
    (Tables<'topics_files'> & { topic: Tables<'topics'> }) | null
  >(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setTopicFile(null);
      setPreviewUrl(null);
      setError(null);
    }
  }, [isOpen]);

  // Load file data
  useEffect(() => {
    const loadFile = async () => {
      if (!isOpen) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (topicFileId) {
          // Get topic file with file and topic details
          const tf = await topicsFilesApi.getTopicFile(topicFileId);
          if (tf) {
            const fileData = await filesApi.getFile(tf.file_id);
            if (!fileData) {
              throw new Error('File not found');
            }

            const topicData = await topicsApi.getTopic(tf.topic_id);
            if (!topicData) {
              throw new Error('Topic not found');
            }

            setFile(fileData);
            setTopicFile({ ...tf, topic: topicData });
          }
        } else if (fileId) {
          // Get file and try to find topic file
          const fileData = await filesApi.getFile(fileId);
          if (!fileData) {
            throw new Error('File not found');
          }
          setFile(fileData);

          // Try to get topic file info (optional - don't fail if not found)
          try {
            const tf = await topicsFilesApi.getTopicFileByFileId(fileId);
            if (tf) {
              setTopicFile(tf);
            }
          } catch (topicFileError) {
            // Topic file not found, that's okay - file can exist without topic file
            // File may exist without a topic file entry
          }
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load file');
        setError(error);
        console.error('Error loading file:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [isOpen, fileId, topicFileId]);

  // Load preview URL when file is available
  useEffect(() => {
    const loadPreview = async () => {
      if (!isOpen || !file || previewUrl || isLoadingPreview) {
        return;
      }

      try {
        setIsLoadingPreview(true);
        const signedUrl = await getSignedUrl(file.storage_path);
        setPreviewUrl(signedUrl);
      } catch (err) {
        console.error('Failed to generate signed URL:', err);
        // Don't set error state - preview URL failure is not critical
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [isOpen, file, previewUrl, isLoadingPreview]);

  return {
    file,
    topicFile,
    previewUrl,
    isLoading,
    isLoadingPreview,
    error,
  };
}
