'use client';

import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/shared/utils';

interface DroppableFolderProps {
  folderId: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Droppable folder component
 */
export function DroppableFolder({ folderId, children, className }: DroppableFolderProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder-${folderId}`,
    data: {
      type: 'folder',
      folderId,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'transition-colors rounded-md',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-offset-2',
        className
      )}
    >
      {children}
    </div>
  );
}
