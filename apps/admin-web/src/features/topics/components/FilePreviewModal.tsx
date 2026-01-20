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
import { getFileTypeIcon } from '../utils/file-type-icons';
import { useFilePreview } from '../hooks/useFilePreview';
import { isPdfFile, isImageFile, downloadFile, printPdf, setupPrintKeyboardHandler } from '../utils/fileOperations';
import type { Enums } from '@altitutor/shared';

export interface FilePreviewModalProps {
  isOpen: boolean;
  fileId?: string | null;
  topicFileId?: string | null;
  topicName?: string | null;
  fileCode?: string | null;
  onClose: () => void;
  onEdit?: (topicFileId: string) => void;
}

export function FilePreviewModal({ 
  isOpen, 
  fileId,
  topicFileId,
  topicName: providedTopicName,
  fileCode: providedFileCode,
  onClose,
  onEdit,
}: FilePreviewModalProps) {
  const [downloadingFile, setDownloadingFile] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Use custom hook for all data fetching
  const {
    file,
    topicFile,
    previewUrl,
    isLoading,
    isLoadingPreview,
    error: fileError,
  } = useFilePreview({
    isOpen,
    fileId,
    topicFileId,
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
      await downloadFile(file, setDownloadingFile);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  }, [file]);

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
  const fileCode = providedFileCode || topicFile?.code || '';
  const topicName = providedTopicName || topicFile?.topic?.name || '';
  const filename = file?.filename || '';
  const fileType = topicFile?.type || 'NOTES';
  const Icon = getFileTypeIcon(fileType as Enums<'resource_type'>);
  const isPdf = isPdfFile(file);
  const isImage = isImageFile(file);

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
                  {fileCode && topicName ? `${fileCode} ${topicName}` : filename}
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
          {onEdit && topicFile?.id && (
            <Button
              variant="outline"
              onClick={() => {
                onEdit(topicFile.id);
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
