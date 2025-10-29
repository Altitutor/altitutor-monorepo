'use client';

import { useState, useEffect } from 'react';
import { Button } from '@altitutor/ui';
import { Download, Loader2, Edit, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@altitutor/ui';
import { getFileTypeIcon, getFileTypeLabel } from '../utils/file-type-icons';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import type { Enums } from '@altitutor/shared';

export interface FileCardProps {
  fileCode: string;
  fileType: Enums<'resource_type'>;
  filename: string;
  storagePath: string;
  mimeType?: string;
  topicFileId?: string;
  currentTopicId?: string;
  currentSubjectId?: string;
  onDownload?: () => void;
  onEdit?: (topicFileId: string) => void;
}

export function FileCard({
  fileCode,
  fileType,
  filename,
  storagePath,
  mimeType,
  topicFileId,
  currentTopicId: _currentTopicId,
  currentSubjectId: _currentSubjectId,
  onDownload,
  onEdit,
}: FileCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

  const Icon = getFileTypeIcon(fileType);
  const typeLabel = getFileTypeLabel(fileType);

  const isPdf = mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
  const isImage = mimeType?.startsWith('image/');

  // Handle Command+P to print the PDF
  useEffect(() => {
    if (!isPreviewOpen || !isPdf || !iframeRef) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPreviewOpen, isPdf, iframeRef]);

  const handlePrint = () => {
    if (isPdf && previewUrl) {
      // Open the PDF in a new window and trigger print
      const printWindow = window.open(previewUrl, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
    }
  };

  const handleCardClick = async () => {
    try {
      setLoadingPreview(true);
      setIsPreviewOpen(true);
      const signedUrl = await getSignedUrl(storagePath);
      setPreviewUrl(signedUrl);
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      setIsPreviewOpen(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      setDownloadingFile(true);
      const signedUrl = await getSignedUrl(storagePath);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setDownloadingFile(false);
    }
  };

  return (
    <>
      <div
        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium">{fileCode}</span>
              <span className="text-sm text-muted-foreground">{typeLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate" title={filename}>
              {filename}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownload}
          disabled={downloadingFile}
          className="flex-shrink-0"
        >
          {downloadingFile ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* File Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-5 w-5" />
              <span>{fileCode} - {filename}</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {loadingPreview ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : previewUrl ? (
              <>
                {isPdf ? (
                  <iframe
                    ref={setIframeRef}
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title={filename}
                  />
                ) : isImage ? (
                  <img
                    src={previewUrl}
                    alt={filename}
                    className="max-w-full h-auto mx-auto"
                  />
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
            {onEdit && topicFileId && (
              <Button
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(topicFileId);
                  setIsPreviewOpen(false);
                }}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

