'use client';

import { Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useState, useCallback, useRef, useEffect } from 'react';
import { TaskTitleField, TaskDescriptionField } from '../fields';
import { TaskPropertyPills } from '../fields/TaskPropertyPills';
import { TaskActivityTab } from '@/features/activity/components/tabs/TaskActivityTab';
import { TaskNotes } from '../TaskNotes';
import type { TaskEditorRef } from '../TaskEditor';
import { ViewStudentModal } from '@/features/students/components/ViewStudentModal';
import { ViewStaffModal } from '@/features/staff/components/modal/ViewStaffModal';
import { ViewClassModal } from '@/features/classes/components/modal/ViewClassModal';
import { ViewParentModal } from '@/features/students/components/ViewParentModal';
import { ViewSubjectModal } from '@/features/subjects/components';
import { ViewTopicModal, FilePreviewModal } from '@/features/topics/components';
import { SessionModal } from '@/features/sessions/components/SessionModal';
import type { TaskFormData, TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';
import type { TagEntityType } from '@/shared/utils/tagParsing';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

interface TaskContentPanelProps {
  form: UseFormReturn<TaskFormData>;
  taskId: string | null;
  notes: NoteWithStaff[];
  isOpen: boolean;
  showActivity?: boolean;
  selectedAssignee?: Tables<'staff'> | null;
  onAssigneeChange?: (staff: Tables<'staff'> | null) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
  autoFocusTitle?: boolean;
}

export function TaskContentPanel({
  form,
  taskId,
  notes,
  isOpen,
  showActivity = true,
  selectedAssignee,
  onAssigneeChange,
  taskStatus,
  enabled = true,
  autoFocusTitle = false,
}: TaskContentPanelProps) {
  // Refs for fields
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const descriptionFieldRef = useRef<TaskEditorRef>(null);

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
      // Files use a custom event
      window.dispatchEvent(new CustomEvent('open-file-preview', { detail: { id } }));
    }
  }, []);

  // Handle Enter key in title field - move focus to description
  const handleTitleEnter = useCallback(() => {
    if (descriptionFieldRef.current) {
      const editor = descriptionFieldRef.current.getEditor();
      if (editor && 'commands' in editor && editor.commands && typeof editor.commands.focus === 'function') {
        editor.commands.focus();
      }
    }
  }, []);

  // Listen for Tiptap mention clicks
  useEffect(() => {
    const handleMentionClick = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.id && detail.type) {
        handleTagClick(detail.type as TagEntityType, detail.id);
      }
    };

    window.addEventListener('mentionClick', handleMentionClick);
    return () => window.removeEventListener('mentionClick', handleMentionClick);
  }, [handleTagClick]);

  // Auto-focus title field when dialog opens
  useEffect(() => {
    if (isOpen && autoFocusTitle && titleFieldRef.current) {
      const timer = setTimeout(() => {
        titleFieldRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocusTitle]);

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r">
        {/* Property Pills - Mobile Only */}
        {selectedAssignee !== undefined && onAssigneeChange && (
          <div className="md:hidden -mt-2">
            <TaskPropertyPills
              form={form}
              selectedAssignee={selectedAssignee || null}
              onAssigneeChange={onAssigneeChange}
              taskStatus={taskStatus}
              enabled={enabled}
            />
          </div>
        )}

        {/* Title */}
        <div className="space-y-2">
          <TaskTitleField
            form={form}
            onEnter={handleTitleEnter}
            titleRef={titleFieldRef}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <TaskDescriptionField
            form={form}
            value={form.getValues('description')}
            onTagClick={handleTagClick as (type: TagEntityType, id: string) => void}
            descriptionRef={descriptionFieldRef}
          />
        </div>

      {/* Notes Section */}
      {taskId && (
        <>
          <Separator />
          <TaskNotes
            taskId={taskId}
            notes={notes}
            onNoteAdded={() => {
              // Notes will auto-refresh via query invalidation
            }}
          />
        </>
      )}

      {/* Activity Section */}
      {showActivity && taskId && (
        <>
          <Separator />
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Activity</h3>
            <TaskActivityTab taskId={taskId} isOpen={isOpen} />
          </div>
        </>
      )}
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
