'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type UseFormReturn, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
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
  type RichTextEditorRef,
  Button,
  Form,
} from '@altitutor/ui';
import { X, ArrowLeft, Loader2 } from 'lucide-react';
import { ExpandButton } from '@/shared/components/expandable-dialog';
import { AutoSaveStatus } from '@/shared/components/AutoSaveStatus';
import { useIssue } from '../api/queries';
import { useUpdateIssue, useDeleteIssue } from '../api/mutations';
import { useCurrentStaff } from '@/shared/hooks';
import { useNotes } from '@/shared/hooks/useNotes';
import type { Tables } from '@altitutor/shared';
import type { IssueFormData, IssueStatus, IssueWithTags } from '../types';
import { IssueContentPanel } from './panels/IssueContentPanel';
import { IssuePropertiesPanel } from './panels/IssuePropertiesPanel';
import { useIssueAutoSave } from '../hooks/useIssueAutoSave';
import { useIssueActions } from '../hooks/useIssueActions';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import { useLiveIssueTags } from '../hooks/useLiveIssueTags';
import { EntityResizablePanels } from '@/shared/components/EntityResizablePanels';

const VALID_ISSUE_STATUSES: IssueStatus[] = ['open', 'awaiting_response', 'resolved'];

function normalizeIssueStatus(status: string | null | undefined): IssueStatus {
  if (status && VALID_ISSUE_STATUSES.includes(status as IssueStatus)) {
    return status as IssueStatus;
  }
  return 'open';
}

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

/** Keeps description watch + tag extraction off the dialog shell so typing does not re-render the header. */
function IssueLiveTagsPanels({
  form,
  issue,
  notes,
  isOpen,
  onClose,
  descriptionRef,
}: {
  form: UseFormReturn<IssueFormData>;
  issue: IssueWithTags;
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
  descriptionRef: React.RefObject<RichTextEditorRef>;
}) {
  const liveTags = useLiveIssueTags({
    form,
    initialTags: issue.tags || [],
  });

  return (
    <EntityResizablePanels
      id={`issue-${issue.id}-panels`}
      main={(
        <IssuePropertiesPanel
          form={form}
          issue={issue}
          tags={liveTags}
          notes={notes}
          isOpen={isOpen}
          onClose={onClose}
          descriptionRef={descriptionRef}
        />
      )}
      sidebar={(
        <IssueContentPanel
          isOpen={isOpen}
          form={form}
          tags={liveTags}
        />
      )}
    />
  );
}

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
  status: z.enum(['open', 'awaiting_response', 'resolved']),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

