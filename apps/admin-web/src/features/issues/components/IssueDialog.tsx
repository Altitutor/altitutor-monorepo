'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type JSONContent,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { X, Check, Loader2, CloudOff } from 'lucide-react';
import { useIssue } from '../api/queries';
import { useUpdateIssue, useDeleteIssue } from '../api/mutations';
import { useNotes } from '@/shared/hooks/useNotes';
import type { Tables } from '@altitutor/shared';
import type { IssueStatus } from '../types';
import { IssueContentPanel } from './panels/IssueContentPanel';
import { IssuePropertiesPanel } from './panels/IssuePropertiesPanel';
import { useIssueAutoSave } from '../hooks/useIssueAutoSave';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

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

interface IssueDialogProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string | null;
  onIssueUpdated?: () => void;
}

interface AutoSaveManagerProps {
  form: any;
  issueId: string;
  issue: any;
  isInitialized: boolean;
  isLoading: boolean;
  onSave: (updates: any) => Promise<void>;
}

function AutoSaveManager({ form, issueId, issue, isInitialized, isLoading, onSave }: AutoSaveManagerProps) {
  useIssueAutoSave({
    form,
    issueId,
    issue,
    isInitialized,
    isUpdatingFromServer: isLoading,
    onSave,
  });
  return null;
}

export function IssueDialog({ isOpen, onClose, issueId, onIssueUpdated }: IssueDialogProps) {
  const { data: issue, isLoading } = useIssue(issueId || '', !!issueId && isOpen);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const lastResetIssueIdRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!issueId) return;
    try {
      await deleteIssue.mutateAsync(issueId);
      onClose();
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  };

  // Fetch notes for issue
  const { data: notesData } = useNotes('issues', issueId || '', !!issueId && isOpen);
  type NoteWithStaff = Tables<'notes'> & {
    staff?: Tables<'staff'> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

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
      setIsInitialized(true);
    }
  }, [issue, isOpen, isLoading, form]);

  useEffect(() => {
    if (!isOpen) {
      lastResetIssueIdRef.current = null;
      setIsInitialized(false);
    }
  }, [isOpen]);

  const handleAutoSave = useCallback(async (updates: Partial<FormData>) => {
    if (!issueId) return;

    try {
      await updateIssue.mutateAsync({
        id: issueId,
        updates,
      });
      // Removed onIssueUpdated?.() from auto-save to prevent parent re-renders while typing
    } catch (error) {
      console.error('Failed to auto-save issue:', error);
    }
  }, [issueId, updateIssue]);

  if (!issueId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
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
                <DialogDescription className="sr-only">
                  Edit the details, description, and status of this issue.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pr-2 mr-2">
                {updateIssue.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : updateIssue.isError ? (
                  <>
                    <CloudOff className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">Changes not saved</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Saved</span>
                  </>
                )}
              </div>
              <ActionsMenu
                type="issue"
                onOpenInPage={() => {
                  // For now, no specific issue detail page implemented
                }}
                onDelete={() => setIsDeleteDialogOpen(true)}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="p-6">Loading issue data...</div>
          ) : !issue ? (
            <div className="p-6">Issue not found</div>
          ) : (
            <div className="h-full flex">
              <Form {...form}>
                <form className="flex-1 flex min-h-0">
                  <AutoSaveManager
                    form={form}
                    issueId={issueId}
                    issue={issue}
                    isInitialized={isInitialized}
                    isLoading={isLoading}
                    onSave={handleAutoSave}
                  />
                  <IssueContentPanel 
                    issue={issue}
                    isOpen={isOpen}
                  />
                  
                  <IssuePropertiesPanel
                    form={form as any}
                    issue={issue}
                    notes={notes}
                    isOpen={isOpen}
                    onClose={onClose}
                  />
                </form>
              </Form>
            </div>
          )}
        </div>
      </DialogContent>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the issue
              and all associated activity records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteIssue.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteIssue.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
