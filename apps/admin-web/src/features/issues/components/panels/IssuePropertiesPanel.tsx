'use client';

import { useRef, useCallback, memo } from 'react';
import { Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '@/features/issues/components/IssueActivityTab';
import { IssueTitleField } from '@/features/issues/components/fields/IssueTitleField';
import { IssueDescriptionField } from '@/features/issues/components/fields/IssueDescriptionField';
import { IssueNotes } from '@/features/issues/components/IssueNotes';
import type { RichTextEditorRef } from '@altitutor/ui';
import type { IssueFormData, IssueTag, IssueWithTags } from '../../types';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import type { Tables } from '@altitutor/shared';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

interface IssuePropertiesPanelProps {
  form: UseFormReturn<IssueFormData>;
  issue?: IssueWithTags;
  tags?: IssueTag[];
  notes: NoteWithStaff[];
  isOpen: boolean;
  onClose: () => void;
  descriptionRef?: React.RefObject<RichTextEditorRef>;
}

export const IssuePropertiesPanel = memo(function IssuePropertiesPanel({
  form,
  issue,
  tags = [],
  notes,
  isOpen,
  onClose: _onClose,
  descriptionRef: descriptionRefProp,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const internalDescriptionRef = useRef<RichTextEditorRef>(null);
  const descriptionRef = descriptionRefProp ?? internalDescriptionRef;

  const handleTagClick = useCallback((type: TagEntityType, id: string) => {
    window.dispatchEvent(new CustomEvent('mentionClick', { detail: { id, type } }));
  }, []);

  const handleTitleEnter = useCallback(() => {
    if (descriptionRef.current) {
      const editor = descriptionRef.current.getEditor();
      if (editor && 'commands' in editor && editor.commands && typeof editor.commands.focus === 'function') {
        editor.commands.focus();
      }
    }
  }, [descriptionRef]);

  return (
    <>
      <div className="h-full min-h-0 flex-1 min-w-0 overflow-y-auto overscroll-contain border-r">
        <div className="p-6 space-y-6">
            {/* Title */}
            <div className="space-y-4">
              <IssueTitleField
                form={form}
                onEnter={handleTitleEnter}
                titleRef={titleFieldRef}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <IssueDescriptionField
                form={form}
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
                      showLinkPill={false}
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
                  studentIds={tags.map(t => t.student_id!).filter(Boolean)}
                  staffIds={tags.map(t => t.staff_id!).filter(Boolean)}
                  classIds={tags.map(t => t.class_id!).filter(Boolean)}
                  sessionIds={tags.map(t => t.session_id!).filter(Boolean)}
                  invoiceIds={tags.map(t => t.invoice_id!).filter(Boolean)}
                />
              </div>
            )}
        </div>
      </div>
    </>
  );
});
