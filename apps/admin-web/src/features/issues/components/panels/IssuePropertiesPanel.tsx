'use client';

import { ScrollArea, type JSONContent, Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useRef, useCallback, useState } from 'react';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '../IssueActivityTab';
import { IssueStatusPill } from '../fields/IssueStatusPill';
import { IssueTitleField } from '../fields/IssueTitleField';
import { IssueDescriptionField } from '../fields/IssueDescriptionField';
import { IssueNotes } from '../IssueNotes';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewClassModal } from '@/features/classes/components/modal/ViewClassModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics/components';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import type { RichTextEditorRef } from '@altitutor/ui';

import type { IssueWithTags, IssueStatus } from '../../types';
import type { TagEntityType } from '../../../tasks/utils/tagParsing';
import type { Tables } from '@altitutor/shared';

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
}

export function IssuePropertiesPanel({
  form,
  issue,
  notes,
  isOpen,
}: IssuePropertiesPanelProps) {
  const titleFieldRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<RichTextEditorRef>(null);

  // Modal state for entity tags
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const handleTagClick = useCallback((type: TagEntityType, id: string) => {
    setSelectedStudentId(null);
    setSelectedStaffId(null);
    setSelectedClassId(null);
    setSelectedParentId(null);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setSelectedSessionId(null);
    setSelectedFileId(null);

    if (type === 'student') setSelectedStudentId(id);
    else if (type === 'staff') setSelectedStaffId(id);
    else if (type === 'class') setSelectedClassId(id);
    else if (type === 'parent') setSelectedParentId(id);
    else if (type === 'subject') setSelectedSubjectId(id);
    else if (type === 'topic') setSelectedTopicId(id);
    else if (type === 'session') setSelectedSessionId(id);
    else if (type === 'file') {
      setSelectedFileId(id);
      window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
    }
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
          </div>
        </ScrollArea>
      </div>

      {/* Entity Modals */}
      {selectedStudentId && (
        <ViewStudentModal
          isOpen={!!selectedStudentId}
          onClose={() => setSelectedStudentId(null)}
          studentId={selectedStudentId}
          onStudentUpdated={() => {}}
        />
      )}

      {selectedStaffId && (
        <ViewStaffModal
          isOpen={!!selectedStaffId}
          onClose={() => setSelectedStaffId(null)}
          staffId={selectedStaffId}
          onStaffUpdated={() => {}}
        />
      )}

      {selectedClassId && (
        <ViewClassModal
          isOpen={!!selectedClassId}
          onClose={() => setSelectedClassId(null)}
          classId={selectedClassId}
          onClassUpdated={() => {}}
        />
      )}

      {selectedParentId && (
        <ViewParentModal
          isOpen={!!selectedParentId}
          onClose={() => setSelectedParentId(null)}
          parentId={selectedParentId}
          onParentUpdated={() => {}}
        />
      )}

      {selectedSubjectId && (
        <ViewSubjectModal
          isOpen={!!selectedSubjectId}
          onClose={() => setSelectedSubjectId(null)}
          subjectId={selectedSubjectId}
          onSubjectUpdated={() => {}}
        />
      )}

      {selectedTopicId && (
        <ViewTopicModal
          isOpen={!!selectedTopicId}
          onClose={() => setSelectedTopicId(null)}
          topicId={selectedTopicId}
          onTopicUpdated={() => {}}
        />
      )}

      {selectedSessionId && (
        <SessionModal
          isOpen={!!selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
          sessionId={selectedSessionId}
        />
      )}

      {selectedFileId && (
        <FilePreviewModal
          isOpen={!!selectedFileId}
          onClose={() => setSelectedFileId(null)}
          topicFileId={selectedFileId}
        />
      )}
    </>
  );
}
