'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { SearchableSelect } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Loader2, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { 
  useTopicsBySubject, 
  useUpdateTopicFile, 
  useTopicFileById,
  useAvailableSolutionLinks,
  useDeleteTopicFile,
} from '../hooks';
import { useToast } from '@altitutor/ui';
import type { Enums } from '@altitutor/shared';

const RESOURCE_TYPES: Array<{ value: Enums<'resource_type'>; label: string }> = [
  { value: 'NOTES', label: 'Notes' },
  { value: 'PRACTICE_QUESTIONS', label: 'Practice Questions' },
  { value: 'TEST', label: 'Test' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'EXAM', label: 'Exam' },
  { value: 'REVISION_SHEET', label: 'Revision Sheet' },
  { value: 'CHEAT_SHEET', label: 'Cheat Sheet' },
  { value: 'FLASHCARDS', label: 'Flashcards' },
];

export interface EditTopicFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicFileId: string;
  currentTopicId: string;
  currentSubjectId: string;
  onDeleted?: () => void;
}

export function EditTopicFileModal({
  isOpen,
  onClose,
  topicFileId,
  currentTopicId,
  currentSubjectId,
  onDeleted,
}: EditTopicFileModalProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(currentTopicId);
  const [selectedType, setSelectedType] = useState<Enums<'resource_type'> | null>(null);
  const [isSolutions, setIsSolutions] = useState(false);
  const [selectedSolutionLinkId, setSelectedSolutionLinkId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const { toast } = useToast();
  const { data: subjects = [] } = useSubjects();
  const { data: topics = [], isLoading: topicsLoading } = useTopicsBySubject(currentSubjectId);
  const { data: currentTopicFile } = useTopicFileById(topicFileId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );
  const updateTopicFile = useUpdateTopicFile();
  const deleteTopicFile = useDeleteTopicFile();

  // Get current subject
  const currentSubject = subjects.find((s) => s.id === currentSubjectId);

  // Initialize form when modal opens or data loads
  useEffect(() => {
    if (isOpen && currentTopicFile) {
      setSelectedTopicId(currentTopicFile.topic_id);
      setSelectedType(currentTopicFile.type);
      setIsSolutions(currentTopicFile.is_solutions || false);
      setSelectedSolutionLinkId(currentTopicFile.is_solutions_of_id || null);
    }
  }, [isOpen, currentTopicFile]);

  const handleSubmit = async () => {
    if (!selectedTopicId || !selectedType) {
      toast({
        title: 'Error',
        description: 'Please select a topic and type',
        variant: 'destructive',
      });
      return;
    }

    // Check if anything changed
    const hasChanges =
      selectedTopicId !== currentTopicId ||
      selectedType !== currentTopicFile?.type ||
      isSolutions !== (currentTopicFile?.is_solutions || false) ||
      selectedSolutionLinkId !== (currentTopicFile?.is_solutions_of_id || null);

    if (!hasChanges) {
      toast({
        title: 'No Changes',
        description: 'No changes were made',
        variant: 'default',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await updateTopicFile.mutateAsync({
        id: topicFileId,
        data: {
          topic_id: selectedTopicId,
          type: selectedType,
          is_solutions: isSolutions,
          is_solutions_of_id: isSolutions ? selectedSolutionLinkId : null,
        },
      });

      toast({
        title: 'Success',
        description: 'File updated successfully',
      });
      onClose();
    } catch (error) {
      console.error('Failed to update topic file:', error);
      toast({
        title: 'Error',
        description: 'Failed to update file',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteTopicFile.mutateAsync(topicFileId);
      setShowDeleteDialog(false);
      onClose();
      if (onDeleted) {
        onDeleted();
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
      // Error toast is handled by the mutation
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'sm:max-w-[500px]',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <DialogTitle>Edit File</DialogTitle>
            </div>
            <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Subject (Read-only) */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={currentSubject?.long_name ?? 'Loading...'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Topic Selector */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic *</Label>
            <SearchableSelect<typeof topics[number]>
              items={topics}
              value={topics.find((t) => t.id === selectedTopicId) ?? null}
              onValueChange={(item) => setSelectedTopicId(item?.id ?? '')}
              getItemLabel={(t) => `${t.code || ''} - ${t.name}`}
              getItemId={(t) => t.id}
              getItemValue={(t) => `${t.code || ''} ${t.name}`}
              placeholder="Select topic"
              disabled={topicsLoading}
              loading={topicsLoading}
              emptyMessage="No topics found"
            />
          </div>

          {/* Type Selector */}
          <div className="space-y-2">
            <Label htmlFor="type">Type *</Label>
            <SearchableSelect<(typeof RESOURCE_TYPES)[number]>
              items={[...RESOURCE_TYPES]}
              value={
                selectedType
                  ? RESOURCE_TYPES.find((t) => t.value === selectedType) ?? null
                  : null
              }
              onValueChange={(item) => setSelectedType(item?.value ?? null)}
              getItemLabel={(t) => t.label}
              getItemId={(t) => t.value}
              placeholder="Select type"
            />
          </div>

          {/* Solutions Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_solutions"
              checked={isSolutions}
              onCheckedChange={(checked) => {
                setIsSolutions(checked as boolean);
                if (!checked) {
                  setSelectedSolutionLinkId(null);
                }
              }}
            />
            <Label htmlFor="is_solutions" className="cursor-pointer">
              This is a solutions file
            </Label>
          </div>

          {/* Solution Link Selector */}
          {isSolutions && (
            <div className="space-y-2">
              <Label htmlFor="solution_link">Link to File *</Label>
              <SearchableSelect<typeof availableSolutionLinks[number]>
                items={availableSolutionLinks}
                value={
                  selectedSolutionLinkId
                    ? availableSolutionLinks.find((l) => l.id === selectedSolutionLinkId) ?? null
                    : null
                }
                onValueChange={(item) => setSelectedSolutionLinkId(item?.id ?? null)}
                getItemLabel={(l) => l.file?.filename || 'Unknown file'}
                getItemId={(l) => l.id}
                placeholder="Select file to link to"
                emptyMessage="No files available to link"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="destructive"
            onClick={() => setShowDeleteDialog(true)}
            disabled={isSubmitting || deleteTopicFile.isPending}
          >
            {deleteTopicFile.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting || deleteTopicFile.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedTopicId || !selectedType || (isSolutions && !selectedSolutionLinkId) || deleteTopicFile.isPending}
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the file record, topic file link, and the file from storage.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTopicFile.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTopicFile.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTopicFile.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
