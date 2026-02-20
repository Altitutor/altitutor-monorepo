'use client';

import { UseFormReturn } from 'react-hook-form';
import {
  TaskStatusField,
  TaskPriorityField,
  TaskAssigneeField,
  TaskLinkField,
  TaskEstimateField,
  TaskDueDateField,
} from '../fields';
import type { TaskFormData, TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';

interface TaskPropertiesPanelProps {
  form: UseFormReturn<TaskFormData>;
  selectedAssignee: Tables<'staff'> | null;
  onAssigneeChange: (staff: Tables<'staff'> | null) => void;
  selectedIssue: { id: string; name: string | null } | null;
  selectedProject: { id: string; name: string | null } | null;
  onLinkChange: (link: { type: 'issue' | 'project'; id: string; name: string | null } | null) => void;
  onOpenIssue?: (issueId: string) => void;
  onOpenProject?: (projectId: string) => void;
  taskStatus?: TaskStatus;
  enabled?: boolean;
}

export function TaskPropertiesPanel({
  form,
  selectedAssignee,
  onAssigneeChange,
  selectedIssue,
  selectedProject,
  onLinkChange,
  onOpenIssue,
  onOpenProject,
  taskStatus,
  enabled = true,
}: TaskPropertiesPanelProps) {
  return (
    <div className="hidden md:block w-80 border-l flex-shrink-0 overflow-y-auto p-6 space-y-6">
      <TaskStatusField form={form} taskStatus={taskStatus} />
      <TaskPriorityField form={form} />
      <TaskAssigneeField
        form={form}
        selectedAssignee={selectedAssignee}
        onAssigneeChange={onAssigneeChange}
        enabled={enabled}
      />
      <TaskLinkField
        form={form}
        selectedIssue={selectedIssue}
        selectedProject={selectedProject}
        onLinkChange={onLinkChange}
        onOpenIssue={onOpenIssue}
        onOpenProject={onOpenProject}
      />
      <TaskEstimateField form={form} />
      <TaskDueDateField form={form} />
    </div>
  );
}