interface AutoSaveManagerProps {
  form: UseFormReturn<IssueFormData>;
  issueId: string;
  issue: Tables<'issues'> | undefined;
  isInitialized: boolean;
  isLoading: boolean;
  onSave: (updates: Partial<IssueFormData>) => Promise<void>;
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

export interface IssueDetailViewProps {
  issueId: string;
  enabled?: boolean;
  onClose: () => void;
  onIssueUpdated?: () => void;
  variant: 'dialog' | 'page';
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function IssueDetailView({
  issueId,
  enabled = true,
  onClose,
  onIssueUpdated: _onIssueUpdated,
  variant,
  expanded = false,
  onExpandedChange,
}: IssueDetailViewProps) {
  const router = useRouter();
  const { data: issue, isLoading } = useIssue(issueId, enabled);
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();
  const { data: currentStaff } = useCurrentStaff();
  const lastResetIssueIdRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const descriptionRef = useRef<RichTextEditorRef>(null);

  const handleDelete = async () => {
    try {
      await deleteIssue.mutateAsync(issueId);
      onClose();
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  };

  const { data: notesData } = useNotes('issues', issueId, enabled);
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<IssueFormData, unknown, IssueFormData>({
    resolver: zodResolver(formSchema) as Resolver<IssueFormData>,
    defaultValues: {
      name: '',
      description: null,
      status: 'open',
      dueDate: null,
    },
  });

  useEffect(() => {
    if (issue && enabled && !isLoading && issue.id !== lastResetIssueIdRef.current) {
      form.reset({
        name: issue.name,
        description: (issue.description as JSONContent) || null,
        status: normalizeIssueStatus(issue.status),
        dueDate: issue.due_date ? new Date(issue.due_date).toISOString().split('T')[0] : null,
      });
      lastResetIssueIdRef.current = issue.id;
      setIsInitialized(true);
    }
  }, [issue, enabled, isLoading, form]);

  useEffect(() => {
    if (!enabled) {
      lastResetIssueIdRef.current = null;
      setIsInitialized(false);
    }
  }, [enabled]);

  const handleAutoSave = useCallback(async (updates: Partial<IssueFormData>) => {
    try {
      const formattedUpdates: Record<string, unknown> = { ...updates };
      if (updates.dueDate !== undefined) {
        formattedUpdates.due_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
        delete formattedUpdates.dueDate;
      }
      if (updates.status === 'resolved') {
        formattedUpdates.resolved_by = currentStaff?.id ?? null;
      }

      await updateIssue.mutateAsync({
        id: issueId,
        updates: formattedUpdates,
      });
    } catch (error) {
      console.error('Failed to auto-save issue:', error);
    }
  }, [issueId, updateIssue, currentStaff?.id]);

  const issueActions = useIssueActions({
    issueId,
    onOpenInPage:
      variant === 'dialog'
        ? () => {
            router.push(`/issues/${issueId}`);
            onClose();
          }
        : undefined,
  });

  const title = isLoading ? 'Loading...' : variant === 'page' ? 'Issue Details' : 'Edit Issue';

  return (
    <>
      <Form {...form}>
        <div className="h-full min-h-0 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 border-b bg-card px-6 py-4">
            <div className="flex items-center justify-between gap-4 w-full">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant={variant === 'page' ? 'ghost' : 'outline'}
                  size="icon"
                  onClick={onClose}
                  className={variant === 'page' ? 'shrink-0 border' : 'shrink-0'}
                >
                  {variant === 'page' ? (
                    <ArrowLeft className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
                <div className="flex-1">
                  {variant === 'dialog' ? (
                    <>
                      <DialogTitle>{title}</DialogTitle>
                      <DialogDescription className="sr-only">
                        Edit the details, description, and status of this issue.
                      </DialogDescription>
                    </>
                  ) : (
                    <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <AutoSaveStatus isPending={updateIssue.isPending} isError={updateIssue.isError} />
                {variant === 'dialog' && onExpandedChange && (
                  <ExpandButton expanded={expanded} onToggle={() => onExpandedChange(!expanded)} />
                )}
                <ActionsMenu
                  type="issue"
                  entityId={issueId}
                  onOpenInPage={issueActions.onOpenInPage}
                  onDelete={() => setIsDeleteDialogOpen(true)}
                  richTextTemplateConfig={{
                    getEditor: () => descriptionRef.current?.getEditor() ?? null,
                    getCurrentContent: () => form.getValues('description') ?? null,
                    onSaveAsTemplateClick: () => setIsSaveDialogOpen(true),
                  }}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
            {isLoading ? (
              <div className="p-6">Loading issue data...</div>
            ) : !issue ? (
              <div className="p-6">Issue not found</div>
            ) : (
              <div className="h-full min-h-0 flex min-w-0 overflow-hidden">
                <form className="h-full flex-1 flex min-h-0 min-w-0 overflow-hidden" onSubmit={(e) => e.preventDefault()}>
                  <AutoSaveManager
                    form={form}
                    issueId={issueId}
                    issue={issue}
                    isInitialized={isInitialized}
                    isLoading={isLoading}
                    onSave={handleAutoSave}
                  />
                  <IssueLiveTagsPanels
                    form={form}
                    issue={issue}
                    notes={notes}
                    isOpen={enabled}
                    onClose={onClose}
                    descriptionRef={descriptionRef}
                  />
                </form>
              </div>
            )}
          </div>
        </div>
      </Form>

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
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('description') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </>
  );
}
