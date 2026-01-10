'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Loader2, Upload, X, GripVertical } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
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
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { useTopicsBySubject, useCreateTopicFile, useAvailableSolutionLinks, useUploadFile } from '../hooks';
import { formatSubjectDisplay } from '@/shared/utils';
import type { Enums } from '@altitutor/shared';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

interface FileItem {
  id: string;
  file: File;
  index: number;
  solutionOfId: string | null; // ID of the file this is a solution for
}

export interface AddResourceFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSubjectId?: string;
  preselectedTopicId?: string;
  onResourceAdded?: () => void;
}

/**
 * Parse file names to detect solution relationships
 */
function parseFileRelationships(files: File[]): Map<string, string | null> {
  const solutionMap = new Map<string, string | null>();
  
  // Initialize all files with no solution relationship
  files.forEach((file) => {
    solutionMap.set(file.name, null);
  });

  // Check for STUDENT pattern
  // If one filename contains the other and one has "STUDENT", 
  // the STUDENT file is the file, other is solution
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      const name1 = file1.name.toLowerCase();
      const name2 = file2.name.toLowerCase();
      
      // Remove file extensions for comparison
      const base1 = name1.replace(/\.[^/.]+$/, '');
      const base2 = name2.replace(/\.[^/.]+$/, '');
      
      const hasStudent1 = name1.includes('student');
      const hasStudent2 = name2.includes('student');
      
      if (hasStudent1 && !hasStudent2 && (base1.includes(base2) || base2.includes(base1))) {
        // file1 has STUDENT, so file2 is the solution
        solutionMap.set(file2.name, file1.name);
      } else if (hasStudent2 && !hasStudent1 && (base1.includes(base2) || base2.includes(base1))) {
        // file2 has STUDENT, so file1 is the solution
        solutionMap.set(file1.name, file2.name);
      }
    }
  }

  // Check for SOL/ANS pattern
  // If one filename contains the other and one has "SOL" or "ANS",
  // that one is the solution
  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const file1 = files[i];
      const file2 = files[j];
      const name1 = file1.name.toLowerCase();
      const name2 = file2.name.toLowerCase();
      
      // Remove file extensions for comparison
      const base1 = name1.replace(/\.[^/.]+$/, '');
      const base2 = name2.replace(/\.[^/.]+$/, '');
      
      const hasSolAns1 = /\b(sol|ans)\b/.test(name1);
      const hasSolAns2 = /\b(sol|ans)\b/.test(name2);
      
      if (hasSolAns1 && !hasSolAns2 && (base1.includes(base2) || base2.includes(base1))) {
        // file1 has SOL/ANS, so it's the solution for file2
        solutionMap.set(file1.name, file2.name);
      } else if (hasSolAns2 && !hasSolAns1 && (base1.includes(base2) || base2.includes(base1))) {
        // file2 has SOL/ANS, so it's the solution for file1
        solutionMap.set(file2.name, file1.name);
      }
    }
  }

  return solutionMap;
}

