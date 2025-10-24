'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Loader2, Upload, X } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: subjects = [] } = useSubjects();
  const { data: topics = [] } = useTopicsBySubject(selectedSubjectId);
  const { data: availableSolutionLinks = [] } = useAvailableSolutionLinks(
    selectedTopicId,
    selectedType
  );
  
  const uploadFileMutation = useUploadFile();
  const createTopicFileMutation = useCreateTopicFile();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      if (file.size > MAX_FILE_SIZE) {
        alert('File size exceeds 10MB limit');
        return;
      }
      setUploadedFile(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedSubjectId(preselectedSubjectId || null);
      setSelectedTopicId(preselectedTopicId || null);
      setSelectedType(null);
      setIsSolutions(false);
      setSelectedSolutionOfId(null);
      setUploadedFile(null);
    }
  }, [isOpen, preselectedSubjectId, preselectedTopicId]);

  const handleSubmit = async () => {
    if (!uploadedFile || !selectedSubjectId || !selectedTopicId || !selectedType) {
      return;
    }

    try {
      setIsUploading(true);

      // Upload file to storage and create file record
      const fileRecord = await uploadFileMutation.mutateAsync({
        subjectId: selectedSubjectId,
        topicId: selectedTopicId,
        file: uploadedFile,
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
  };

  const canSubmit =
    uploadedFile &&
    selectedSubjectId &&
    selectedTopicId &&
    selectedType &&
    (!isSolutions || selectedSolutionOfId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Add Resource File</DialogTitle>
          <DialogDescription>
            Upload a file and link it to a topic. Maximum file size: 10MB.
          </DialogDescription>
        </DialogHeader>

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
                {subjects.map((subject) => (
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

          {/* Solutions Checkbox */}
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

          {/* File Upload Area */}
          <div className="space-y-2">
            <Label>File *</Label>
            {!uploadedFile ? (
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
                  <p className="text-sm">Drop the file here...</p>
                ) : (
                  <>
                    <p className="text-sm mb-1">Drag and drop a file here, or click to select</p>
                    <p className="text-xs text-muted-foreground">Maximum file size: 10MB</p>
                  </>
                )}
              </div>
            ) : (
              <div className="border rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{uploadedFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadedFile(null)}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
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

