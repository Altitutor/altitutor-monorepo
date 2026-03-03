'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { useToast } from '@altitutor/ui';
import { useCreateTemplate, useUpdateTemplate } from '../../api/templates';
import { useSampleStudents, useStudentClassesForTemplate } from '../../hooks/useTemplatePreviewData';
import { useCurrentStaff } from '@/shared/hooks';
import type { Tables } from '@altitutor/shared';
import { getErrorMessage } from '@/shared/utils';

interface CreateEditTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Tables<'message_templates'> | null;
  onSuccess?: () => void;
}

export function CreateEditTemplateDialog({
  isOpen,
  onClose,
  template,
  onSuccess,
}: CreateEditTemplateDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  useCurrentStaff(); // Reserved for template variable replacement

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const { data: sampleStudents = [], isLoading: isLoadingStudents } = useSampleStudents(isOpen);
  const { isLoading: isLoadingClasses } = useStudentClassesForTemplate(selectedStudentId || null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize form when dialog opens or template changes
  useEffect(() => {
    if (isOpen) {
      if (template) {
        setName(template.name);
        setContent(template.content);
      } else {
        setName('');
        setContent('');
      }
    }
  }, [isOpen, template]);

  // Auto-focus on name input when creating, content when editing
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (template) {
          contentTextareaRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, template]);

  // Set first student as default when students load
  useEffect(() => {
    if (sampleStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(sampleStudents[0].id);
    }
  }, [sampleStudents, selectedStudentId]);

  const handleInsertVariable = (variable: string) => {
    const textarea = contentTextareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = content.substring(0, start);
    const textAfter = content.substring(end);
    const newContent = textBefore + `{${variable}}` + textAfter;
    
    setContent(newContent);
    
    // Restore cursor position after variable insertion
    setTimeout(() => {
      const newPosition = start + variable.length + 2; // +2 for { and }
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in both name and content fields.',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (template) {
        // Update existing template
        await updateMutation.mutateAsync({
          id: template.id,
          updates: { name: name.trim(), content: content.trim() },
        });
        toast({
          title: 'Success',
          description: 'Template updated successfully.',
        });
      } else {
        // Create new template
        await createMutation.mutateAsync({
          name: name.trim(),
          content: content.trim(),
        });
        toast({
          title: 'Success',
          description: 'Template created successfully.',
        });
      }
      
      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to save template. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + S to save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  const selectedStudent = useMemo(() => {
    return sampleStudents.find(s => s.id === selectedStudentId);
  }, [sampleStudents, selectedStudentId]);

  const previewMessage = useMemo(() => {
    if (!selectedStudent || !content) return content;
    // Note: Variable replacement happens elsewhere; return content as-is for now
    return content;
  }, [content, selectedStudent]);

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const characterCount = content.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden" onKeyDown={handleKeyDown}>
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
                <DialogDescription>
                  {template 
                    ? 'Update your message template. Variables will be replaced when sending messages.'
                    : 'Create a new message template. Use variables to personalize messages for each student.'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6 overflow-hidden min-h-0 px-6 py-4">
          {/* Left Panel - Main editing area */}
          <div className="flex flex-col space-y-4 overflow-hidden">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Welcome Message"
                disabled={isLoading}
              />
            </div>

            <div className="flex-1 flex flex-col space-y-2 overflow-hidden">
              <Label htmlFor="template-content">Content</Label>
              <Textarea
                id="template-content"
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message here. Use variables like {first_name}, {last_name}, {classes}, {sender_name}, {registration_link}, {invite_link}, {forgot_password_link}..."
                className="flex-1 min-h-[300px] resize-none"
                disabled={isLoading}
              />
              
              {/* Variable insertion buttons */}
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('first_name')}
                    disabled={isLoading}
                  >
                    {'{first_name}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('last_name')}
                    disabled={isLoading}
                  >
                    {'{last_name}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('classes')}
                    disabled={isLoading}
                  >
                    {'{classes}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('sender_name')}
                    disabled={isLoading}
                  >
                    {'{sender_name}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('registration_link')}
                    disabled={isLoading}
                  >
                    {'{registration_link}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('invite_link')}
                    disabled={isLoading}
                  >
                    {'{invite_link}'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertVariable('forgot_password_link')}
                    disabled={isLoading}
                  >
                    {'{forgot_password_link}'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click to insert variables at cursor position
                </p>
                <p className="text-xs text-muted-foreground">
                  Note: Link variables ({'{registration_link}'}, {'{invite_link}'}, {'{forgot_password_link}'}) require tokens/links to be generated when sending messages.
                </p>
                <p className="text-xs text-muted-foreground">
                  {characterCount} character{characterCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="flex flex-col space-y-4 overflow-hidden border-l pl-6">
            <div className="space-y-2">
              <Label>Preview with Sample Data</Label>
              <Select
                value={selectedStudentId}
                onValueChange={setSelectedStudentId}
                disabled={isLoadingStudents || sampleStudents.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a student">
                    {selectedStudent 
                      ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                      : 'No students available'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {sampleStudents.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              <Label className="mb-2">Preview</Label>
              <div className="flex-1 bg-muted/20 rounded-lg p-4 overflow-y-auto border">
                {isLoadingClasses ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    Loading preview...
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="bg-brand-lightBlue text-brand-dark-bg p-3 rounded-lg max-w-[90%]">
                      <p className="whitespace-pre-wrap text-sm">{previewMessage || 'Start typing to see preview...'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim() || !content.trim()}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



