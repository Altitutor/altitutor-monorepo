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
import { X, Settings2 } from 'lucide-react';
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
import { replaceVariables } from '../../utils/variableReplacer';

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
  const { data: currentStaff } = useCurrentStaff();

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [previewMessage, setPreviewMessage] = useState('');

  const { data: sampleStudents = [], isLoading: isLoadingStudents } = useSampleStudents(isOpen);
  const { data: studentClasses = [], isLoading: isLoadingClasses } = useStudentClassesForTemplate(selectedStudentId || null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isSystemTemplate = !!(template && template.template_key);
  const systemVariables = useMemo(() => {
    if (!template?.variables) return null;
    const v = template.variables;
    if (Array.isArray(v)) return v as string[];
    return null;
  }, [template?.variables]);

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

  const senderName = useMemo(() => {
    if (!currentStaff) return null;
    return `${currentStaff.first_name || ''} ${currentStaff.last_name || ''}`.trim() || null;
  }, [currentStaff]);

  // Update preview when content, student, classes, or sender change
  useEffect(() => {
    const updatePreview = async () => {
      if (!content) {
        setPreviewMessage('');
        return;
      }
      if (!selectedStudent || isLoadingClasses) {
        setPreviewMessage(content);
        return;
      }
      try {
        const replaced = await replaceVariables(
          content,
          selectedStudent,
          studentClasses,
          senderName
        );
        setPreviewMessage(replaced);
      } catch (error) {
        console.error('Error replacing template variables:', error);
        setPreviewMessage(content);
      }
    };
    updatePreview();
  }, [content, selectedStudent, studentClasses, senderName, isLoadingClasses]);

  const isLoading = createMutation.isPending || updateMutation.isPending;
  const characterCount = content.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden" onKeyDown={handleKeyDown}>
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
                <div className="flex items-center gap-2">
                  <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
                  {isSystemTemplate && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                      <Settings2 className="h-3 w-3" />
                      System template
                    </span>
                  )}
                </div>
                <DialogDescription>
                  {template
                    ? 'Update your message template. Variables will be replaced when sending messages.'
                    : 'Create a new message template. Use variables to personalize messages for each student.'}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0 flex flex-col lg:flex-row">
          {/* Left Panel - Main editing area (independently scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 lg:border-r min-w-0">
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

            <div className="space-y-2">
              <Label htmlFor="template-content">Content</Label>
              <Textarea
                id="template-content"
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Type your message here. Use variables like {first_name}, {last_name}, {classes}, {sender_name}, {registration_link}, {invite_link}, {forgot_password_link}..."
                className="min-h-[300px] resize-none"
                disabled={isLoading}
              />
              
              {/* Variable insertion buttons */}
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {(systemVariables ?? [
                    'first_name',
                    'last_name',
                    'classes',
                    'sender_name',
                    'registration_link',
                    'invite_link',
                    'forgot_password_link',
                  ]).map((variable) => (
                    <Button
                      key={variable}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleInsertVariable(variable)}
                      disabled={isLoading}
                    >
                      {`{${variable}}`}
                    </Button>
                  ))}
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

          {/* Right Panel - Preview (independently scrollable) */}
          <div className="flex-1 lg:flex-[0_0_40%] overflow-y-auto p-6 space-y-6 lg:border-l min-w-0">
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

            <div className="space-y-2">
              <Label>Preview</Label>
              <div className="bg-muted/20 rounded-lg p-4 border min-h-[200px]">
                {isLoadingClasses ? (
                  <div className="flex items-center justify-center min-h-[120px] text-muted-foreground text-sm">
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



