'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { FileText } from 'lucide-react';
import { cn } from '@/shared/utils';
import type { Note } from '../types';

interface DraggableNoteProps {
  note: Note;
  onClick?: (e?: React.MouseEvent) => void;
  indent?: number;
}

/**
 * Draggable note component
 */
export function DraggableNote({ note, onClick, indent = 0 }: DraggableNoteProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 cursor-grab active:cursor-grabbing',
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
    </div>
  );
}
