'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { Download, Loader2, MoreVertical, Printer, X } from 'lucide-react';
import { getFileTypeIcon } from '@/shared/utils/file-type-icons';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useFilePreview } from '@/shared/hooks/useFilePreview';
import { isPdfFile, isImageFile, downloadFile, printPdf, setupPrintKeyboardHandler } from '@/shared/utils/fileOperations';
import type { Enums, Tables } from '@altitutor/shared';
import { parseExternalVideoEmbed } from '@altitutor/shared';

export interface FilePreviewModalProps {
  isOpen: boolean;
  fileId?: string | null;
  /**
   * Junction table ID (e.g., topics_files.id, sessions_files.id, staff_files.id)
   * @deprecated Use junctionTableId instead
   */
  topicFileId?: string | null;
  /**
   * Junction table ID (e.g., topics_files.id, sessions_files.id, staff_files.id)
   */
  junctionTableId?: string | null;
  topicName?: string | null;
  fileCode?: string | null;
  /**
   * Display name for the file (e.g., display_name from staff_files or sessions_files)
   * Falls back to filename if not provided
   */
  displayName?: string | null;
  onClose: () => void;
  onEdit?: (junctionTableId: string) => void;
  getSignedUrlFn?: (path: string) => Promise<string>;
  /**
   * Optional function to fetch metadata for the junction table entry
   * Should return file data and any additional metadata
   */
  getMetadataFn?: (junctionTableId: string) => Promise<{
    file: Tables<'files'>;
    metadata?: Record<string, unknown>;
  }>;
}

export function FilePreviewModal({ 
  isOpen, 
  fileId,
  topicFileId, // Deprecated but kept for backward compatibility
  junctionTableId,
  topicName: providedTopicName,
  fileCode: providedFileCode,
  displayName: providedDisplayName,
  onClose,
  onEdit: _onEdit,
  getSignedUrlFn,
  getMetadataFn,
}: FilePreviewModalProps) {
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  // Use junctionTableId if provided, otherwise fall back to topicFileId for backward compatibility
  const effectiveJunctionTableId = junctionTableId || topicFileId;

  // Use generic hook for all data fetching
  const {
    file,
    metadata,
    previewUrl,
    isLoading,
    isLoadingPreview,
    error: fileError,
  } = useFilePreview({
    isOpen,
    fileId,
    junctionTableId: effectiveJunctionTableId,
    getSignedUrlFn,
    getMetadataFn,
  });

  // Handle print action
  const handlePrint = useCallback(() => {
    if (previewUrl && isPdfFile(file)) {
      printPdf(previewUrl);
    }
  }, [previewUrl, file]);

  // Handle download action
  const handleDownload = useCallback(async () => {
    if (!file) return;
    
    try {
      await downloadFile(file, setDownloadingFile, getSignedUrlFn);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }, [file, getSignedUrlFn]);

  // Setup keyboard shortcut for printing PDFs
  useEffect(() => {
    const cleanup = setupPrintKeyboardHandler(
      isOpen,
      previewUrl,
      file,
      handlePrint
    );
    return cleanup;
  }, [isOpen, previewUrl, file, handlePrint]);

  // Derived values for display
  // Support topic-specific metadata structure for backward compatibility
  const topicFile = metadata && typeof metadata === 'object' && 'topicFile' in metadata ? metadata.topicFile as { code?: string; type?: string; id?: string; topic?: { name?: string } } | undefined : undefined;
  const fileCode = providedFileCode || (topicFile && 'code' in topicFile && typeof topicFile.code === 'string' ? topicFile.code : '') || '';
  const topicName = providedTopicName || (topicFile && 'topic' in topicFile && topicFile.topic && typeof topicFile.topic === 'object' && 'name' in topicFile.topic && typeof topicFile.topic.name === 'string' ? topicFile.topic.name : '') || '';
  const filename = file?.filename || '';
  // Use displayName if provided, otherwise fall back to filename
  // Also check metadata for display_name (e.g., from staff_files or sessions_files)
  const displayName = providedDisplayName || (metadata && typeof metadata === 'object' && 'display_name' in metadata && typeof metadata.display_name === 'string' ? metadata.display_name : null);
  const displayTitle = displayName || filename;
  const fileType = (topicFile && 'type' in topicFile && typeof topicFile.type === 'string' ? topicFile.type : 'NOTES') as Enums<'resource_type'>;
  const Icon = getFileTypeIcon(fileType);
  const isPdf = isPdfFile(file);
  const isImage = isImageFile(file);
  const videoEmbed =
    file && fileType === 'VIDEO' && file.external_url
      ? parseExternalVideoEmbed(file.external_url)
      : null;
  const downloadLabel = file?.external_url?.trim() ? 'Open link' : 'Download';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col gap-0 p-0 overflow-hidden [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader className="flex-shrink-0 space-y-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <DialogTitle>
                  {fileCode && topicName ? `${fileCode} ${topicName}` : (displayTitle || 'File Preview')}
                </DialogTitle>
                <DialogDescription className="truncate" title={filename}>
                  {filename}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isPdf && previewUrl && (
                    <DropdownMenuItem onClick={handlePrint}>
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem
                    onClick={handleDownload}
                    disabled={downloadingFile || !file}
                  >
                    {downloadingFile ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {downloadLabel}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isLoading || isLoadingPreview ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fileError ? (
            <div className="flex flex-1 items-center justify-center text-destructive">
              {fileError.message || 'Failed to load file'}
            </div>
          ) : file ? (
            videoEmbed ? (
              <div className="flex flex-1 min-h-0 items-center justify-center">
                <div className="relative h-full w-full max-h-full max-w-full overflow-hidden aspect-video">
                  <iframe
                    src={videoEmbed.embedUrl}
                    title={filename}
                    className="absolute inset-0 h-full w-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                  />
                </div>
              </div>
            ) : file.external_url?.trim() ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                <p className="text-sm text-muted-foreground">
                  This resource opens on an external site.
                </p>
                <Button variant="outline" asChild>
                  <a href={file.external_url.trim()} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                </Button>
              </div>
            ) : previewUrl ? (
              <>
                {isPdf ? (
                  <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="flex-1 w-full min-h-0 border-0"
                    title={filename}
                  />
                ) : isImage ? (
                  <div className="relative flex-1 min-h-0 w-full">
                    <Image
                      src={previewUrl}
                      alt={filename}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center">
                    <Icon className="h-16 w-16 mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-destructive">
                Failed to load preview
              </div>
            )
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              File not found
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
