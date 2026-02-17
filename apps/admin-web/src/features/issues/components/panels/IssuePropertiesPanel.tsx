'use client';

import { ScrollArea, RichTextEditor, type RichTextEditorRef, type JSONContent, Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useRef, useCallback } from 'react';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '../IssueActivityTab';
import {
  FormField,
  FormItem,
  FormControl,
  Input,
} from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { IssueStatusPill } from '../fields/IssueStatusPill';

import type { IssueWithTags, IssueStatus } from '../../types';

interface IssuePropertiesPanelProps {
  form: UseFormReturn<{
    name: string;
    description?: JSONContent | null;
    status: IssueStatus;
  }>;
  issue: IssueWithTags;
  isOpen: boolean;
}

export function IssuePropertiesPanel({
  form,
  issue,
  isOpen,
}: IssuePropertiesPanelProps) {
  const descriptionRef = useRef<RichTextEditorRef>(null);

  const handleDescriptionChange = useCallback((value: JSONContent) => {
    form.setValue('description', value, { shouldDirty: true });
  }, [form]);

  return (
    <div className="flex-1 border-l flex flex-col bg-muted/5">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Status and Title */}
          <div className="space-y-4">
            <IssueStatusPill form={form as any} />

            <FormField
              control={form.control as any}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Issue name"
                      className="text-2xl font-semibold border-none px-0 focus-visible:ring-0 h-auto py-0"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <RichTextEditor
              ref={descriptionRef}
              content={form.getValues('description')}
              onChange={handleDescriptionChange}
              placeholder="Add issue description..."
              className="min-h-[150px]"
            />
          </div>

          <Separator />

          {/* Tasks Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Linked Tasks</h3>
            </div>
            <div className="border rounded-md bg-background overflow-hidden">
                <TasksList issueId={issue.id} compact />
            </div>
          </div>

          <Separator />

          {/* Activity Section */}
          <div className="space-y-4 pb-6">
            <h3 className="text-sm font-medium text-muted-foreground">Activity</h3>
            <IssueActivityTab 
              issueId={issue.id} 
              isOpen={isOpen}
              studentIds={issue.tags.map(t => t.student_id!).filter(Boolean)}
              staffIds={issue.tags.map(t => t.staff_id!).filter(Boolean)}
              classIds={issue.tags.map(t => t.class_id!).filter(Boolean)}
              sessionIds={issue.tags.map(t => t.session_id!).filter(Boolean)}
              invoiceIds={issue.tags.map(t => t.invoice_id!).filter(Boolean)}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
