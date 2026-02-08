'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/shared/utils';

interface DroppableNoFolderProps {
  children: React.ReactNode;
}

/**
 * Droppable area for notes without folders
 */
export function DroppableNoFolder({ children }: DroppableNoFolderProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'no-folder',
    data: {
      type: 'no-folder',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-colors rounded-md',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-offset-2'
      )}
    >
      {children}
    </div>
  );
}
