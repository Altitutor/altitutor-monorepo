import { useEffect, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { filesApi } from '@/features/topics/api/files';
import { getSignedUrl } from '@/shared/lib/supabase/storage';

export interface FilePreviewData {
  file: Tables<'files'> | null;
  metadata: Record<string, unknown> | null;
  previewUrl: string | null;
  isLoading: boolean;
  isLoadingPreview: boolean;
  error: Error | null;
}

export interface UseFilePreviewParams {
  isOpen: boolean;
  fileId?: string | null;
  /**
   * Junction table ID (e.g., topics_files.id, sessions_files.id, staff_files.id)
   * Used for delete/rename operations and optional metadata fetching
   */
  junctionTableId?: string | null;
  /**
   * Custom function to get signed URL for the file
   * If not provided, defaults to getSignedUrl from storage
   */
  getSignedUrlFn?: (path: string) => Promise<string>;
  /**
   * Optional function to fetch metadata for the junction table entry
   * Should return file data and any additional metadata
   * If not provided, will fall back to loading file by fileId only
   */
  getMetadataFn?: (junctionTableId: string) => Promise<{
    file: Tables<'files'>;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Custom hook for fetching file preview data
 * Handles all data fetching logic separated from UI component
 * 
 * This hook is generic and can be used for any file type (topics, sessions, staff, etc.)
 * by providing appropriate getMetadataFn and getSignedUrlFn functions.
 */
export function useFilePreview({
  isOpen,
  fileId,
  junctionTableId,
  getSignedUrlFn,
  getMetadataFn,
}: UseFilePreviewParams): FilePreviewData {
  const [file, setFile] = useState<Tables<'files'> | null>(null);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setMetadata(null);
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
        // If junctionTableId and getMetadataFn are provided, try to load via metadata
        if (junctionTableId && getMetadataFn) {
          try {
            const result = await getMetadataFn(junctionTableId);
            setFile(result.file);
            if (result.metadata) {
              setMetadata(result.metadata);
            }
            return; // Successfully loaded via metadata function, exit early
          } catch (metadataError) {
            // Metadata fetch failed (e.g., junctionTableId is for a different table)
            // Fall back to fileId if provided
            if (fileId) {
              // Continue to fileId branch below
            } else {
              throw metadataError; // Re-throw if no fileId to fall back to
            }
          }
        }
        
        // Load file by fileId
        if (fileId) {
          const fileData = await filesApi.getFile(fileId);
          if (!fileData) {
            throw new Error('File not found');
          }
          setFile(fileData);
        } else if (junctionTableId && !getMetadataFn) {
          // If junctionTableId provided but no metadata function, we can't load
          throw new Error('Cannot load file: junctionTableId provided but no getMetadataFn');
        } else {
          throw new Error('Cannot load file: fileId or junctionTableId with getMetadataFn required');
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
  }, [isOpen, fileId, junctionTableId, getMetadataFn]);

  // Load preview URL when file is available
  useEffect(() => {
    const loadPreview = async () => {
      if (!isOpen || !file || previewUrl || isLoadingPreview) {
        return;
      }

      try {
        setIsLoadingPreview(true);
        const getUrlFn = getSignedUrlFn || getSignedUrl;
        const signedUrl = await getUrlFn(file.storage_path);
        setPreviewUrl(signedUrl);
      } catch (err) {
        console.error('Failed to generate signed URL:', err);
        // Don't set error state - preview URL failure is not critical
      } finally {
        setIsLoadingPreview(false);
      }
    };

    loadPreview();
  }, [isOpen, file, previewUrl, isLoadingPreview, getSignedUrlFn]);

  return {
    file,
    metadata,
    previewUrl,
    isLoading,
    isLoadingPreview,
    error,
  };
}
