'use client';

import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileText, FolderKanban, MoreVertical, Trash2, Pencil } from 'lucide-react';
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
import { useDeleteNote } from '../hooks/useNoteMutations';
import { RenameNoteDialog } from './RenameNoteDialog';
import type { Note } from '../types';

interface DraggableNoteProps {
  note: Note;
  project?: { id: string; name: string | null };
  onClick?: (e?: React.MouseEvent) => void;
  onProjectClick?: (projectId: string) => void;
  indent?: number;
}

/**
 * Draggable note component
 */
export function DraggableNote({ note, project, onClick, onProjectClick, indent = 0 }: DraggableNoteProps) {
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const deleteNote = useDeleteNote();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: note.id,
    data: {
      type: 'note',
      note,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    paddingLeft: `${indent}px`,
  };

  const handleDelete = async () => {
    try {
      await deleteNote.mutateAsync(note.id);
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
          isDragging && 'opacity-50'
        )}
        onClick={(e) => {
          // Only navigate if not dragging
          if (!isDragging && onClick) {
            onClick(e);
          }
        }}
        {...attributes}
        {...listeners}
      >
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="flex-1 truncate">{note.title}</span>
        {project && onProjectClick && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onProjectClick(project.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground truncate max-w-[120px]"
            title={project.name ?? 'Project'}
          >
            <FolderKanban className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{project.name || 'Project'}</span>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
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
                  setIsDeleteDialogOpen(true);
                }}
                className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </div>

      <RenameNoteDialog
        isOpen={isRenameDialogOpen}
        onClose={() => setIsRenameDialogOpen(false)}
        note={note}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the note "{note.title}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteNote.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNote.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
