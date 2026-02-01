'use client';

import { useState, useCallback } from 'react';
import { uploadMessageAttachment } from '../utils/uploadAttachment';
import { isHeicFile } from '../utils/heicConverter';

export interface AttachmentFile {
  id: string;
  file: File;
  preview?: string; // For images
  uploadProgress: number; // 0-100
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  storageUrl?: string; // Full Supabase Storage URL
  storagePath?: string; // Storage path for database
}

const MAX_FILES = 10;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function useMessageAttachments() {
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  const uploadAttachment = useCallback(async (attachmentId: string, file: File) => {
    // Update status to uploading
    setAttachments((prev) =>
      prev.map((att) =>
        att.id === attachmentId ? { ...att, status: 'uploading', uploadProgress: 0 } : att
      )
    );

    try {
      // Simulate progress updates (Supabase doesn't provide progress callbacks)
      // We'll update progress in chunks
      const progressInterval = setInterval(() => {
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachmentId && att.status === 'uploading'
              ? { ...att, uploadProgress: Math.min(att.uploadProgress + 10, 90) }
              : att
          )
        );
      }, 200);

      const result = await uploadMessageAttachment(file);

      clearInterval(progressInterval);

      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachmentId
            ? {
                ...att,
                status: 'success',
                uploadProgress: 100,
                storageUrl: result.url,
                storagePath: result.path,
              }
            : att
        )
      );
    } catch (error: any) {
      setAttachments((prev) =>
        prev.map((att) =>
          att.id === attachmentId
            ? {
                ...att,
                status: 'error',
                error: error?.message || 'Upload failed',
                uploadProgress: 0,
              }
            : att
        )
      );
    }
  }, []);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    // Check max files limit
    const currentCount = attachments.length;
    const remainingSlots = MAX_FILES - currentCount;
    if (fileArray.length > remainingSlots) {
      throw new Error(`Maximum ${MAX_FILES} files allowed. You can add ${remainingSlots} more file${remainingSlots !== 1 ? 's' : ''}.`);
    }

    // Validate file sizes
    const oversizedFiles = fileArray.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      throw new Error(`File size exceeds 100MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
    }

    // Create attachment objects
    const newAttachments: AttachmentFile[] = fileArray.map((file) => {
      const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const isImage = file.type.startsWith('image/');
      // For HEIC files, we'll convert them in the preview component, so don't create preview URL here
      const isHeic = isHeicFile(file);
      const preview = (isImage && !isHeic) ? URL.createObjectURL(file) : undefined;

      return {
        id,
        file,
        preview,
        uploadProgress: 0,
        status: 'pending',
      };
    });

    // Add to state immediately
    setAttachments((prev) => [...prev, ...newAttachments]);

    // Upload files immediately
    newAttachments.forEach((attachment) => {
      uploadAttachment(attachment.id, attachment.file);
    });
  }, [attachments.length, uploadAttachment]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((prev) => {
      const attachment = prev.find((att) => att.id === attachmentId);
      // Clean up preview URL if it exists
      if (attachment?.preview) {
        URL.revokeObjectURL(attachment.preview);
      }
      return prev.filter((att) => att.id !== attachmentId);
    });
  }, []);

  const clearAll = useCallback(() => {
    attachments.forEach((att) => {
      if (att.preview) {
        URL.revokeObjectURL(att.preview);
      }
    });
    setAttachments([]);
  }, [attachments]);

  const getSuccessfulAttachments = useCallback(() => {
    return attachments.filter((att) => att.status === 'success');
  }, [attachments]);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAll,
    getSuccessfulAttachments,
    hasAttachments: attachments.length > 0,
    canAddMore: attachments.length < MAX_FILES,
  };
}
