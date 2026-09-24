'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  useDroppable,
  pointerWithin,
  type CollisionDetection,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Tables, Enums } from '@altitutor/shared';
import { getFileTypeIcon, getFileTypeLabel } from '@/shared/utils/file-type-icons';
import { getTopicFileDisplayRows } from '../utils/fileDisplay';

export type TopicFileWithFile = Tables<'topics_files'> & { file: Tables<'files'> };

export interface DraggableFilesListProps {
  files: TopicFileWithFile[];
  onReorder: (updates: Array<{ id: string; index: number; type: Enums<'resource_type'> }>) => void;
  onSolutionLink: (solutionFileId: string, targetFileId: string) => void;
  onSolutionUnlink: (solutionFileId: string) => void;
}

interface SortableSolutionItemProps {
  solution: TopicFileWithFile;
}

function SortableSolutionItem({ solution }: SortableSolutionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: solution.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getFileTypeIcon(solution.type);
  const code = solution.code || '';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded bg-background cursor-grab active:cursor-grabbing min-w-0"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-mono font-medium truncate">{code}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">(Solutions)</span>
        </div>
        <p className="text-xs text-muted-foreground truncate" title={solution.file.filename}>
          {solution.file.filename}
        </p>
      </div>
    </div>
  );
}

function UnlinkedSolutionRow({ solution }: { solution: TopicFileWithFile }) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: `parent-drop-${solution.id}`,
    data: {
      type: 'parent-drop',
      solutionFileId: solution.id,
    },
  });

  return (
    <div className="flex gap-2 items-stretch">
      <div
        ref={setNodeRef}
        className={`w-1/2 p-2 border-2 border-dashed rounded-lg transition-colors min-w-0 ${
          isOver
            ? 'border-primary bg-primary/10'
            : 'border-muted-foreground/30 bg-muted/20'
        }`}
      >
        <div className="flex items-center justify-center h-full text-xs text-muted-foreground min-h-[60px]">
          Drop file here
        </div>
      </div>
      <div className="w-1/2 p-2 border-2 border-dashed rounded-lg border-muted bg-muted/50 min-w-0">
        <SortableSolutionItem solution={solution} />
      </div>
    </div>
  );
}

interface SortableFileItemProps {
  file: TopicFileWithFile;
  onSolutionLink: (solutionFileId: string, targetFileId: string) => void;
  onSolutionUnlink: (solutionFileId: string) => void;
  linkedSolution: TopicFileWithFile | undefined;
}

