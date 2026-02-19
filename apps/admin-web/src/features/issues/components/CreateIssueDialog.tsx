'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  type JSONContent,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { X } from 'lucide-react';
import { useCreateIssue } from '../api/mutations';
import type { IssueStatus, IssueTagInsert } from '../types';
import { IssueContentPanel } from './panels/IssueContentPanel';
import { IssuePropertiesPanel } from './panels/IssuePropertiesPanel';
import { useEffect, useMemo } from 'react';
import { useLiveIssueTags } from '../hooks/useLiveIssueTags';

function tagToMention(tag: Omit<IssueTagInsert, 'issue_id'>): { type: string; id: string; label: string } | null {
  if (tag.student_id) return { type: 'student', id: tag.student_id, label: tag.student_id };
  if (tag.staff_id) return { type: 'staff', id: tag.staff_id, label: tag.staff_id };
  if (tag.class_id) return { type: 'class', id: tag.class_id, label: tag.class_id };
  if (tag.session_id) return { type: 'session', id: tag.session_id, label: tag.session_id };
  if (tag.invoice_id) return { type: 'invoice', id: tag.invoice_id, label: tag.invoice_id };
  if (tag.parent_id) return { type: 'parent', id: tag.parent_id, label: tag.parent_id };
  if (tag.subject_id) return { type: 'subject', id: tag.subject_id, label: tag.subject_id };
  return null;
}

function buildDescriptionFromInitialTags(tags?: Omit<IssueTagInsert, 'issue_id'>[]): JSONContent | null {
  if (!tags || tags.length === 0) return null;

  const seen = new Set<string>();
  const content: JSONContent[] = [];

  tags.forEach((tag) => {
    const mention = tagToMention(tag);
    if (!mention) return;

    const key = `${mention.type}:${mention.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          attrs: {
            id: mention.id,
            type: mention.type,
            label: mention.label,
          },
        },
        { type: 'text', text: ' ' },
      ],
    });
  });

  if (content.length === 0) return null;
  return { type: 'doc', content };
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.any().optional(),
  status: z.enum(['open', 'awaiting_response', 'resolved', 'closed']),
});

type FormData = {
  name: string;
  description?: JSONContent | null;
  status: IssueStatus;
};

interface CreateIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated?: () => void;
  initialStatus?: IssueStatus;
  initialTags?: Omit<IssueTagInsert, 'issue_id'>[];
}

export function CreateIssueDialog({ 
  isOpen, 
  onClose, 
  onIssueCreated, 
  initialStatus = 'open',
  initialTags 
}: CreateIssueDialogProps) {
  const createIssue = useCreateIssue();
  const initialDescription = useMemo(() => buildDescriptionFromInitialTags(initialTags), [initialTags]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: initialDescription,
      status: initialStatus,
    },
  });

  const liveTags = useLiveIssueTags({ form, initialTags });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: '',
        description: initialDescription,
        status: initialStatus,
      });
    }
  }, [isOpen, initialStatus, initialDescription, form]);

  const onSubmit = async (data: FormData) => {
    try {
      await createIssue.mutateAsync({
        issue: {
          name: data.name,
          description: data.description || null,
          status: data.status,
        },
        tags: initialTags,
      });
      onIssueCreated?.();
      handleClose();
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>Create Issue</DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex min-h-0">
                <IssuePropertiesPanel
                  form={form as any}
                  notes={[]}
                  isOpen={isOpen}
                  onClose={handleClose}
                />
                
                <IssueContentPanel 
                  isOpen={isOpen}
                  tags={liveTags}
                />
              </form>
            </Form>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <div className="flex items-center gap-2 w-full justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={createIssue.isPending}
            >
              {createIssue.isPending ? 'Creating...' : 'Create Issue'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
