'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListStatusColumn,
  type EntityListPillColumn,
} from '@altitutor/ui';
import { AdminRichTextEditorWithImages } from '@/features/rich-text-images';
import { useProjects } from '../api/queries';
import { useUpdateProject, useCreateProject } from '../api/mutations';
import { EditProjectDialog } from './EditProjectDialog';
import { ProjectPriorityEntityPill } from './fields/ProjectPriorityEntityPill';
import { ProjectDueDateEntityPill } from './fields/ProjectDueDateEntityPill';
import { cn } from '@/shared/utils';
import { useCurrentStaff } from '@/shared/hooks';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import type { ProjectWithLead, ProjectStatus, ProjectPriority } from '../types';
import {
  getProjectStatusIcon,
  getProjectStatusIconColor,
  getProjectStatusLabel,
  getProjectStatusOrder,
  getProjectPriorityLabel,
  formatProjectDate,
  PRIORITY_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '../utils/projectUtils';
import { useEntityListTableState } from '@/shared/hooks/useEntityListTableState';

const PROJECT_FILTER_KEYS = ['status', 'priority', 'start_date', 'target_date', 'member'] as const;

export interface ProjectsListProps {
  /** Initial filter values (e.g. dashboard: projects where current user is a member) */
  defaultFilters?: Record<string, unknown[]>;
  /** Force collapsed pill layout (e.g. dashboard cards) */
  compact?: boolean;
  hideToolbar?: boolean;
  embedView?: {
    groupBy?: string | null;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
    secondarySortBy?: string;
  };
}

export function ProjectsList({
  defaultFilters,
  compact = false,
  hideToolbar = false,
  embedView,
}: ProjectsListProps = {}) {
  const embedLocked = hideToolbar && embedView != null;

  const {
    filters,
    setFilters,
    search,
    setSearch,
    groupBy,
    setGroupBy,
    sortBy,
    sortDirection,
    handleSortChange,
  } = useEntityListTableState({
    defaultFilters: defaultFilters ?? {},
    defaultSort: embedLocked
      ? { field: embedView?.sortBy ?? 'name', direction: embedView?.sortDirection ?? 'asc' }
      : { field: 'name', direction: 'asc' },
    defaultGroupBy: embedLocked ? (embedView?.groupBy ?? null) : 'status',
    filterKeys: [...PROJECT_FILTER_KEYS],
    skipUrlSync: embedLocked,
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: projects = [], isLoading } = useProjects({ ...filters, search } as import('../types').ProjectFilters);
  const displayProjects = useMemo(() => {
    if (!embedLocked || !embedView.secondarySortBy) return projects;

    const secondaryKey = embedView.secondarySortBy;
    const primaryKey = embedView.sortBy ?? 'name';
    const direction = embedView.sortDirection ?? 'asc';

    const getPrimaryValue = (project: ProjectWithLead) => {
      if (primaryKey === 'priority') return Number(project.priority ?? 0);
      if (primaryKey === 'target_date') {
        return project.target_date ? new Date(project.target_date).getTime() : Number.POSITIVE_INFINITY;
      }
      return project.name ?? '';
    };

    const getSecondaryValue = (project: ProjectWithLead) => {
      if (secondaryKey === 'target_date') {
        return project.target_date ? new Date(project.target_date).getTime() : Number.POSITIVE_INFINITY;
      }
      if (secondaryKey === 'priority') return Number(project.priority ?? 0);
      return project.name ?? '';
    };

    return [...projects].sort((a, b) => {
      const primaryA = getPrimaryValue(a);
      const primaryB = getPrimaryValue(b);
      if (primaryA < primaryB) return direction === 'asc' ? -1 : 1;
      if (primaryA > primaryB) return direction === 'asc' ? 1 : -1;

      const secondaryA = getSecondaryValue(a);
      const secondaryB = getSecondaryValue(b);
      if (secondaryA < secondaryB) return -1;
      if (secondaryA > secondaryB) return 1;
      return 0;
    });
  }, [projects, embedLocked, embedView]);
  const updateProject = useUpdateProject();
  const createProject = useCreateProject();
  const { data: currentStaff } = useCurrentStaff();
  const { staff: staffList } = useStaffSearch('', true);

  const memberFilterOptions = useMemo(
    () =>
      staffList.map((staff) => ({
        value: staff.id as unknown,
        label: `${staff.first_name || ''} ${staff.last_name || ''}`.trim() || 'Unnamed',
      })),
    [staffList]
  );

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
    options: PROJECT_STATUS_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: getProjectStatusIcon(opt.value),
    })),
    renderBubble: (value: unknown, collapsed) => {
      const status = value as ProjectStatus;
      const option = PROJECT_STATUS_OPTIONS.find((o) => o.value === status) ?? PROJECT_STATUS_OPTIONS[0];
      const Icon = getProjectStatusIcon(status);
      const iconColor = getProjectStatusIconColor(status);

      if (collapsed) return <Icon className={cn('h-3 w-3', iconColor)} />;

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', iconColor)}>
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (project, value) => handleStatusChange(project, value as ProjectStatus),
  };

  const priorityFilterOptions = useMemo(
    () =>
      PRIORITY_OPTIONS.map((opt) => ({
        value: opt.value as unknown,
        label: opt.label,
      })),
    []
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
        key: 'start_date',
        label: 'Start date',
        visibleByDefault: false,
        getValue: (p) => p.start_date ?? null,
        defaultValue: null,
        filterType: 'date-range',
        groupable: true,
        sortable: true,
        filterable: true,
        compare: (a, b) => {
          const aTime = a ? new Date(String(a)).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b ? new Date(String(b)).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        },
        renderPill: (item, _onChange, collapsed) => (
          <span className={cn('text-xs', collapsed && 'truncate max-w-[80px]')}>
            {item.start_date ? formatProjectDate(item.start_date) : 'No start date'}
          </span>
        ),
      },
      {
        key: 'target_date',
        label: 'Due date',
        visibleByDefault: true,
        getValue: (p) => p.target_date ?? null,
        defaultValue: null,
        filterType: 'date-range',
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
      {
        key: 'member',
        label: 'Member',
        visibleByDefault: false,
        filterOnly: true,
        getValue: (p) => (p.members ?? []).map((member) => member.id),
        defaultValue: [],
        filterOptions: memberFilterOptions,
        groupable: false,
        sortable: false,
        filterable: true,
        filterSearchable: true,
        renderPill: () => null,
      },
    ],
    [priorityFilterOptions, memberFilterOptions, updateProject]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'start_date', label: 'Start date' },
      { key: 'target_date', label: 'Due date' },
    ],
    []
  );
  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'priority', label: 'Priority' },
      { key: 'start_date', label: 'Start date' },
      { key: 'target_date', label: 'Due date' },
    ],
    []
  );

  return (
    <>
      <EntityList<ProjectWithLead>
        items={displayProjects}
        getItemId={(p) => p.id}
        renderName={(p) => p.name ?? ''}
        statusColumn={statusColumn}
        rightPills={rightPills}
        groupByOptions={hideToolbar ? [] : groupByOptions}
        sortByOptions={sortByOptions}
        groupBy={embedLocked ? (embedView?.groupBy ?? null) : groupBy}
        onGroupByChange={embedLocked ? undefined : setGroupBy}
        sortBy={embedLocked && embedView?.secondarySortBy ? 'name' : embedLocked ? (embedView?.sortBy ?? 'name') : sortBy}
        sortDirection={embedLocked && embedView?.secondarySortBy ? 'asc' : embedLocked ? (embedView?.sortDirection ?? 'asc') : sortDirection}
        onSortChange={embedLocked ? undefined : handleSortChange}
        getGroupOrder={(columnKey, valueKey) => {
          if (columnKey === 'status') return getProjectStatusOrder(valueKey);
          if (columnKey === 'priority')
            return 999 - (Number(valueKey) ?? 0);
          if (columnKey === 'start_date' || columnKey === 'target_date') {
            if (valueKey === '__null__') return 99999999999999;
            const t = new Date(valueKey).getTime();
            return isNaN(t) ? 0 : t;
          }
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
          if (columnKey === 'start_date') {
            if (valueKey === '__null__') return 'No start date';
            return formatProjectDate(String(valueKey));
          }
          if (columnKey === 'target_date') {
            if (valueKey === '__null__') return 'No due date';
            return formatProjectDate(String(valueKey));
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={hideToolbar ? undefined : handleAdd}
        onRowClick={(p) => {
          setSelectedProjectId(p.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add project"
        addButtonVariant="default"
        addButtonShowLabel={true}
        emptyMessage="No projects match your filters"
        isLoading={isLoading}
        noPadding={true}
        hideToolbar={hideToolbar}
        compact={compact}
        filters={filters}
        onFiltersChange={hideToolbar ? undefined : setFilters}
        searchValue={search}
        onSearchChange={hideToolbar ? undefined : setSearch}
        searchPlaceholder="Search projects..."
        descriptionConfig={
          hideToolbar
            ? undefined
            : {
                enabled: true,
                renderEditor: ({ value, onChange, placeholder, ref }) => (
                  <AdminRichTextEditorWithImages
                    ref={ref as React.RefObject<import('@altitutor/ui').RichTextEditorRef>}
                    content={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="min-h-[60px]"
                    context="projects"
                  />
                ),
                placeholder: 'Add project description...',
              }
        }
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
