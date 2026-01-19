'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Download, Loader2, Edit, MoreVertical, Trash2 } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { getFileTypeIcon, getFileTypeLabel } from '../utils/file-type-icons';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import { FilePreviewModal } from './FilePreviewModal';
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
  topicName?: string;
  fileId?: string;
  onDownload?: () => void;
  onEdit?: (topicFileId: string) => void;
  onDelete?: (topicFileId: string) => void;
  getSignedUrlFn?: (path: string) => Promise<string>;
}

export function FileCard({
  fileCode,
  fileType,
  filename,
  storagePath,
  mimeType: _mimeType,
  topicFileId,
  currentTopicId: _currentTopicId,
  currentSubjectId: _currentSubjectId,
  topicName,
  fileId,
  onDownload,
  onEdit,
  onDelete,
  getSignedUrlFn,
}: FileCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const Icon = getFileTypeIcon(fileType);
  const typeLabel = getFileTypeLabel(fileType);

  const handleCardClick = () => {
    setIsPreviewOpen(true);
  };

  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation(); // Prevent card click
    }
    
    if (onDownload) {
      onDownload();
      return;
    }

    try {
      setDownloadingFile(true);
      const getUrlFn = getSignedUrlFn || getSignedUrl;
      const signedUrl = await getUrlFn(storagePath);
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (onDelete && topicFileId) {
      onDelete(topicFileId);
    }
    setShowDeleteDialog(false);
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
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-sm font-medium truncate">{fileCode}</span>
              <span className="text-sm text-muted-foreground flex-shrink-0">{typeLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate" title={filename}>
              {filename}
            </p>
          </div>
        </div>
        {(onDownload || onDelete || onEdit) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => e.stopPropagation()}
                className="flex-shrink-0"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                disabled={downloadingFile}
              >
                {downloadingFile ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download
              </DropdownMenuItem>
              {onEdit && topicFileId && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(topicFileId);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && topicFileId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file record, topic file link, and the file from storage.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteConfirm();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileId={fileId}
        topicFileId={topicFileId || undefined}
        topicName={topicName}
        fileCode={fileCode}
        onEdit={onEdit && topicFileId ? (id) => {
          onEdit(id);
          setIsPreviewOpen(false);
        } : undefined}
      />
    </>
  );
}

