'use client';

import { Separator } from '@altitutor/ui';
import { UseFormReturn } from 'react-hook-form';
import { useCallback, useRef, useEffect } from 'react';
import { TaskTitleField, TaskDescriptionField } from '../fields';
import { TaskPropertyPills } from '../fields/TaskPropertyPills';
import { TaskActivityTab } from '@/features/activity/components/tabs/TaskActivityTab';
import { TaskNotes } from '../TaskNotes';
import type { TaskEditorRef } from '../TaskEditor';
import type { RichTextEditorRef } from '@altitutor/ui';
import type { TaskFormData, TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';
import type { TagEntityType } from '@/shared/utils/tagParsing';
import { useEntityModals } from '@/shared/contexts/EntityModalContext';

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
  descriptionRef?: React.RefObject<RichTextEditorRef>;
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
  descriptionRef: descriptionRefProp,
}: TaskContentPanelProps) {
  // Refs for fields
  const titleFieldRef = useRef<HTMLInputElement>(null);
  const internalDescriptionRef = useRef<TaskEditorRef>(null);
  const descriptionFieldRef = descriptionRefProp ?? internalDescriptionRef;
  const entityModals = useEntityModals();

  const handleTagClick = useCallback((type: TagEntityType, id: string) => {
    if (type === 'student') {
      entityModals.openStudent(id);
    } else if (type === 'staff') {
      entityModals.openStaff(id);
    } else if (type === 'class') {
      entityModals.openClass(id);
    } else if (type === 'parent') {
      entityModals.openParent(id);
    } else if (type === 'subject') {
      entityModals.openSubject(id);
    } else if (type === 'topic') {
      entityModals.openTopic(id);
    } else if (type === 'session') {
      entityModals.openSession(id);
    } else if (type === 'file') {
      entityModals.openFile(id);
    }
  }, [entityModals]);

  // Handle Enter key in title field - move focus to description
  const handleTitleEnter = useCallback(() => {
    if (descriptionFieldRef.current) {
      const editor = descriptionFieldRef.current.getEditor();
      if (editor && 'commands' in editor && editor.commands && typeof editor.commands.focus === 'function') {
        editor.commands.focus();
      }
    }
  }, [descriptionFieldRef]);

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
      <div className="h-full min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-6 border-r">
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
    </>
  );
}
