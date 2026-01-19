import { Label } from '@altitutor/ui';
import { useDroppable } from '@dnd-kit/core';
import type { FileItem } from '../../utils/fileItemHelpers';
import { SortableFileItem } from './SortableFileItem';

export interface DroppableColumnProps {
  id: string;
  title: string;
  fileItems: FileItem[];
  onRemove: (id: string) => void;
  isUploading?: boolean;
}

export function DroppableColumn({ id, title, fileItems, onRemove, isUploading = false }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div className="flex-1 space-y-2">
      <Label>{title}</Label>
      <div
        ref={setNodeRef}
        className={`
          min-h-[200px] p-3 border-2 border-dashed rounded-lg space-y-2
          ${isOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
        `}
      >
        {fileItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {title === 'Files' ? 'Drag files here' : 'Drag solutions here'}
          </p>
        ) : (
          <div className="space-y-2">
            {fileItems.map((fileItem) => (
              <SortableFileItem
                key={fileItem.id}
                fileItem={fileItem}
                onRemove={onRemove}
                isUploading={isUploading}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
