'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, File, AlertCircle, Loader2 } from 'lucide-react';
import type { AttachmentFile } from '../hooks/useMessageAttachments';

interface AttachmentPreviewProps {
  attachment: AttachmentFile;
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachment, onRemove }: AttachmentPreviewProps) {
  // Check if it's an image that we can actually preview
  const isImage = attachment.file.type.startsWith('image/') && 
                  attachment.file.type !== 'image/heic' && 
                  attachment.file.type !== 'image/heif';
  const isUploading = attachment.status === 'uploading';
  const isError = attachment.status === 'error';
  const isSuccess = attachment.status === 'success';

  // Image preview
  if (isImage && attachment.preview) {
    return (
      <div className="relative group rounded-lg overflow-hidden border border-border" style={{ maxWidth: '200px', maxHeight: '200px' }}>
        <Image
          src={attachment.preview}
          alt={attachment.file.name}
          fill
          className="object-cover"
          unoptimized
        />
        {/* Overlay for upload states */}
        {(isUploading || isError) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            {isUploading && (
              <div className="text-center text-white">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-1" />
                <div className="text-xs">{attachment.uploadProgress}%</div>
              </div>
            )}
            {isError && (
              <div className="text-center text-white">
                <AlertCircle className="h-6 w-6 mx-auto mb-1 text-red-400" />
                <div className="text-xs">Upload failed</div>
              </div>
            )}
          </div>
        )}
        {/* Remove button */}
        <button
          onClick={() => onRemove(attachment.id)}
          className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-black/90 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Remove attachment"
        >
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
    );
  }

  // Get file extension for display
  const getFileExtension = (filename: string): string => {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : '';
  };

  const fileExtension = getFileExtension(attachment.file.name);
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // File card
  return (
    <div className="relative flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg group max-w-[300px]">
      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" title={attachment.file.name}>
          {attachment.file.name}
        </div>
        <div className="text-[10px] text-muted-foreground">
          {isUploading && `${attachment.uploadProgress}%`}
          {isError && 'Upload failed'}
          {isSuccess && (
            <>
              {fileExtension && <span className="font-medium">{fileExtension}</span>}
              {fileExtension && ' • '}
              {formatFileSize(attachment.file.size)}
            </>
          )}
        </div>
      </div>
      {isUploading && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
      )}
      {isError && (
        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
      )}
      <button
        onClick={() => onRemove(attachment.id)}
        className="p-1 hover:bg-muted-foreground/20 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        aria-label="Remove attachment"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface AttachmentPreviewListProps {
  attachments: AttachmentFile[];
  onRemove: (id: string) => void;
}

export function AttachmentPreviewList({ attachments, onRemove }: AttachmentPreviewListProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 p-2 border-b border-border bg-muted/30">
      {attachments.map((attachment) => (
        <AttachmentPreview
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}
