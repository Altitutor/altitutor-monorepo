'use client';

import { useState, useEffect, useRef } from 'react';
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
import { useIssue } from '../api/queries';
import { useUpdateIssue, useDeleteIssue } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { IssueStatus } from '../types';
import { IssueContentPanel } from './panels/IssueContentPanel';
import { IssuePropertiesPanel } from './panels/IssuePropertiesPanel';
import type { UseFormReturn } from 'react-hook-form';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.any().optional(),
  status: z.enum(['open', 'awaiting_response', 'resolved', 'closed']),
});

type FormData = {
  name: string;
  description?: JSONContent | null;
  status: 'open' | 'awaiting_response' | 'resolved' | 'closed';
};

interface IssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
  onIssueUpdated?: () => void;
}

export function IssueDialog({ isOpen, onClose, issueId, onIssueUpdated }: IssueDialogProps) {
  const { data: issue, isLoading } = useIssue(issueId || '', !!issueId && isOpen);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const [isDeleting, setIsDeleting] = useState(false);
  const lastResetIssueIdRef = useRef<string | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: null,
      status: 'open',
    },
  });

  useEffect(() => {
    if (issue && isOpen && !isLoading && issue.id !== lastResetIssueIdRef.current) {
      form.reset({
        name: issue.name,
        description: (issue.description as JSONContent) || null,
        status: issue.status as IssueStatus,
      });
      lastResetIssueIdRef.current = issue.id;
      setIsDeleting(false);
    }
  }, [issue, isOpen, isLoading, form]);

  useEffect(() => {
    if (!isOpen) {
      lastResetIssueIdRef.current = null;
    }
  }, [isOpen]);

  const onSubmit = async (data: FormData) => {
    if (!issueId) return;

    try {
      await updateIssue.mutateAsync({
        id: issueId,
        updates: {
          name: data.name,
          description: data.description || null,
          status: data.status,
        },
      });
      onIssueUpdated?.();
      onClose();
    } catch (error) {
      console.error('Failed to update issue:', error);
    }
  };

  const handleDelete = async () => {
    if (!issueId || !isDeleting) return;

    try {
      await deleteIssue.mutateAsync(issueId);
      onClose();
      onIssueUpdated?.();
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  };

  if (!issueId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-7xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
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
                <DialogTitle>{isLoading ? 'Loading...' : 'Edit Issue'}</DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="p-6">Loading issue data...</div>
          ) : !issue ? (
            <div className="p-6">Issue not found</div>
          ) : (
            <div className="h-full flex min-h-0">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="flex-1 flex min-h-0 divide-x">
                  <div className="flex-1 min-w-0 h-full overflow-hidden">
                    <IssueContentPanel 
                      issue={issue}
                      isOpen={isOpen}
                      onClose={onClose}
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 h-full overflow-hidden">
                    <IssuePropertiesPanel
                      form={form as any}
                      issue={issue}
                      isOpen={isOpen}
                    />
                  </div>
                </form>
              </Form>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confirm delete?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteIssue.isPending}
                >
                  {deleteIssue.isPending ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleting(false)}
                  disabled={deleteIssue.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleting(true)}
                disabled={deleteIssue.isPending || updateIssue.isPending || isLoading}
              >
                Delete
              </Button>
            )}
            {!isDeleting && (
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={form.handleSubmit(onSubmit as any)}
                  disabled={updateIssue.isPending || deleteIssue.isPending || isLoading}
                >
                  {updateIssue.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
