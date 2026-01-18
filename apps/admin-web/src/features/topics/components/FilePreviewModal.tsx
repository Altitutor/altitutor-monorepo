'use client';

import { useEffect, useState } from 'react';
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
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import { getFileTypeIcon } from '../utils/file-type-icons';
import { topicsFilesApi } from '../api/topics-files';
import type { Tables } from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  const [file, setFile] = useState<Tables<'files'> | null>(null);
  const [topicFile, setTopicFile] = useState<(Tables<'topics_files'> & { topic: Tables<'topics'> }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const loadFile = async () => {
      if (!isOpen) {
        setFile(null);
        setTopicFile(null);
        setPreviewUrl(null);
        return;
      }

      setIsLoading(true);
      try {
        const supabase = (getSupabaseClient() as SupabaseClient<Database>);
        
        if (topicFileId) {
          // Get topic file with file and topic details
          const tf = await topicsFilesApi.getTopicFile(topicFileId);
          if (tf) {
            const { data: fileData, error: fileError } = await supabase
              .from('files')
              .select('*')
              .eq('id', tf.file_id)
              .single();
            
            if (fileError) throw fileError;
            
            const { data: topicData, error: topicError } = await supabase
              .from('topics')
              .select('*')
              .eq('id', tf.topic_id)
              .single();
            
            if (topicError) throw topicError;
            
            setFile(fileData);
            setTopicFile({ ...tf, topic: topicData });
          }
        } else if (fileId) {
          // Get file and try to find topic file
          const { data: fileData, error: fileError } = await supabase
            .from('files')
            .select('*')
            .eq('id', fileId)
            .single();
          
          if (fileError) throw fileError;
          setFile(fileData);
          
          // Try to get topic file info
          try {
            const tf = await topicsFilesApi.getTopicFileByFileId(fileId);
            if (tf) {
              setTopicFile(tf);
            }
          } catch (error) {
            // Topic file not found, that's okay
          }
        }
      } catch (error) {
        // Error loading file
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [isOpen, fileId, topicFileId]);

  useEffect(() => {
    if (isOpen && file && !previewUrl && !loadingPreview) {
      const loadPreview = async () => {
        try {
          setLoadingPreview(true);
          const signedUrl = await getSignedUrl(file.storage_path);
          setPreviewUrl(signedUrl);
        } catch (error) {
          console.error('Failed to generate signed URL:', error);
        } finally {
          setLoadingPreview(false);
        }
      };
      loadPreview();
    }
  }, [isOpen, file, previewUrl, loadingPreview]);

  // Handle Command+P to print the PDF
  useEffect(() => {
    if (!isOpen || !previewUrl || !iframeRef) return;

    const isPdf = file?.mimetype === 'application/pdf' || file?.filename.toLowerCase().endsWith('.pdf');
    if (!isPdf) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewUrl, iframeRef, file]);

  const handlePrint = () => {
    if (previewUrl && file) {
      const isPdf = file.mimetype === 'application/pdf' || file.filename.toLowerCase().endsWith('.pdf');
      if (isPdf) {
        const printWindow = window.open(previewUrl, '_blank');
        if (printWindow) {
          printWindow.addEventListener('load', () => {
            printWindow.print();
          });
        }
      }
    }
  };

  const handleDownload = async () => {
    if (!file) return;
    
    try {
      setDownloadingFile(true);
      const signedUrl = await getSignedUrl(file.storage_path);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download file:', error);
    } finally {
      setDownloadingFile(false);
    }
  };

  const fileCode = providedFileCode || topicFile?.code || '';
  const topicName = providedTopicName || topicFile?.topic?.name || '';
  const filename = file?.filename || '';
  const fileType = topicFile?.type || 'NOTES';
  const Icon = getFileTypeIcon(fileType as Enums<'resource_type'>);
  const isPdf = file?.mimetype === 'application/pdf' || file?.filename.toLowerCase().endsWith('.pdf');
  const isImage = file?.mimetype?.startsWith('image/');

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
          {isLoading || loadingPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : file ? (
            previewUrl ? (
              <>
                {isPdf ? (
                  <iframe
                    ref={setIframeRef}
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
