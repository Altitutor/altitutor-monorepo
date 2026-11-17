'use client';

import { UseFormReturn } from 'react-hook-form';
import { TaskStatusPill } from '../fields/TaskStatusPill';
import { TaskPriorityPill } from '../fields/TaskPriorityPill';
import { TaskAssigneePill } from '../fields/TaskAssigneePill';
import { TaskLinkField } from '../fields/TaskLinkField';
import { TaskEstimatePill } from '../fields/TaskEstimatePill';
import { TaskDueDatePill } from '../fields/TaskDueDatePill';
import type { TaskFormData, TaskStatus } from '../../types';
import type { Tables } from '@altitutor/shared';
import { EntitySidebarCard, EntitySidebarCards } from '@/shared/components/EntitySidebarCard';

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
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <EntitySidebarCards defaultOpen={['properties']}>
        <EntitySidebarCard value="properties" title="Properties">
          <div className="space-y-4">
            <PropertyRow label="Status">
              <TaskStatusPill form={form} taskStatus={taskStatus} />
            </PropertyRow>
            <PropertyRow label="Priority">
              <TaskPriorityPill form={form} />
            </PropertyRow>
            <PropertyRow label="Assignee">
              <TaskAssigneePill
                form={form}
                selectedAssignee={selectedAssignee}
                onAssigneeChange={onAssigneeChange}
                enabled={enabled}
              />
            </PropertyRow>
            <PropertyRow label="Link">
              <TaskLinkField pill
                form={form}
                selectedIssue={selectedIssue}
                selectedProject={selectedProject}
                onLinkChange={onLinkChange}
                onOpenIssue={onOpenIssue}
                onOpenProject={onOpenProject}
              />
            </PropertyRow>
            <PropertyRow label="Estimate">
              <TaskEstimatePill form={form} />
            </PropertyRow>
            <PropertyRow label="Due date">
              <TaskDueDatePill form={form} />
            </PropertyRow>
          </div>
        </EntitySidebarCard>
      </EntitySidebarCards>
    </div>
  );
}
