'use client';

import { useState, useRef, useCallback, memo } from 'react';
import { ScrollArea, type JSONContent, Separator, Button } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '@/features/issues/components/IssueActivityTab';
import { IssueStatusPill } from '@/features/issues/components/fields/IssueStatusPill';
import { IssueTitleField } from '@/features/issues/components/fields/IssueTitleField';
import { IssueDescriptionField } from '@/features/issues/components/fields/IssueDescriptionField';
import { IssueNotes } from '@/features/issues/components/IssueNotes';
import type { RichTextEditorRef } from '@altitutor/ui';
import type { IssueWithTags, IssueStatus } from '../../types';
import type { TagEntityType } from '../../../tasks/utils/tagParsing';
import type { Tables } from '@altitutor/shared';
import { useDeleteIssue } from '../../api/mutations';
import { Trash2, AlertCircle } from 'lucide-react';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

interface IssuePropertiesPanelProps {
  form: UseFormReturn<{
    name: string;
    description?: JSONContent | null;
    status: IssueStatus;
  }>;
  issue: IssueWithTags;
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
}

export const IssuePropertiesPanel = memo(function IssuePropertiesPanel({
  form,
  issue,
  notes,
  isOpen,
  onClose,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<RichTextEditorRef>(null);
  const deleteIssue = useDeleteIssue();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTagClick = useCallback((type: TagEntityType, id: string) => {
    // Dispatch custom event for MentionModalProvider to handle
    window.dispatchEvent(new CustomEvent('mentionClick', { 
      detail: { id, type } 
    }));
  }, []);

  const handleTitleEnter = useCallback(() => {
    if (descriptionRef.current) {
      const editor = descriptionRef.current.getEditor();
      if (editor && 'commands' in editor && editor.commands && typeof editor.commands.focus === 'function') {
        editor.commands.focus();
      }
    }
  }, []);

  const handleDelete = async () => {
    try {
      await deleteIssue.mutateAsync(issue.id);
      onClose();
    } catch (error) {
      console.error('Failed to delete issue:', error);
    }
  };

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0">
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Status and Title */}
            <div className="space-y-4">
              <IssueStatusPill form={form as any} />

              <IssueTitleField
                form={form as any}
                value={form.getValues('name')}
                onTagClick={handleTagClick}
                onEnter={handleTitleEnter}
                titleRef={titleFieldRef}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <IssueDescriptionField
                form={form as any}
                value={form.getValues('description')}
                onTagClick={handleTagClick}
                descriptionRef={descriptionRef}
              />
            </div>

            {/* Tasks Section */}
            <div className="space-y-4">
              <Separator />
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Linked Tasks</h3>
              </div>
              <div className="border-y bg-background overflow-hidden w-full">
                  <TasksList 
                    issueId={issue.id} 
                    compact 
                    hideToolbar 
                    noPadding 
                  />
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-4">
              <Separator />
              <IssueNotes
                issueId={issue.id}
                notes={notes}
                onNoteAdded={() => {}}
              />
            </div>

            {/* Activity Section */}
            <div className="space-y-4 pb-6">
              <Separator />
              <h3 className="text-lg font-semibold">Activity</h3>
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

            {/* Delete Section */}
            <div className="pt-12 pb-8 border-t">
              {!isDeleting ? (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setIsDeleting(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Issue
                </Button>
              ) : (
                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-destructive">Delete this issue?</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        This action cannot be undone. All linked data will be preserved but the issue record will be permanently removed.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={deleteIssue.isPending}
                    >
                      {deleteIssue.isPending ? 'Deleting...' : 'Confirm Delete'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsDeleting(false)}
                      disabled={deleteIssue.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </div>
    </>
  );
});
