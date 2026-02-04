'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Button } from '@altitutor/ui';
import { Download, Loader2, Printer, Edit, X } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { getFileTypeIcon } from '@/shared/utils/file-type-icons';
import { useFilePreview } from '@/shared/hooks/useFilePreview';
import { isPdfFile, isImageFile, downloadFile, printPdf, setupPrintKeyboardHandler } from '@/shared/utils/fileOperations';
import type { Enums } from '@altitutor/shared';

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
    file: any;
    metadata?: Record<string, any>;
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
  onEdit,
  getSignedUrlFn,
  getMetadataFn,
}: FilePreviewModalProps) {
  const [downloadingFile, setDownloadingFile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
  const topicFile = metadata?.topicFile;
  const fileCode = providedFileCode || topicFile?.code || '';
  const topicName = providedTopicName || topicFile?.topic?.name || '';
  const filename = file?.filename || '';
  // Use displayName if provided, otherwise fall back to filename
  // Also check metadata for display_name (e.g., from staff_files or sessions_files)
  const displayName = providedDisplayName || metadata?.display_name || null;
  const displayTitle = displayName || filename;
  const fileType = topicFile?.type || 'NOTES';
  const Icon = getFileTypeIcon(fileType as Enums<'resource_type'>);
  const isPdf = isPdfFile(file);
  const isImage = isImageFile(file);
  const editId = effectiveJunctionTableId || topicFile?.id;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>
                  {fileCode && topicName ? `${fileCode} ${topicName}` : displayTitle}
                </DialogTitle>
                <DialogDescription className="text-base">
                  {filename}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {isLoading || isLoadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fileError ? (
            <div className="text-center py-12 text-destructive">
              {fileError.message || 'Failed to load file'}
            </div>
          ) : file ? (
            previewUrl ? (
              <>
                {isPdf ? (
                  <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title={filename}
                  />
                ) : isImage ? (
                  <div className="relative w-full h-[70vh] flex items-center justify-center">
                    <Image
                      src={previewUrl}
                      alt={filename}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Icon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-destructive">
                Failed to load preview
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground">File not found</div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2">
          {isPdf && previewUrl && (
            <Button
              variant="outline"
              onClick={handlePrint}
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleDownload}
            disabled={downloadingFile}
          >
            {downloadingFile ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download
          </Button>
          {onEdit && editId && (
            <Button
              variant="outline"
              onClick={() => {
                onEdit(editId);
                onClose();
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
