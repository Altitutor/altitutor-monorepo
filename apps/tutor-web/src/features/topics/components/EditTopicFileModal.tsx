'use client';

import { useState, useEffect, useMemo } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { formatSubjectDisplay } from '@/shared/utils';
import { useSubjects } from '@/features/subjects/hooks/useSubjectsQuery';
import { 
  useTopicsBySubject, 
  useUpdateTopicFile, 
  useTopicFileById,
  useAvailableSolutionLinks 
} from '../hooks';
import { deriveTopicCode } from '../utils/codes';
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
}

export function EditTopicFileModal({
  isOpen,
  onClose,
  topicFileId,
  currentTopicId,
  currentSubjectId,
}: EditTopicFileModalProps) {
  const [selectedTopicId, setSelectedTopicId] = useState<string>(currentTopicId);
  const [selectedType, setSelectedType] = useState<Enums<'resource_type'> | null>(null);
  const [isSolutions, setIsSolutions] = useState(false);
  const [selectedSolutionLinkId, setSelectedSolutionLinkId] = useState<string | null>(null);
  const [topicSearchQuery, setTopicSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects();
  const { data: topics = [], isLoading: topicsLoading } = useTopicsBySubject(currentSubjectId);
  const { data: currentTopicFile } = useTopicFileById(topicFileId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );
  const updateTopicFile = useUpdateTopicFile();

  // Get current subject
  const currentSubject = subjects.find((s) => s.id === currentSubjectId);

  // Filter topics based on search query
  const filteredTopics = useMemo(() => {
    if (!topicSearchQuery) return topics;

    const query = topicSearchQuery.toLowerCase();
    return topics.filter((topic) => {
      const topicCode = deriveTopicCode(topic, topics);
      return (
        topic.name.toLowerCase().includes(query) ||
        topicCode.toLowerCase().includes(query)
      );
    });
  }, [topics, topicSearchQuery]);

  // Initialize form when modal opens or data loads
  useEffect(() => {
    if (isOpen && currentTopicFile) {
      setSelectedTopicId(currentTopicFile.topic_id);
      setSelectedType(currentTopicFile.type);
      setIsSolutions(currentTopicFile.is_solutions || false);
      setSelectedSolutionLinkId(currentTopicFile.is_solutions_of_id || null);
      setTopicSearchQuery('');
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Subject (Read-only) */}
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input
              value={currentSubject ? formatSubjectDisplay(currentSubject) : 'Loading...'}
              disabled
              className="bg-muted"
            />
          </div>

          {/* Topic Selector */}
          <div className="space-y-2">
            <Label htmlFor="topic">Topic *</Label>
            <Select
              value={selectedTopicId}
              onValueChange={setSelectedTopicId}
              disabled={topicsLoading}
            >
              <SelectTrigger id="topic">
                <SelectValue placeholder="Select topic" />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search topics..."
                    value={topicSearchQuery}
                    onChange={(e) => setTopicSearchQuery(e.target.value)}
                    className="h-8"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {topicsLoading ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                    Loading topics...
                  </div>
                ) : filteredTopics.length === 0 ? (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    No topics found
                  </div>
                ) : (
                  filteredTopics.map((topic) => {
                    const topicCode = deriveTopicCode(topic, topics);
                    return (
                      <SelectItem key={topic.id} value={topic.id}>
                        {topicCode} - {topic.name}
                      </SelectItem>
                    );
                  })
                )}
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
                {RESOURCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              <Select
                value={selectedSolutionLinkId || ''}
                onValueChange={setSelectedSolutionLinkId}
              >
                <SelectTrigger id="solution_link">
                  <SelectValue placeholder="Select file to link to" />
                </SelectTrigger>
                <SelectContent>
                  {availableSolutionLinks.length === 0 ? (
                    <div className="p-2 text-center text-sm text-muted-foreground">
                      No files available to link
                    </div>
                  ) : (
                    availableSolutionLinks.map((link) => (
                      <SelectItem key={link.id} value={link.id}>
                        {link.file?.filename || 'Unknown file'}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedTopicId || !selectedType || (isSolutions && !selectedSolutionLinkId)}
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
