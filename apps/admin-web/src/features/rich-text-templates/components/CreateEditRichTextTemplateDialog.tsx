'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
  Label,
  RichTextEditor,
} from '@altitutor/ui';
import { X } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useCreateRichTextTemplate, useUpdateRichTextTemplate } from '../api/templates';
import type { Tables } from '@altitutor/shared';
import { getErrorMessage } from '@/shared/utils';
import type { JSONContent } from '@tiptap/core';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';

interface CreateEditRichTextTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  template?: Tables<'rich_text_templates'> | null;
  onSuccess?: () => void;
}

export function CreateEditRichTextTemplateDialog({
  isOpen,
  onClose,
  template,
  onSuccess,
}: CreateEditRichTextTemplateDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateRichTextTemplate();
  const updateMutation = useUpdateRichTextTemplate();

  const [name, setName] = useState('');
  const [content, setContent] = useState<JSONContent | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (template) {
        setName(template.name);
        setContent((template.content as JSONContent) ?? null);
      } else {
        setName('');
        setContent(null);
      }
    }
  }, [isOpen, template]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => nameInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a template name.',
        variant: 'destructive',
      });
      return;
    }

    if (isTiptapContentEmpty(content)) {
      toast({
        title: 'Validation Error',
        description: 'Please add some content to the template.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const contentToSave = content ?? { type: 'doc', content: [{ type: 'paragraph' }] };

      if (template) {
        await updateMutation.mutateAsync({
          id: template.id,
          updates: { name: name.trim(), content: contentToSave },
        });
        toast({
          title: 'Success',
          description: 'Template updated successfully.',
        });
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          content: contentToSave,
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

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>{template ? 'Edit Template' : 'Create Template'}</DialogTitle>
              <DialogDescription>
                {template
                  ? 'Update your rich text template.'
                  : 'Create a new rich text template for use in issues, projects, tasks, and notes.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting Notes"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-content">Content</Label>
            <RichTextEditor
              content={content ?? { type: 'doc', content: [{ type: 'paragraph' }] }}
              onChange={(json) => setContent(json)}
              placeholder="Type your template content here..."
              minHeight="200px"
              className="min-h-[200px]"
              editable={!isLoading}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isLoading || !name.trim() || isTiptapContentEmpty(content)}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
