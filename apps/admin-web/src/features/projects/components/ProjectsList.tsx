'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListStatusColumn,
  type EntityListPillColumn,
  RichTextEditor,
} from '@altitutor/ui';
import { useProjects } from '../api/queries';
import { useUpdateProject, useCreateProject } from '../api/mutations';
import { EditProjectDialog } from './EditProjectDialog';
import { ProjectPriorityEntityPill } from './fields/ProjectPriorityEntityPill';
import { ProjectDueDateEntityPill } from './fields/ProjectDueDateEntityPill';
import { cn } from '@/shared/utils';
import { useCurrentStaff } from '@/shared/hooks';
import { Circle, Clock3, Flag, CheckCircle2 } from 'lucide-react';
import type { ProjectWithLead, ProjectStatus, ProjectPriority } from '../types';
import {
  getProjectStatusLabel,
  getProjectStatusOrder,
  getProjectPriorityLabel,
  formatProjectDate,
} from '../utils/projectUtils';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export interface ProjectsListProps {
  /** Initial filter values (e.g. dashboard: projects where current user is lead) */
  defaultFilters?: Record<string, unknown[]>;
}

export function ProjectsList({ defaultFilters }: ProjectsListProps = {}) {
  const [filters, setFilters] = useState<Record<string, unknown[]>>(defaultFilters ?? {});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>('status');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: projects = [], isLoading } = useProjects(filters as import('../types').ProjectFilters);
  const updateProject = useUpdateProject();
  const createProject = useCreateProject();
  const { data: currentStaff } = useCurrentStaff();

  const handleAdd = useCallback(
    async (data: { name: string; description?: string } & Record<string, unknown>) => {
      await createProject.mutateAsync({
        name: data.name,
        description: data.description ?? null,
        status: (data.status as ProjectStatus) ?? 'backlog',
        priority: (data.priority as number) ?? 0,
        target_date:
          data.target_date != null && data.target_date !== ''
            ? new Date(data.target_date as string).toISOString()
            : null,
        project_lead_id: currentStaff?.id ?? null,
        created_by: currentStaff?.id ?? null,
      });
    },
    [createProject, currentStaff?.id]
  );

  const handleStatusChange = useCallback((project: ProjectWithLead, value: ProjectStatus) => {
    updateProject.mutate({ id: project.id, updates: { status: value } });
  }, [updateProject]);

  const statusColumn: EntityListStatusColumn<ProjectWithLead, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (p) => p.status as ProjectStatus,
    defaultValue: 'backlog',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'backlog' ? Circle : opt.value === 'planned' ? Clock3 : opt.value === 'in_progress' ? Flag : CheckCircle2,
    })),
    renderBubble: (value: unknown, collapsed) => {
      const status = value as ProjectStatus;
      const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
      const Icon = status === 'backlog' ? Circle : status === 'planned' ? Clock3 : status === 'in_progress' ? Flag : CheckCircle2;
      const color = status === 'backlog' ? 'text-muted-foreground' : status === 'planned' ? 'text-blue-500' : status === 'in_progress' ? 'text-yellow-500' : 'text-green-500';

      if (collapsed) return <Icon className={cn('h-3 w-3', color)} />;

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', color)}>
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (project, value) => handleStatusChange(project, value as ProjectStatus),
  };

  const priorityFilterOptions = useMemo(
    () =>
      [
        { value: 0 as unknown, label: 'No priority' },
        { value: 1 as unknown, label: 'Urgent' },
        { value: 2 as unknown, label: 'High' },
        { value: 3 as unknown, label: 'Medium' },
        { value: 4 as unknown, label: 'Low' },
      ],
    []
  );

  const targetDateFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          projects.map((p) => p.target_date).filter((date): date is string => !!date)
        )
      )
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((date) => ({ value: date as unknown, label: formatProjectDate(date) })),
    [projects]
  );

  const rightPills: EntityListPillColumn<ProjectWithLead, unknown>[] = useMemo(
    () => [
      {
        key: 'priority',
        label: 'Priority',
        visibleByDefault: true,
        getValue: (p) => (p.priority ?? 0) as ProjectPriority,
        defaultValue: 0,
        filterOptions: priorityFilterOptions,
        filterable: true,
        groupable: true,
        sortable: true,
        compare: (a, b) => (Number(a) ?? 0) - (Number(b) ?? 0),
        renderPill: (item, onChange, collapsed) => (
          <ProjectPriorityEntityPill
            priority={(item.priority ?? 0) as ProjectPriority}
            collapsed={collapsed}
            onChange={(nextPriority) => {
              updateProject.mutate({
                id: item.id,
                updates: { priority: nextPriority },
              });
              onChange(nextPriority);
            }}
          />
        ),
      },
      {
        key: 'target_date',
        label: 'Due date',
        visibleByDefault: true,
        getValue: (p) => p.target_date ?? null,
        defaultValue: null,
        filterOptions: targetDateFilterOptions,
        filterSearchable: true,
        groupable: true,
        sortable: true,
        filterable: true,
        compare: (a, b) => {
          const aTime = a
            ? new Date(String(a)).getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b
            ? new Date(String(b)).getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        },
        renderPill: (item, onChange, collapsed) => (
          <ProjectDueDateEntityPill
            targetDate={item.target_date ?? null}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextTargetDate = nextDate
                ? new Date(nextDate).toISOString()
                : null;
              updateProject.mutate({
                id: item.id,
                updates: { target_date: nextTargetDate },
              });
              onChange(nextTargetDate);
            }}
          />
        ),
      },
    ],
    [
      priorityFilterOptions,
      targetDateFilterOptions,
      updateProject,
    ]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'target_date', label: 'Due date' },
    ],
    []
  );
  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'target_date', label: 'Due date' },
    ],
    []
  );

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  return (
    <>
      <EntityList<ProjectWithLead>
        items={projects}
        getItemId={(p) => p.id}
        renderName={(p) => p.name ?? ''}
        statusColumn={statusColumn}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        getGroupOrder={(columnKey, valueKey) => {
          if (columnKey === 'status') return getProjectStatusOrder(valueKey);
          if (columnKey === 'priority')
            return 999 - (Number(valueKey) ?? 0);
          return 0;
        }}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getProjectStatusLabel(valueKey as ProjectStatus);
          }
          if (columnKey === 'priority') {
            if (valueKey === '__null__') return 'No priority';
            return getProjectPriorityLabel(Number(valueKey) as ProjectPriority);
          }
          if (columnKey === 'target_date') {
            if (valueKey === '__null__') return 'No due date';
            return formatProjectDate(String(valueKey));
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={handleAdd}
        onRowClick={(p) => {
          setSelectedProjectId(p.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add project"
        addButtonVariant="default"
        addButtonShowLabel={true}
        emptyMessage="No projects match your filters"
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        descriptionConfig={{
          enabled: true,
          renderEditor: ({ value, onChange, placeholder, ref }) => (
            <RichTextEditor
              ref={ref as React.RefObject<import('@altitutor/ui').RichTextEditorRef>}
              content={value}
              onChange={onChange}
              placeholder={placeholder}
              className="min-h-[60px]"
            />
          ),
          placeholder: 'Add project description...'
        }}
      />

      {selectedProjectId && (
        <EditProjectDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedProjectId(null);
          }}
          projectId={selectedProjectId}
        />
      )}
    </>
  );
}
