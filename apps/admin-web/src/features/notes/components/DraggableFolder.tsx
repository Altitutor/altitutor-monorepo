'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Folder, ChevronRight, ChevronDown, MoreVertical, Trash2, Pencil } from 'lucide-react';
import { cn } from '@/shared/utils';
import { Button } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import { useDeleteFolder } from '../api/mutations';
import { RenameFolderDialog } from './RenameFolderDialog';
import type { FolderTreeItem } from '../types';

interface DraggableFolderProps {
  folder: FolderTreeItem;
  onClick?: (e?: React.MouseEvent) => void;
  indent?: number;
  isExpanded?: boolean;
  level?: number;
}

/**
 * Draggable folder component
 */
export function DraggableFolder({ 
  folder, 
  onClick, 
  indent = 0, 
  isExpanded = false,
  level = 0,
}: DraggableFolderProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const deleteFolder = useDeleteFolder();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `folder-${folder.id}`,
    data: {
      type: 'folder',
      folder,
    },
  });

  const hasChildren = folder.children.length > 0 || folder.notes.length > 0;
  const isEmpty = folder.children.length === 0 && folder.notes.length === 0;
  const style = {
    transform: CSS.Translate.toString(transform),
    paddingLeft: `${indent}px`,
  };

  const handleDelete = async () => {
    try {
      await deleteFolder.mutateAsync(folder.id);
      setIsDeleteDialogOpen(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'group flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 cursor-grab active:cursor-grabbing',
          'text-sm',
          level === 0 && 'font-medium',
          isDragging && 'opacity-50'
        )}
        onClick={(e) => {
          // Only navigate/expand if not dragging
          if (!isDragging && onClick) {
            onClick(e);
          }
        }}
        {...attributes}
        {...listeners}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <div className="w-4" />
        )}
        <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 truncate">{folder.name}</span>
        {(folder.notes.length > 0 || folder.children.length > 0) && (
          <span className="text-xs text-muted-foreground">
            {folder.notes.length + folder.children.length}
          </span>
        )}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                onPointerDown={(e) => {
                  // Prevent drag when clicking actions button
                  e.stopPropagation();
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRenameDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEmpty) {
                    setIsDeleteDialogOpen(true);
                  }
                }}
                disabled={!isEmpty}
                className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isEmpty ? 'Folder must be empty to delete' : undefined}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <RenameFolderDialog
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        folder={folder}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the folder "{folder.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteFolder.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFolder.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
