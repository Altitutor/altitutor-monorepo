'use client';

import { Separator, ScrollArea, type JSONContent } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useRef, useCallback } from 'react';
import { TasksList } from '@/features/tasks/components/TasksList';
import { IssueActivityTab } from '../IssueActivityTab';
import { Form } from '@altitutor/ui';
import { IssueTitleField, IssueDescriptionField, IssuePropertyPills } from '../fields';
import type { TagEntityType } from '@/features/tasks/utils/tagParsing';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewClassModal } from '@/features/classes/components/modal/ViewClassModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics/components';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import { useState } from 'react';

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
    // Reset all states
    setSelectedStudentId(null);
    setSelectedStaffId(null);
    setSelectedClassId(null);
    setSelectedParentId(null);
    setSelectedSubjectId(null);
    setSelectedTopicId(null);
    setSelectedSessionId(null);
    setSelectedFileId(null);

    // Set the appropriate state based on entity type
    if (type === 'student') {
      setSelectedStudentId(id);
    } else if (type === 'staff') {
      setSelectedStaffId(id);
    } else if (type === 'class') {
      setSelectedClassId(id);
    } else if (type === 'parent') {
      setSelectedParentId(id);
    } else if (type === 'subject') {
      setSelectedSubjectId(id);
    } else if (type === 'topic') {
      setSelectedTopicId(id);
    } else if (type === 'session') {
      setSelectedSessionId(id);
    } else if (type === 'file') {
      setSelectedFileId(id);
      window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
    }
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-background h-full overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Status Pills */}
          <IssuePropertyPills form={form as any} />

          {/* Title and Description */}
          <div className="space-y-6">
            <IssueTitleField
              form={form as any}
              value={form.getValues('name')}
              onTagClick={handleTagClick}
            />

            <IssueDescriptionField
              form={form as any}
              value={form.getValues('description')}
              onTagClick={handleTagClick}
            />
          </div>

          <Separator />

          {/* Tasks Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Linked Tasks</h3>
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
    </div>
  );
}
