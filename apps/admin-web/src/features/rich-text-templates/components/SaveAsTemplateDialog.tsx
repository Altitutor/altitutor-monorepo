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
} from '@altitutor/ui';
import { X } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useCreateRichTextTemplate } from '../api/templates';
import { getErrorMessage } from '@/shared/utils';
import { toEditorContent } from '@/shared/utils/plainTextToTiptapJson';
import type { JSONContent } from '@tiptap/core';
import { isTiptapContentEmpty } from '@/shared/utils/plainTextToTiptapJson';

interface SaveAsTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialContent: JSONContent | string | null;
  onSuccess?: () => void;
}

export function SaveAsTemplateDialog({
  isOpen,
  onClose,
  initialContent,
  onSuccess,
}: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const createMutation = useCreateRichTextTemplate();
  const [name, setName] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
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

    if (isTiptapContentEmpty(toEditorContent(initialContent))) {
      toast({
        title: 'Validation Error',
        description: 'There is no content to save as a template.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const contentToSave = toEditorContent(initialContent);

      await createMutation.mutateAsync({
        name: name.trim(),
        content: contentToSave,
      });

      toast({
        title: 'Success',
        description: 'Template saved successfully.',
      });

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

  const isLoading = createMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
              <X className="h-4 w-4" />
            </Button>
            <div>
              <DialogTitle>Save as Template</DialogTitle>
              <DialogDescription>
                Save the current content as a reusable template. You can insert it later in any
                rich text field.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          <div className="space-y-2">
            <Label htmlFor="save-template-name">Template Name</Label>
            <Input
              id="save-template-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Meeting Notes"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
