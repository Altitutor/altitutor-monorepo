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

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3">
      <span className="pt-2.5 text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

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
    <div className="hidden h-full min-h-0 w-full overflow-y-auto overscroll-contain p-6 space-y-4 md:block">
      <PropertyRow label="Status">
        <TaskStatusField form={form} taskStatus={taskStatus} />
      </PropertyRow>
      <PropertyRow label="Priority">
        <TaskPriorityField form={form} />
      </PropertyRow>
      <PropertyRow label="Assignee">
        <TaskAssigneeField
          form={form}
          selectedAssignee={selectedAssignee}
          onAssigneeChange={onAssigneeChange}
          enabled={enabled}
        />
      </PropertyRow>
      <PropertyRow label="Link">
        <TaskLinkField
          form={form}
          selectedIssue={selectedIssue}
          selectedProject={selectedProject}
          onLinkChange={onLinkChange}
          onOpenIssue={onOpenIssue}
          onOpenProject={onOpenProject}
        />
      </PropertyRow>
      <PropertyRow label="Estimate">
        <TaskEstimateField form={form} />
      </PropertyRow>
      <PropertyRow label="Due date">
        <TaskDueDateField form={form} />
      </PropertyRow>
    </div>
  );
}