export function AddResourceFileModal({
  isOpen,
  onClose,
  preselectedSubjectId,
  preselectedTopicId,
  onResourceAdded,
}: AddResourceFileModalProps) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(
    preselectedSubjectId || null
  );
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(
    preselectedTopicId || null
  );
  const [selectedType, setSelectedType] = useState<Enums<'resource_type'> | null>(null);
  const [isSolutions, setIsSolutions] = useState(false);
  const [selectedSolutionOfId, setSelectedSolutionOfId] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);

  const { data: subjects = [] } = useSubjects();
  const { data: topics = [] } = useTopicsBySubject(selectedSubjectId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );
  
  const uploadFileMutation = useUploadFile();
  const createTopicFileMutation = useCreateTopicFile();

  // Filter subjects based on search query
  const filteredSubjects = useMemo(() => {
    if (!subjectSearchQuery) return subjects;
    
    const query = subjectSearchQuery.toLowerCase();
    return subjects.filter((subject) => {
      const displayText = formatSubjectDisplay(subject).toLowerCase();
      return displayText.includes(query) || subject.name.toLowerCase().includes(query);
    });
  }, [subjects, subjectSearchQuery]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // Validate file sizes
    const oversizedFiles = acceptedFiles.filter((file) => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    // Parse file relationships
    const solutionMap = parseFileRelationships(acceptedFiles);

    // Sort files by name initially
    const sortedFiles = [...acceptedFiles].sort((a, b) => a.name.localeCompare(b.name));

    // Create file items with initial order and solution relationships
    const timestamp = Date.now();
    const newFileItems: FileItem[] = sortedFiles.map((file, index) => {
      const solutionForName = solutionMap.get(file.name);
      const solutionForItem = solutionForName
        ? sortedFiles.find((f) => f.name === solutionForName)
        : null;

      const fileId = `${file.name}-${file.size}-${timestamp}-${index}`;
      const solutionForId = solutionForItem
        ? `${solutionForItem.name}-${solutionForItem.size}-${timestamp}-${sortedFiles.indexOf(solutionForItem)}`
        : null;

      return {
        id: fileId,
        file,
        index: index + 1,
        solutionOfId: solutionForId,
      };
    });

    // If we already have files, append new ones
    setUploadedFiles((prev) => {
      const maxIndex = prev.length > 0 ? Math.max(...prev.map((f) => f.index)) : 0;
      const updatedNewItems = newFileItems.map((item, idx) => ({
        ...item,
        index: maxIndex + idx + 1,
      }));
      return [...prev, ...updatedNewItems];
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: MAX_FILE_SIZE,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedSubjectId(preselectedSubjectId || null);
      setSelectedTopicId(preselectedTopicId || null);
      setSelectedType(null);
      setIsSolutions(false);
      setSelectedSolutionOfId(null);
      setUploadedFiles([]);
    }
  }, [isOpen, preselectedSubjectId, preselectedTopicId]);

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0 || !selectedSubjectId || !selectedTopicId || !selectedType) {
      return;
    }

    // Handle single file case (backward compatibility)
    if (uploadedFiles.length === 1) {
      const fileItem = uploadedFiles[0];
      if (!selectedSubjectId || !selectedTopicId || !selectedType) {
        return;
      }

      try {
        setIsUploading(true);

        // Upload file to storage and create file record
        const fileRecord = await uploadFileMutation.mutateAsync({
          subjectId: selectedSubjectId,
          topicId: selectedTopicId,
          file: fileItem.file,
        });

        // Create topic_files link
        await createTopicFileMutation.mutateAsync({
          topic_id: selectedTopicId,
          type: selectedType,
          file_id: fileRecord.id,
          is_solutions: isSolutions,
          is_solutions_of_id: isSolutions ? selectedSolutionOfId : null,
        });

        if (onResourceAdded) {
          onResourceAdded();
        }

        onClose();
      } catch (error) {
        console.error('Failed to add resource file:', error);
      } finally {
        setIsUploading(false);
      }
      return;
    }

    // Handle multiple files case
    try {
      setIsUploading(true);

      // Sort files by index
      const sortedFiles = [...uploadedFiles].sort((a, b) => a.index - b.index);

      // Separate regular files and solution files
      const regularFileItems = sortedFiles.filter((f) => !f.solutionOfId);
      const solutionFileItems = sortedFiles.filter((f) => f.solutionOfId);

      // Step 1: Upload all files
      const uploadPromises = sortedFiles.map(async (fileItem) => {
        const fileRecord = await uploadFileMutation.mutateAsync({
          subjectId: selectedSubjectId,
          topicId: selectedTopicId,
          file: fileItem.file,
        });
        return {
          fileRecord,
          fileItem,
        };
      });

      const uploadResults = await Promise.all(uploadPromises);

      // Create a map of file item IDs to file records
      const fileItemIdToFileRecord = new Map<string, typeof uploadResults[0]>();
      uploadResults.forEach((result) => {
        fileItemIdToFileRecord.set(result.fileItem.id, result);
      });

      // Step 2: Create topic_files for regular files first
      const fileItemIdToTopicFileId = new Map<string, string>();

      for (const fileItem of regularFileItems) {
        const uploadResult = fileItemIdToFileRecord.get(fileItem.id);
        if (uploadResult) {
          const topicFile = await createTopicFileMutation.mutateAsync({
            topic_id: selectedTopicId,
            type: selectedType,
            file_id: uploadResult.fileRecord.id,
            is_solutions: false,
            is_solutions_of_id: null,
          });
          fileItemIdToTopicFileId.set(fileItem.id, topicFile.id);
        }
      }

      // Step 3: Create topic_files for solution files
      for (const solutionItem of solutionFileItems) {
        const uploadResult = fileItemIdToFileRecord.get(solutionItem.id);
        const targetTopicFileId = fileItemIdToTopicFileId.get(solutionItem.solutionOfId!);

        if (uploadResult && targetTopicFileId) {
          await createTopicFileMutation.mutateAsync({
            topic_id: selectedTopicId,
            type: selectedType,
            file_id: uploadResult.fileRecord.id,
            is_solutions: true,
            is_solutions_of_id: targetTopicFileId,
          });
        }
      }

      if (onResourceAdded) {
        onResourceAdded();
      }

      onClose();
    } catch (error) {
      console.error('Failed to add resource files:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const canSubmit =
    uploadedFiles.length > 0 &&
    selectedSubjectId &&
    selectedTopicId &&
    selectedType;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dropping in solutions column
    if (overId.startsWith('solutions-column-')) {
      const fileItem = uploadedFiles.find((f) => f.id === activeId);
      if (fileItem) {
        // Extract the target file ID from the droppable ID
        const targetFileId = overId.replace('solutions-column-', '');
        // Make sure the target file exists and is not the same as the dragged file
        const targetFile = uploadedFiles.find((f) => f.id === targetFileId);
        if (targetFile && targetFile.id !== activeId) {
          setUploadedFiles((prev) =>
            prev.map((item) =>
              item.id === activeId
                ? { ...item, solutionOfId: targetFileId }
                : item
            )
          );
        }
      }
      return;
    }

    // Check if dropping back to files column
    if (overId === 'files-column') {
      setUploadedFiles((prev) =>
        prev.map((item) =>
          item.id === activeId ? { ...item, solutionOfId: null } : item
        )
      );
      return;
    }

    // Reorder files (only if both are regular files or both are solution files for the same target)
    const activeFile = uploadedFiles.find((f) => f.id === activeId);
    const overFile = uploadedFiles.find((f) => f.id === overId);

    if (!activeFile || !overFile) return;

    // Only allow reordering within the same column type
    const activeIsSolution = !!activeFile.solutionOfId;
    const overIsSolution = !!overFile.solutionOfId;

    // If dropping a solution file on another solution file, only allow if they're solutions for the same file
    if (activeIsSolution && overIsSolution) {
      if (activeFile.solutionOfId === overFile.solutionOfId) {
        // Reorder solution files for the same target
        const targetId = activeFile.solutionOfId;
        const solutionFilesForTarget = uploadedFiles
          .filter((f) => f.solutionOfId === targetId)
          .sort((a, b) => a.index - b.index);
        const otherFiles = uploadedFiles.filter((f) => f.solutionOfId !== targetId);

        const oldIndex = solutionFilesForTarget.findIndex((f) => f.id === activeId);
        const newIndex = solutionFilesForTarget.findIndex((f) => f.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = arrayMove(solutionFilesForTarget, oldIndex, newIndex);
          const updated = reordered.map((item, idx) => ({
            ...item,
            index: idx + 1,
          }));
          setUploadedFiles([...otherFiles, ...updated]);
        }
      }
      return;
    }

    // If dropping a regular file on another regular file, reorder
    if (!activeIsSolution && !overIsSolution) {
      const oldIndex = uploadedFiles.findIndex((f) => f.id === activeId);
      const newIndex = uploadedFiles.findIndex((f) => f.id === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(uploadedFiles, oldIndex, newIndex);
        // Update indices
        const updated = reordered.map((item, idx) => ({
          ...item,
          index: idx + 1,
        }));
        setUploadedFiles(updated);
      }
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      // Re-index remaining files
      return filtered.map((item, idx) => ({
        ...item,
        index: idx + 1,
      }));
    });
  };

  const hasMultipleFiles = uploadedFiles.length > 1;

  // Sortable File Item Component
  interface SortableFileItemProps {
    fileItem: FileItem;
    onRemove: (id: string) => void;
  }

  function SortableFileItem({ fileItem, onRemove }: SortableFileItemProps) {
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

  // Droppable Column Component
  interface DroppableColumnProps {
    id: string;
    title: string;
    fileItems: FileItem[];
    onRemove: (id: string) => void;
  }

  function DroppableColumn({ id, title, fileItems, onRemove }: DroppableColumnProps) {
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
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Sortable Solution Item Component
  interface SortableSolutionItemProps {
    solutionItem: FileItem;
    onRemove: (id: string) => void;
  }

  function SortableSolutionItem({ solutionItem, onRemove }: SortableSolutionItemProps) {
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

  // Droppable Solution Slot Component (for solutions column next to each file)
  interface DroppableSolutionSlotProps {
    fileItem: FileItem;
    solutionItem: FileItem | undefined;
    onRemove: (id: string) => void;
  }

  function DroppableSolutionSlot({
    fileItem,
    solutionItem,
    onRemove,
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
          <SortableSolutionItem solutionItem={solutionItem} onRemove={onRemove} />
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

  // Group files by whether they're solutions or not
  const regularFiles = uploadedFiles.filter((f) => !f.solutionOfId);
  const solutionFiles = uploadedFiles.filter((f) => f.solutionOfId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>Add Resource File</DialogTitle>
          <DialogDescription>
            Upload a file and link it to a topic. Maximum file size: 10MB.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            {/* Left Column - Metadata */}
            <div className="w-80 border-r flex-shrink-0 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
          {/* Subject Selector */}
          <div className="space-y-2">
            <Label htmlFor="subject">Subject *</Label>
            <Select
              value={selectedSubjectId || ''}
              onValueChange={(value) => {
                setSelectedSubjectId(value);
                setSelectedTopicId(null); // Reset topic when subject changes
              }}
              disabled={!!preselectedSubjectId}
            >
              <SelectTrigger id="subject">
                <SelectValue placeholder="Select subject" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <input
                    type="text"
                    placeholder="Search subjects..."
                    value={subjectSearchQuery}
                    onChange={(e) => setSubjectSearchQuery(e.target.value)}
                    className="h-8 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {filteredSubjects.map((subject) => (
                  <SelectItem key={subject.id} value={subject.id}>
                    {formatSubjectDisplay(subject)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Topic Selector */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic *</Label>
            <Select
              value={selectedTopicId || ''}
              onValueChange={setSelectedTopicId}
              disabled={!selectedSubjectId || !!preselectedTopicId}
            >
              <SelectTrigger id="topic">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                {topics.map((topic) => (
                  <SelectItem key={topic.id} value={topic.id}>
                    {topic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <Select
              value={selectedType || ''}
              onValueChange={(value) => setSelectedType(value as Enums<'resource_type'>)}
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPES.map((type: Enums<'resource_type'>) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Solutions Checkbox - Only show when single file */}
          {!hasMultipleFiles && (
            <>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="is_solutions"
                  checked={isSolutions}
                  onCheckedChange={(checked) => {
                    setIsSolutions(checked as boolean);
                    if (!checked) {
                      setSelectedSolutionOfId(null);
                    }
                  }}
                />
                <Label htmlFor="is_solutions" className="cursor-pointer">
                  This is a solutions file
                </Label>
              </div>

              {/* Solutions Link Selector */}
              {isSolutions && selectedTopicId && selectedType && (
                <div className="space-y-2">
                  <Label htmlFor="solutions_of">Solutions For *</Label>
                  <Select
                    value={selectedSolutionOfId || ''}
                    onValueChange={setSelectedSolutionOfId}
                  >
                    <SelectTrigger id="solutions_of">
                      <SelectValue placeholder="Select file this is solutions for" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSolutionLinks.map((tf) => (
                        <SelectItem key={tf.id} value={tf.id}>
                          {selectedType} - Index {tf.index}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

              </div>
            </div>

            {/* Right Column - Files */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>File{hasMultipleFiles ? 's' : ''} *</Label>
                  {uploadedFiles.length === 0 ? (
                    <div
                      {...getRootProps()}
                      className={`
                        border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        transition-colors
                        ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                      `}
                    >
                      <input {...getInputProps()} />
                      <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                      {isDragActive ? (
                        <p className="text-sm">Drop the file{hasMultipleFiles ? 's' : ''} here...</p>
                      ) : (
                        <>
                          <p className="text-sm mb-1">
                            Drag and drop file{hasMultipleFiles ? 's' : ''} here, or click to select
                          </p>
                          <p className="text-xs text-muted-foreground">Maximum file size: 10MB per file</p>
                        </>
                      )}
                    </div>
                  ) : hasMultipleFiles ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={uploadedFiles.map((f) => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            {/* Files Column */}
                            <DroppableColumn
                              id="files-column"
                              title="Files"
                              fileItems={regularFiles}
                              onRemove={removeFile}
                            />

                            {/* Solutions Column */}
                            <div className="flex-1 space-y-2">
                              <Label>Solutions</Label>
                              <div className="space-y-2">
                                {regularFiles.map((fileItem) => {
                                  const solutionItem = solutionFiles.find(
                                    (s) => s.solutionOfId === fileItem.id
                                  );
                                  return (
                                    <div key={fileItem.id} className="space-y-1">
                                      <div className="text-xs text-muted-foreground px-1">
                                        {fileItem.file.name}
                                      </div>
                                      <DroppableSolutionSlot
                                        fileItem={fileItem}
                                        solutionItem={solutionItem}
                                        onRemove={removeFile}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <div
                            {...getRootProps()}
                            className={`
                              border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
                              transition-colors
                              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                            `}
                          >
                            <input {...getInputProps()} />
                            <p className="text-sm text-muted-foreground">
                              Add more files
                            </p>
                          </div>
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeId ? (() => {
                          const activeFile = uploadedFiles.find((f) => f.id === activeId);
                          return activeFile ? (
                            <div className="flex items-center gap-2 p-3 border rounded-lg bg-background shadow-lg opacity-90">
                              <GripVertical className="h-5 w-5 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{activeFile.file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(activeFile.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                              </div>
                            </div>
                          ) : null;
                        })() : null}
                      </DragOverlay>
                    </DndContext>
                  ) : (
                    <div className="border rounded-lg p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Upload className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{uploadedFiles[0].file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(uploadedFiles[0].file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setUploadedFiles([])}
                        disabled={isUploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isUploading}>
            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

