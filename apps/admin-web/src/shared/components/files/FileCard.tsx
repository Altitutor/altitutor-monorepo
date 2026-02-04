'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { Download, Loader2, Edit, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
} from '@altitutor/ui';
import { getFileTypeIcon, getFileTypeLabel } from '@/shared/utils/file-type-icons';
import { getSignedUrl } from '@/shared/lib/supabase/storage';
import { FilePreviewModal } from './FilePreviewModal';
import type { Enums } from '@altitutor/shared';

export interface FileCardProps {
  fileCode?: string;
  fileType?: Enums<'resource_type'>;
  filename: string;
  displayName?: string | null;
  storagePath: string;
  mimeType?: string;
  /**
   * Junction table ID (e.g., topics_files.id, sessions_files.id, staff_files.id)
   * Used for delete/rename operations
   * @deprecated Use junctionTableId instead
   */
  topicFileId?: string;
  /**
   * Junction table ID (e.g., topics_files.id, sessions_files.id, staff_files.id)
   * Used for delete/rename operations
   */
  junctionTableId?: string;
  currentTopicId?: string;
  currentSubjectId?: string;
  topicName?: string;
  fileId?: string;
  onDownload?: () => void;
  onEdit?: (junctionTableId: string) => void;
  onDelete?: (junctionTableId: string) => void;
  onRename?: (junctionTableId: string, newName: string) => Promise<void>;
  getSignedUrlFn?: (path: string) => Promise<string>;
  /**
   * Optional function to fetch metadata for the junction table entry
   * Used by FilePreviewModal to display additional context
   */
  getMetadataFn?: (junctionTableId: string) => Promise<{
    file: any;
    metadata?: Record<string, any>;
  }>;
}

export function FileCard({
  fileCode,
  fileType,
  filename,
  displayName,
  storagePath,
  mimeType: _mimeType,
  topicFileId, // Deprecated but kept for backward compatibility
  junctionTableId,
  currentTopicId: _currentTopicId,
  currentSubjectId: _currentSubjectId,
  topicName,
  fileId,
  onDownload,
  onEdit,
  onDelete,
  onRename,
  getSignedUrlFn,
  getMetadataFn,
}: FileCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Use junctionTableId if provided, otherwise fall back to topicFileId for backward compatibility
  const effectiveJunctionTableId = junctionTableId || topicFileId;

  const Icon = getFileTypeIcon(fileType || 'NOTES');
  const typeLabel = fileType ? getFileTypeLabel(fileType) : null;

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
    if (onDelete && effectiveJunctionTableId) {
      onDelete(effectiveJunctionTableId);
    }
    setShowDeleteDialog(false);
  };

  const handleRenameClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setRenameValue(displayName || filename);
    setShowRenameDialog(true);
  };

  const handleRenameConfirm = async () => {
    if (!onRename || !effectiveJunctionTableId) return;
    
    try {
      setIsRenaming(true);
      await onRename(effectiveJunctionTableId, renameValue.trim());
      setShowRenameDialog(false);
      setRenameValue('');
    } catch (error) {
      console.error('Failed to rename file:', error);
    } finally {
      setIsRenaming(false);
    }
  };

  const displayFileName = displayName || filename;

  return (
    <>
      <div
        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={handleCardClick}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            {fileCode && (
              <div className="flex items-center gap-2 min-w-0 mb-1">
                <span className="font-mono text-sm font-medium truncate">{fileCode}</span>
                {typeLabel && (
                  <span className="text-sm text-muted-foreground flex-shrink-0">{typeLabel}</span>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground truncate" title={displayFileName}>
              {displayFileName}
            </p>
          </div>
        </div>
        {(onDownload || onDelete || onEdit || onRename) && (
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
              {onRename && effectiveJunctionTableId && (
                <DropdownMenuItem
                  onClick={handleRenameClick}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Rename
                </DropdownMenuItem>
              )}
              {onEdit && effectiveJunctionTableId && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(effectiveJunctionTableId);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {onDelete && effectiveJunctionTableId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
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
              This will permanently delete the file record, file link, and the file from storage.
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

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
            <DialogDescription>
              Enter a new name for this file.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rename-input">File Name</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder={filename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRenaming) {
                    handleRenameConfirm();
                  }
                  if (e.key === 'Escape') {
                    setShowRenameDialog(false);
                  }
                }}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRenameDialog(false);
                setRenameValue('');
              }}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRenameConfirm}
              disabled={isRenaming || !renameValue.trim()}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Renaming...
                </>
              ) : (
                'Rename'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        fileId={fileId}
        junctionTableId={effectiveJunctionTableId || undefined}
        topicName={topicName}
        fileCode={fileCode}
        getSignedUrlFn={getSignedUrlFn}
        getMetadataFn={getMetadataFn}
        onEdit={onEdit && effectiveJunctionTableId ? (id) => {
          onEdit(id);
          setIsPreviewOpen(false);
        } : undefined}
      />
    </>
  );
}
