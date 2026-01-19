import { Button } from '@altitutor/ui';
import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FileItem } from '../../utils/fileItemHelpers';

export interface SortableSolutionItemProps {
  solutionItem: FileItem;
  onRemove: (id: string) => void;
  isUploading?: boolean;
}

export function SortableSolutionItem({ solutionItem, onRemove, isUploading = false }: SortableSolutionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: solutionItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded bg-background"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{solutionItem.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(solutionItem.file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(solutionItem.id)}
        disabled={isUploading}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}
