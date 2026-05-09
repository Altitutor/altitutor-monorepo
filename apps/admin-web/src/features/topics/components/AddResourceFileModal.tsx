'use client';

import React, { useState, useEffect } from 'react';
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
import { Input } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { Loader2, X, GripVertical, Upload } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { Enums } from '@altitutor/shared';
import { useToast } from '@altitutor/ui';
import { filesApi } from '../api';
import { useFileItems, useFileUploadFlow, useFileDragAndDrop, useCreateTopicFile } from '../hooks';
import { validateFileSizes } from '../utils/fileItemHelpers';
import { FileDropzone } from './AddResourceFileModal/FileDropzone';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { DroppableColumn } from './AddResourceFileModal/DroppableColumn';
import { DroppableSolutionSlot } from './AddResourceFileModal/DroppableSolutionSlot';
import { ResourceFileMetadata } from './AddResourceFileModal/ResourceFileMetadata';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface AddResourceFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSubjectId?: string;
  preselectedTopicId?: string;
  onResourceAdded?: () => void;
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
  const [expanded, setExpanded] = useState(false);
  const [videoUseExternalLink, setVideoUseExternalLink] = useState(false);
  const [externalVideoTitle, setExternalVideoTitle] = useState('');
  const [externalVideoUrl, setExternalVideoUrl] = useState('');
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const { toast } = useToast();
  const createTopicFileMutation = useCreateTopicFile();

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (selectedType !== 'VIDEO') {
      setVideoUseExternalLink(false);
      setExternalVideoTitle('');
      setExternalVideoUrl('');
    }
  }, [selectedType]);

  const {
    fileItems,
    regularFiles,
    solutionFiles,
    addFiles,
    removeFile,
    updateFileSolution,
    reorderFiles,
    clearFiles,
  } = useFileItems();

  const { isUploading, uploadFiles } = useFileUploadFlow({
    onSuccess: () => {
      if (onResourceAdded) {
        onResourceAdded();
      }
      onClose();
    },
    onError: (error) => {
      console.error('Failed to add resource file:', error);
    },
  });

  const { activeId, handleDragStart, handleDragEnd } = useFileDragAndDrop({
    fileItems,
    updateFileSolution,
    reorderFiles,
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
      clearFiles();
      setVideoUseExternalLink(false);
      setExternalVideoTitle('');
      setExternalVideoUrl('');
    }
  }, [isOpen, preselectedSubjectId, preselectedTopicId, clearFiles]);

  const handleFileDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setVideoUseExternalLink(false);

    // Validate file sizes
    const oversizedFiles = validateFileSizes(acceptedFiles, MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed 10MB limit: ${oversizedFiles.map((f) => f.name).join(', ')}`);
      return;
    }

    addFiles(acceptedFiles);
  };

  const handleSubmit = async () => {
    if (!selectedSubjectId || !selectedTopicId || !selectedType) {
      return;
    }

    if (selectedType === 'VIDEO' && videoUseExternalLink) {
      if (!externalVideoTitle.trim() || !externalVideoUrl.trim()) {
        return;
      }
      try {
        setLinkSubmitting(true);
        const fileRecord = await filesApi.createExternalUrlFile({
          displayName: externalVideoTitle.trim(),
          externalUrl: externalVideoUrl.trim(),
          requireVideoEmbed: true,
        });
        await createTopicFileMutation.mutateAsync({
          topic_id: selectedTopicId,
          type: selectedType,
          file_id: fileRecord.id,
          is_solutions: isSolutions,
          is_solutions_of_id: isSolutions ? selectedSolutionOfId : null,
        });
        onResourceAdded?.();
        onClose();
      } catch (error) {
        console.error('Failed to add external video:', error);
        toast({
          title: 'Could not add video',
          description: error instanceof Error ? error.message : 'Something went wrong',
          variant: 'destructive',
        });
      } finally {
        setLinkSubmitting(false);
      }
      return;
    }

    if (fileItems.length === 0) {
      return;
    }

    const hasSolutionRelationships = fileItems.some((f) => f.solutionOfId);

    await uploadFiles({
      fileItems,
      subjectId: selectedSubjectId,
      topicId: selectedTopicId,
      type: selectedType,
      isSolutions: hasSolutionRelationships ? undefined : isSolutions,
      solutionOfId: hasSolutionRelationships ? undefined : selectedSolutionOfId,
    });
  };

  const externalVideoReady =
    selectedType === 'VIDEO' &&
    videoUseExternalLink &&
    Boolean(externalVideoTitle.trim()) &&
    Boolean(externalVideoUrl.trim());

  const canSubmit =
    Boolean(selectedSubjectId && selectedTopicId && selectedType) &&
    (externalVideoReady || fileItems.length > 0);

  const hasMultipleFiles = fileItems.length > 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Add Resource File</DialogTitle>
              <DialogDescription>
                Upload a file and link it to a topic. Maximum file size: 10MB.
              </DialogDescription>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            {/* Left Column - Metadata */}
            <div className="w-80 border-r flex-shrink-0 overflow-y-auto p-6 space-y-6">
              <ResourceFileMetadata
                selectedSubjectId={selectedSubjectId}
                selectedTopicId={selectedTopicId}
                selectedType={selectedType}
                isSolutions={isSolutions}
                selectedSolutionOfId={selectedSolutionOfId}
                preselectedSubjectId={preselectedSubjectId}
                preselectedTopicId={preselectedTopicId}
                hasMultipleFiles={hasMultipleFiles}
                onSubjectIdChange={setSelectedSubjectId}
                onTopicIdChange={setSelectedTopicId}
                onTypeChange={setSelectedType}
                onIsSolutionsChange={setIsSolutions}
                onSolutionOfIdChange={setSelectedSolutionOfId}
              />
            </div>

            {/* Right Column - Files */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {selectedType === 'VIDEO' ? (
                  <div className="space-y-3 rounded-lg border p-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="video-external-link"
                        checked={videoUseExternalLink}
                        onCheckedChange={(c) => {
                          const on = c === true;
                          setVideoUseExternalLink(on);
                          if (on) clearFiles();
                        }}
                      />
                      <Label htmlFor="video-external-link" className="font-normal cursor-pointer">
                        Use YouTube or Vimeo link instead of uploading a file
                      </Label>
                    </div>
                    {videoUseExternalLink ? (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                          <Label htmlFor="external-video-title">Display title *</Label>
                          <Input
                            id="external-video-title"
                            value={externalVideoTitle}
                            onChange={(e) => setExternalVideoTitle(e.target.value)}
                            placeholder="e.g. Introduction to quadratics"
                            disabled={isUploading || linkSubmitting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="external-video-url">Video URL *</Label>
                          <Input
                            id="external-video-url"
                            value={externalVideoUrl}
                            onChange={(e) => setExternalVideoUrl(e.target.value)}
                            placeholder="https://www.youtube.com/watch?v=… or Vimeo link"
                            disabled={isUploading || linkSubmitting}
                          />
                          <p className="text-xs text-muted-foreground">
                            Paste a watch or share link. Students will see an embedded player on the resources page.
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <Label>
                    {videoUseExternalLink && selectedType === 'VIDEO'
                      ? 'File upload (optional — disabled while using link)'
                      : `File${hasMultipleFiles ? 's' : ''} *`}
                  </Label>
                  {videoUseExternalLink && selectedType === 'VIDEO' ? (
                    <p className="text-sm text-muted-foreground">
                      Uncheck &quot;Use YouTube or Vimeo link&quot; to upload an MP4 or other file instead.
                    </p>
                  ) : fileItems.length === 0 ? (
                    <FileDropzone
                      onDrop={handleFileDrop}
                      maxSize={MAX_FILE_SIZE}
                      hasMultipleFiles={hasMultipleFiles}
                    />
                  ) : hasMultipleFiles ? (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={fileItems.map((f) => f.id)}
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
                              isUploading={isUploading}
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
                                        isUploading={isUploading}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                          <FileDropzone
                            onDrop={handleFileDrop}
                            maxSize={MAX_FILE_SIZE}
                            hasMultipleFiles={hasMultipleFiles}
                          />
                        </div>
                      </SortableContext>
                      <DragOverlay>
                        {activeId ? (() => {
                          const activeFile = fileItems.find((f) => f.id === activeId);
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
                          <p className="text-sm font-medium">{fileItems[0].file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(fileItems[0].file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => clearFiles()}
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
          <Button type="button" variant="outline" onClick={onClose} disabled={isUploading || linkSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || isUploading || linkSubmitting}>
            {(isUploading || linkSubmitting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Resource
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
