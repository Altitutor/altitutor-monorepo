'use client';

import { useRef, useCallback, memo } from 'react';
import { ScrollArea, type JSONContent, Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '@/features/issues/components/IssueActivityTab';
import { IssueStatusPill } from '@/features/issues/components/fields/IssueStatusPill';
import { IssueDueDatePill } from '@/features/issues/components/fields/IssueDueDatePill';
import { IssueTitleField } from '@/features/issues/components/fields/IssueTitleField';
import { IssueDescriptionField } from '@/features/issues/components/fields/IssueDescriptionField';
import { IssueNotes } from '@/features/issues/components/IssueNotes';
import type { RichTextEditorRef } from '@altitutor/ui';
import type { IssueWithTags, IssueStatus } from '../../types';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import type { Tables } from '@altitutor/shared';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

interface IssuePropertiesPanelProps {
  form: UseFormReturn<{
    name: string;
    description?: JSONContent | null;
    status: IssueStatus;
    dueDate: string | null;
  }>;
  issue?: IssueWithTags;
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
}

export const IssuePropertiesPanel = memo(function IssuePropertiesPanel({
  form,
  issue,
  notes,
  isOpen,
  onClose: _onClose,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<RichTextEditorRef>(null);

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

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 border-r">
        <ScrollArea className="flex-1 min-w-0 max-w-full">
          <div className="p-6 space-y-6">
            {/* Status and Title */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <IssueStatusPill form={form as any} />
                <IssueDueDatePill form={form as any} />
              </div>

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
            {issue?.id && (
              <div className="space-y-4 min-w-0 max-w-full">
                <Separator />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Linked Tasks</h3>
                </div>
                <div className="border-y bg-background overflow-hidden w-full min-w-0 max-w-full">
                    <TasksList 
                      issueId={issue.id} 
                      compact 
                      hideToolbar 
                      showIssuePill={false}
                      noPadding 
                    />
                </div>
              </div>
            )}

            {/* Notes Section */}
            {issue?.id && (
              <div className="space-y-4">
                <Separator />
                <IssueNotes
                  issueId={issue.id}
                  notes={notes}
                  onNoteAdded={() => {}}
                />
              </div>
            )}

            {/* Activity Section */}
            {issue?.id && (
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
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
});
