import { Button } from '@altitutor/ui';
import { GripVertical, X } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FileItem } from '../../utils/fileItemHelpers';

export interface SortableFileItemProps {
  fileItem: FileItem;
  onRemove: (id: string) => void;
  isUploading?: boolean;
}

export function SortableFileItem({ fileItem, onRemove, isUploading = false }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fileItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
        <p className="text-xs text-muted-foreground">
          {(fileItem.file.size / 1024 / 1024).toFixed(2)} MB
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onRemove(fileItem.id)}
        disabled={isUploading}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
