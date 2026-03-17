'use client';

import { useCallback, useEffect, useState } from 'react';
import { useForm, type Resolver } from 'react-hook-form';
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
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useCreateIssue } from '../api/mutations';
import { useCurrentStaff } from '@/shared/hooks';
import type { IssueFormData, IssueStatus, IssueTagInsert } from '../types';
import type { SubmitHandler } from 'react-hook-form';
import { IssueContentPanel } from './panels/IssueContentPanel';
import { IssuePropertiesPanel } from './panels/IssuePropertiesPanel';
import { useDialogHotkeys } from '@/shared/hooks';
import { useLiveIssueTags } from '../hooks/useLiveIssueTags';
import { getTagEntity, resolveTagLabels } from '../utils/mentionLabels';

async function buildDescriptionFromInitialTags(tags?: Omit<IssueTagInsert, 'issue_id'>[]): Promise<JSONContent | null> {
  if (!tags || tags.length === 0) return null;
  const labels = await resolveTagLabels(tags);

  const seen = new Set<string>();
  const content: JSONContent[] = [];

  tags.forEach((tag) => {
    const entity = getTagEntity(tag);
    if (!entity) return;

    const key = `${entity.type}:${entity.id}`;
    if (seen.has(key)) return;
    seen.add(key);

    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'mention',
          attrs: {
            id: entity.id,
            type: entity.type,
            label: labels.get(key) || entity.id,
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
  description: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
  status: z.enum(['open', 'awaiting_response', 'resolved']),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

interface CreateIssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onIssueCreated?: () => void;
  initialStatus?: IssueStatus;
  initialDueDate?: string | null;
  initialTags?: Omit<IssueTagInsert, 'issue_id'>[];
}

export function CreateIssueDialog({
  isOpen,
  onClose,
  onIssueCreated,
  initialStatus = 'open',
  initialDueDate = null,
  initialTags 
}: CreateIssueDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const createIssue = useCreateIssue();
  const { data: currentStaff } = useCurrentStaff();

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  const form = useForm<IssueFormData, unknown, IssueFormData>({
    resolver: zodResolver(formSchema) as Resolver<IssueFormData>,
    defaultValues: {
      name: '',
      description: null,
      status: initialStatus,
      dueDate: initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : null,
    },
  });

  const liveTags = useLiveIssueTags({ form, initialTags });

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    (async () => {
      const description = await buildDescriptionFromInitialTags(initialTags);
      if (cancelled) return;
      form.reset({
        name: '',
        description,
        status: initialStatus,
        dueDate: initialDueDate ? new Date(initialDueDate).toISOString().split('T')[0] : null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, initialStatus, initialDueDate, initialTags, form]);

  const handleClose = useCallback(() => {
    form.reset();
    onClose();
  }, [form, onClose]);

  const onSubmit = useCallback(async (data: IssueFormData) => {
    try {
      await createIssue.mutateAsync({
        issue: {
          name: data.name,
          description: data.description || null,
          status: data.status,
          due_date: data.dueDate ? new Date(data.dueDate).toISOString() : null,
          created_by: currentStaff?.id ?? null,
        },
        tags: initialTags,
      });
      onIssueCreated?.();
      handleClose();
    } catch (error) {
      console.error('Failed to create issue:', error);
    }
  }, [createIssue, handleClose, initialTags, onIssueCreated, currentStaff?.id]);

  const handlePrimaryAction = useCallback(() => {
    if (createIssue.isPending) return;
    void form.handleSubmit(onSubmit as SubmitHandler<IssueFormData>)();
  }, [createIssue.isPending, form, onSubmit]);

  useDialogHotkeys({
    isOpen,
    onPrimaryAction: handlePrimaryAction,
    isActionDisabled: createIssue.isPending,
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <Form {...form}>
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
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-hidden min-h-0">
            <div className="h-full flex">
              <form onSubmit={form.handleSubmit(onSubmit as SubmitHandler<IssueFormData>)} className="flex-1 flex min-h-0">
                <IssuePropertiesPanel
                  form={form}
                  notes={[]}
                  isOpen={isOpen}
                  onClose={handleClose}
                />

                <IssueContentPanel 
                  isOpen={isOpen}
                  tags={liveTags}
                />
              </form>
            </div>
          </div>

          <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
            <div className="flex items-center gap-2 w-full justify-end">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit as SubmitHandler<IssueFormData>)}
                disabled={createIssue.isPending}
              >
                {createIssue.isPending ? 'Creating...' : 'Create Issue'}
              </Button>
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
