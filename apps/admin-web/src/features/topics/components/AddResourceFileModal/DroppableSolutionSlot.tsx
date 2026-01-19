import { useDroppable } from '@dnd-kit/core';
import type { FileItem } from '../../utils/fileItemHelpers';
import { SortableSolutionItem } from './SortableSolutionItem';

export interface DroppableSolutionSlotProps {
  fileItem: FileItem;
  solutionItem: FileItem | undefined;
  onRemove: (id: string) => void;
  isUploading?: boolean;
}

export function DroppableSolutionSlot({
  fileItem,
  solutionItem,
  onRemove,
  isUploading = false,
}: DroppableSolutionSlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `solutions-column-${fileItem.id}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        min-h-[60px] p-2 border-2 border-dashed rounded-lg transition-colors
        ${isOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'}
      `}
    >
      {solutionItem ? (
        <SortableSolutionItem solutionItem={solutionItem} onRemove={onRemove} isUploading={isUploading} />
      ) : (
        <div className="h-full flex items-center justify-center">
          <p className="text-xs text-muted-foreground text-center">
            {isOver ? 'Drop here' : 'Drop solution here'}
          </p>
        </div>
      )}
    </div>
  );
}