function SortableFileItem({ file, onSolutionLink: _onSolutionLink, onSolutionUnlink: _onSolutionUnlink, linkedSolution }: SortableFileItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const {
    setNodeRef: setSolutionDropRef,
    isOver: isSolutionDropOver,
  } = useDroppable({
    id: `solution-drop-${file.id}`,
    data: {
      type: 'solution-drop',
      targetFileId: file.id,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const Icon = getFileTypeIcon(file.type);
  const code = file.code || '';

  return (
    <div className="flex gap-2 items-stretch">
      {/* File Card - Half Width */}
      <div
        ref={setNodeRef}
        style={style}
        className="w-1/2 flex items-center gap-2 p-3 border rounded-lg bg-background min-w-0"
      >
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-muted-foreground" />
        </button>
        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-mono font-medium truncate">{code}</span>
          </div>
          <p className="text-xs text-muted-foreground truncate" title={file.file.filename}>
            {file.file.filename}
          </p>
        </div>
      </div>

      {/* Solution Drop Zone - Half Width */}
      <div
        ref={setSolutionDropRef}
        className={`w-1/2 p-2 border-2 border-dashed rounded-lg transition-colors min-w-0 ${
          isSolutionDropOver
            ? 'border-primary bg-primary/10'
            : linkedSolution
            ? 'border-muted bg-muted/50'
            : 'border-muted-foreground/30 bg-muted/20'
        }`}
      >
        {linkedSolution ? (
          <SortableSolutionItem solution={linkedSolution} />
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground min-h-[60px]">
            Drop solution here
          </div>
        )}
      </div>
    </div>
  );
}

interface FileTypeSectionProps {
  type: Enums<'resource_type'>;
  files: TopicFileWithFile[];
  allFiles: TopicFileWithFile[];
  onSolutionLink: (solutionFileId: string, targetFileId: string) => void;
  onSolutionUnlink: (solutionFileId: string) => void;
}

function FileTypeSection({ type, files, allFiles: _allFiles, onSolutionLink, onSolutionUnlink }: FileTypeSectionProps) {
  const {
    setNodeRef,
    isOver,
  } = useDroppable({
    id: `type-drop-${type}`,
    data: {
      type: 'file-type',
      fileType: type,
    },
  });

  const Icon = getFileTypeIcon(type);
  const typeLabel = getFileTypeLabel(type);
  const rows = getTopicFileDisplayRows(files);
  const sortableIds = rows.flatMap((row) =>
    row.kind === 'paired'
      ? [row.file.id, ...(row.solution ? [row.solution.id] : [])]
      : [row.solution.id]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5" />
        <h4 className="font-semibold">{typeLabel}</h4>
        <span className="text-sm text-muted-foreground">
          ({rows.length} file{rows.length !== 1 ? 's' : ''})
        </span>
      </div>
      
      <div
        ref={setNodeRef}
        className={`space-y-2 p-3 rounded-lg transition-colors ${
          isOver ? 'bg-primary/10' : 'bg-muted/30'
        }`}
      >
        {rows.length > 0 ? (
          <SortableContext
            items={sortableIds}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {rows.map((row) =>
                row.kind === 'paired' ? (
                  <SortableFileItem
                    key={row.file.id}
                    file={row.file}
                    onSolutionLink={onSolutionLink}
                    onSolutionUnlink={onSolutionUnlink}
                    linkedSolution={row.solution ?? undefined}
                  />
                ) : (
                  <UnlinkedSolutionRow
                    key={row.solution.id}
                    solution={row.solution}
                  />
                )
              )}
            </div>
          </SortableContext>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            No files. Drag files here to add them to this type.
          </div>
        )}
      </div>
    </div>
  );
}

const RESOURCE_TYPES: Enums<'resource_type'>[] = [
  'NOTES',
  'PRACTICE_QUESTIONS',
  'TEST',
  'VIDEO',
  'EXAM',
  'FLASHCARDS',
  'REVISION_SHEET',
  'CHEAT_SHEET',
];

const fileSlotCollisionDetection: CollisionDetection = (args) => {
  const preferLinkSlots = (
    collisions: ReturnType<typeof pointerWithin>
  ) => {
    const slot = collisions.find((collision) => {
      const container = args.droppableContainers.find(
        (droppable) => droppable.id === collision.id
      );
      const type = container?.data.current?.type;
      return type === 'parent-drop' || type === 'solution-drop';
    });
    return slot ? [slot] : collisions;
  };

  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return preferLinkSlots(pointerCollisions);
  }

  return preferLinkSlots(closestCenter(args));
};

export function DraggableFilesList({
  files,
  onReorder,
  onSolutionLink,
  onSolutionUnlink,
}: DraggableFilesListProps) {
  const [localFiles, setLocalFiles] = useState(files);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group files by type
  const filesByType = useMemo(() => {
    const grouped: Record<Enums<'resource_type'>, TopicFileWithFile[]> = {
      NOTES: [],
      PRACTICE_QUESTIONS: [],
      TEST: [],
      VIDEO: [],
      EXAM: [],
      FLASHCARDS: [],
      REVISION_SHEET: [],
      CHEAT_SHEET: [],
    };

    localFiles.forEach(file => {
      // Include all files (solutions will be shown in drop zones if linked)
      grouped[file.type].push(file);
    });

    // Sort each group by index
    Object.keys(grouped).forEach(type => {
      grouped[type as Enums<'resource_type'>].sort((a, b) => a.index - b.index);
    });

    return grouped;
  }, [localFiles]);

  const handleDragStart = (_event: DragStartEvent) => {
    // Drag start handled by DnD kit
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback is handled by droppable areas
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const activeFile = localFiles.find(f => f.id === active.id);
    if (!activeFile) return;

    const overData = over.data.current;

    // Non-solution dropped onto an unlinked solution's empty parent slot
    if (overData?.type === 'parent-drop' && !activeFile.is_solutions) {
      const solutionFileId = overData.solutionFileId as string;
      onSolutionLink(solutionFileId, activeFile.id);
      setLocalFiles((prev) =>
        prev.map((file) => {
          if (file.id === solutionFileId) {
            return {
              ...file,
              is_solutions_of_id: activeFile.id,
              type: activeFile.type,
            };
          }
          if (file.is_solutions && file.is_solutions_of_id === activeFile.id) {
            return { ...file, is_solutions_of_id: null };
          }
          return file;
        })
      );
      return;
    }
    
    // Handle solution being dragged
    if (activeFile.is_solutions) {
      // Solution dropped on another solution drop zone - relink
      if (overData?.type === 'solution-drop') {
        const targetFileId = overData.targetFileId as string;
        // If it was previously linked, unlink it first
        if (activeFile.is_solutions_of_id) {
          onSolutionUnlink(activeFile.id);
        }
        // Link to new target
        onSolutionLink(activeFile.id, targetFileId);
        // Update local state
        setLocalFiles(prev => prev.map(f => 
          f.id === activeFile.id ? { ...f, is_solutions_of_id: targetFileId } : f
        ));
        return;
      }
      
      // Solution dropped on a file type section - unlink and convert to regular file
      if (overData?.type === 'file-type') {
        const newType = overData.fileType as Enums<'resource_type'>;
        const oldType = activeFile.type;
        
        // Unlink it (marks it as no longer a solution)
        onSolutionUnlink(activeFile.id);
        
        // Update to be a regular file (not a solution) and change type if needed
        setLocalFiles(prev => {
          const updated = prev.map(f => {
            if (f.id === activeFile.id) {
              return { 
                ...f, 
                type: newType,
                is_solutions: false,
                is_solutions_of_id: null,
              };
            }
            return f;
          });
          
          // Recalculate indices for the new type - defer callback to avoid setState during render
          setTimeout(() => {
            const allUpdates: Array<{ id: string; index: number; type: Enums<'resource_type'> }> = [];
            
            // Update new type files (now includes the converted solution)
            const newTypeFiles = updated.filter(f => f.type === newType && !f.is_solutions);
            newTypeFiles.forEach((file, idx) => {
              allUpdates.push({
                id: file.id,
                index: idx + 1,
                type: newType,
              });
            });
            
            // If type changed, also update old type files
            if (newType !== oldType) {
              const oldTypeFiles = updated.filter(f => f.type === oldType && !f.is_solutions);
              oldTypeFiles.forEach((file, idx) => {
                allUpdates.push({
                  id: file.id,
                  index: idx + 1,
                  type: oldType,
                });
              });
            }
            
            if (allUpdates.length > 0) {
              onReorder(allUpdates);
            }
          }, 0);
          
          return updated;
        });
        return;
      }
      
      return; // Solutions can only be dropped on solution drops or type sections
    }

    // Handle solution linking (non-solution file dropped on solution drop - shouldn't happen, but handle it)
    if (overData?.type === 'solution-drop') {
      // This shouldn't happen, but if it does, ignore it
      return;
    }

    // Handle file type change or reordering
    if (overData?.type === 'file-type') {
      const newType = overData.fileType as Enums<'resource_type'>;
      const oldType = activeFile.type;
      
      // If dropped on a type section, add to end of that type
      setLocalFiles(prev => {
        const updated = prev.map(f => {
          if (f.id === activeFile.id) {
            return { ...f, type: newType };
          }
          // If this file has solutions linked to the active file, also update solution type
          if (f.is_solutions && f.is_solutions_of_id === activeFile.id && newType !== oldType) {
            return { ...f, type: newType };
          }
          return f;
        });
        
        // Recalculate indices for both old and new types - defer callback to avoid setState during render
        setTimeout(() => {
          const allUpdates: Array<{ id: string; index: number; type: Enums<'resource_type'> }> = [];
          
          // Update new type files
          if (newType !== oldType) {
            const newTypeFiles = updated.filter(f => f.type === newType && !f.is_solutions);
            newTypeFiles.forEach((file, idx) => {
              allUpdates.push({
                id: file.id,
                index: idx + 1,
                type: newType,
              });
            });
            
            // Update old type files (to fill the gap)
            const oldTypeFiles = updated.filter(f => f.type === oldType && !f.is_solutions);
            oldTypeFiles.forEach((file, idx) => {
              allUpdates.push({
                id: file.id,
                index: idx + 1,
                type: oldType,
              });
            });
          } else {
            // Same type, just reorder
            const typeFiles = updated.filter(f => f.type === newType && !f.is_solutions);
            typeFiles.forEach((file, idx) => {
              allUpdates.push({
                id: file.id,
                index: idx + 1,
                type: newType,
              });
            });
          }
          
          if (allUpdates.length > 0) {
            onReorder(allUpdates);
          }
        }, 0);
        
        return updated;
      });
      return;
    }

    // Handle reordering within same type (only for non-solution files)
    const overFile = localFiles.find(f => f.id === over.id);
    if (!overFile || activeFile.type !== overFile.type || overFile.is_solutions) return;

    // Both files are in the same type, reorder them
    const sameTypeFiles = filesByType[activeFile.type].filter(f => !f.is_solutions);
    const oldIndex = sameTypeFiles.findIndex(f => f.id === activeFile.id);
    const newIndex = sameTypeFiles.findIndex(f => f.id === overFile.id);

    if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

    setLocalFiles(prev => {
      const reordered = arrayMove(sameTypeFiles, oldIndex, newIndex);
      
      // Generate updates with new indices - defer callback to avoid setState during render
      setTimeout(() => {
        const updates = reordered.map((file, idx) => ({
          id: file.id,
          index: idx + 1,
          type: file.type,
        }));
        
        onReorder(updates);
      }, 0);
      
      // Update local state
      const updated = [...prev];
      reordered.forEach((file, idx) => {
        const fileIndex = updated.findIndex(f => f.id === file.id);
        if (fileIndex !== -1) {
          updated[fileIndex] = { ...updated[fileIndex], index: idx + 1 };
        }
      });
      
      return updated;
    });
  };

  // Update local files when prop changes
  useEffect(() => {
    setLocalFiles(files);
  }, [files]);

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No files to display</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={fileSlotCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {RESOURCE_TYPES.map((type) => {
          const typeFiles = filesByType[type];
          
          return (
            <FileTypeSection
              key={type}
              type={type}
              files={typeFiles}
              allFiles={localFiles}
              onSolutionLink={onSolutionLink}
              onSolutionUnlink={onSolutionUnlink}
            />
          );
        })}
      </div>
    </DndContext>
  );
}
