'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Folder, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/shared/utils';
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
    </div>
  );
}
