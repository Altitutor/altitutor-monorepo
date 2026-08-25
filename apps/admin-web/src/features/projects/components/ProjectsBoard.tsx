'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Button,
  KanbanBoard,
  SearchableSelect,
  type KanbanColumnDef,
  type EntityListPillColumn,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useProjects } from '../api/queries';
import { useUpdateProject } from '../api/mutations';
import { ProjectCard } from './ProjectCard';
import { EditProjectDialog } from './EditProjectDialog';
import { CreateProjectDialog } from './CreateProjectDialog';
import type { ProjectPriority, ProjectStatus, ProjectWithLead } from '../types';
import { cn } from '@/shared/utils';
import {
  getProjectStatusIcon,
  getProjectStatusIconColor,
  getProjectStatusLabel,
  getProjectPriorityLabel,
  formatProjectDate,
  PROJECT_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
} from '../utils/projectUtils';
import { getUserInitials } from '@/shared/utils';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';
import { useEntityListTableState } from '@/shared/hooks/useEntityListTableState';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { ProjectPriorityEntityPill } from './fields/ProjectPriorityEntityPill';
import { ProjectDueDateEntityPill } from './fields/ProjectDueDateEntityPill';

const PROJECT_FILTER_KEYS = ['status', 'priority', 'start_date', 'target_date', 'member'] as const;

export function ProjectsBoard() {
  const {
    filters,
    setFilters,
    search,
    setSearch,
    groupBy: activeColumnKey,
    setGroupBy: setActiveColumnKey,
    sortBy,
    sortDirection,
    handleSortChange,
    applyQuickFilter,
  } = useEntityListTableState({
    defaultSort: { field: 'name', direction: 'asc' },
    defaultGroupBy: 'status',
    filterKeys: [...PROJECT_FILTER_KEYS],
  });

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] = useState<ProjectStatus>('backlog');
  const [createDefaultPriority, setCreateDefaultPriority] =
    useState<ProjectPriority | null>(null);
  const [createDefaultLeadId, setCreateDefaultLeadId] = useState<string | null>(null);

  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters('projects');

  const { data: projects = [], isLoading } = useProjects({ ...filters, search } as import('../types').ProjectFilters);
  const updateProject = useUpdateProject();

  const handleUpdate = useCallback(
    (project: ProjectWithLead, updates: Partial<import('../types').ProjectUpdate>) => {
      updateProject.mutate({ id: project.id, updates });
    },
    [updateProject]
  );

  const { staff: staffList } = useStaffSearch('', true);

  const handleAdd = useCallback((columnValue: unknown) => {
    if (activeColumnKey === 'status') {
      setCreateColumnValue(columnValue as ProjectStatus);
      setCreateDefaultPriority(null);
      setCreateDefaultLeadId(null);
    } else if (activeColumnKey === 'priority') {
      setCreateColumnValue('backlog');
      setCreateDefaultPriority(columnValue as ProjectPriority);
      setCreateDefaultLeadId(null);
    } else if (activeColumnKey === 'project_lead') {
      setCreateColumnValue('backlog');
      setCreateDefaultPriority(null);
      setCreateDefaultLeadId(columnValue === '__null__' ? null : (columnValue as string));
    }
    setIsCreateDialogOpen(true);
  }, [activeColumnKey]);

  const columnDefs: KanbanColumnDef<ProjectWithLead, unknown>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      getValue: (p) => p.status,
      options: PROJECT_STATUS_OPTIONS,
      onValueChange: (p, v) => handleUpdate(p, { status: v as ProjectStatus }),
    },
    {
      key: 'priority',
      label: 'Priority',
      getValue: (p) => p.priority ?? 0,
      options: PRIORITY_OPTIONS,
      onValueChange: (p, v) => handleUpdate(p, { priority: v as number }),
    },
      {
        key: 'project_lead',
        label: 'Project lead',
        getValue: (p) => p.project_lead_id ?? '__null__',
        options: [
          { value: '__null__', label: 'No lead' },
          ...staffList.map((s) => ({
            value: s.id,
            label: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unnamed',
          })),
        ],
        onValueChange: (p, v) => handleUpdate(p, { project_lead_id: v === '__null__' ? null : (v as string) }),
        filterable: false,
      },
  ], [handleUpdate, staffList]);
  const assigneeFilterOptions = useMemo(
    () => staffList.map((s) => ({ value: s.id as unknown, label: `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Unnamed' })),
    [staffList]
  );

  const rightPills: EntityListPillColumn<ProjectWithLead, unknown>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        visibleByDefault: true,
        getValue: (p) => p.status ?? null,
        defaultValue: null,
        filterOptions: PROJECT_STATUS_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
        groupable: true,
        sortable: true,
        filterable: true,
        renderPill: (item, onChange, collapsed) => {
          const status = (item.status ?? 'backlog') as ProjectStatus;
          const StatusIcon = getProjectStatusIcon(status);
          const iconColor = getProjectStatusIconColor(status);
          const selectedItem = PROJECT_STATUS_OPTIONS.find((option) => option.value === status) ?? PROJECT_STATUS_OPTIONS[0];

          return (
            <SearchableSelect<(typeof PROJECT_STATUS_OPTIONS)[number]>
              items={PROJECT_STATUS_OPTIONS}
              value={selectedItem}
              onValueChange={(option) => {
                const nextStatus = (option?.value ?? 'backlog') as ProjectStatus;
                handleUpdate(item, { status: nextStatus });
                onChange(nextStatus);
              }}
              getItemLabel={(option) => option.label}
              getItemId={(option) => option.value}
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-8 border rounded-full bg-background group gap-1.5 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 dark:hover:text-white',
                    collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto'
                  )}
                >
                  <StatusIcon className={cn('h-3 w-3 flex-shrink-0', iconColor)} />
                  {!collapsed && <span className="truncate">{getProjectStatusLabel(status)}</span>}
                </Button>
              }
            />
          );
        },
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
        renderPill: (item, onChange, collapsed) => (
          <ProjectDueDateEntityPill
            targetDate={item.start_date ?? null}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextStartDate = nextDate ? new Date(nextDate).toISOString() : null;
              handleUpdate(item, { start_date: nextStartDate });
              onChange(nextStartDate);
            }}
          />
        ),
      },
      {
        key: 'target_date',
        label: 'Due date',
        visibleByDefault: false,
        getValue: (p) => p.target_date ?? null,
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
        renderPill: (item, onChange, collapsed) => (
          <ProjectDueDateEntityPill
            targetDate={item.target_date ?? null}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextTargetDate = nextDate ? new Date(nextDate).toISOString() : null;
              handleUpdate(item, { target_date: nextTargetDate });
              onChange(nextTargetDate);
            }}
          />
        ),
      },
      {
        key: 'dates',
        label: 'Dates',
        visibleByDefault: true,
        getValue: (p) => p.target_date ?? p.start_date ?? null,
        defaultValue: null,
        groupable: true,
        sortable: true,
        filterable: false,
        compare: (a, b) => {
          const aTime = a ? new Date(String(a)).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b ? new Date(String(b)).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        },
        renderPill: (item, onChange, collapsed) => (
          <ProjectDueDateEntityPill
            targetDate={item.target_date ?? item.start_date ?? null}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextTargetDate = nextDate ? new Date(nextDate).toISOString() : null;
              handleUpdate(item, { target_date: nextTargetDate });
              onChange(nextTargetDate);
            }}
          />
        ),
      },
      {
        key: 'priority',
        label: 'Priority',
        visibleByDefault: true,
        getValue: (p) => (p.priority ?? 0) as number,
        defaultValue: 0,
        filterOptions: [
          { value: 0 as unknown, label: 'No priority' },
          { value: 1 as unknown, label: 'Urgent' },
          { value: 2 as unknown, label: 'High' },
          { value: 3 as unknown, label: 'Medium' },
          { value: 4 as unknown, label: 'Low' },
        ],
        groupable: true,
        sortable: true,
        filterable: true,
        renderPill: (item, onChange, collapsed) => (
          <ProjectPriorityEntityPill
            priority={(item.priority ?? 0) as ProjectPriority}
            collapsed={collapsed}
            onChange={(nextPriority) => {
              handleUpdate(item, { priority: nextPriority });
              onChange(nextPriority);
            }}
          />
        ),
      },
      {
        key: 'project_lead',
        label: 'Project lead',
        visibleByDefault: true,
        getValue: (p) => p.project_lead_id ?? null,
        defaultValue: null,
        filterOptions: assigneeFilterOptions,
        groupable: true,
        sortable: false,
        filterable: false,
        filterSearchable: true,
        renderPill: (item, onChange, collapsed) => {
          const lead = item.project_lead;
          const name = lead ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unnamed' : 'No lead';
          const initials = lead ? getUserInitials(lead.first_name, lead.last_name) : '?';
          const selectedItem = item.project_lead_id
            ? staffList.find((staff) => staff.id === item.project_lead_id) ?? null
            : null;
          return (
            <SearchableSelect<(typeof staffList)[number]>
              items={staffList}
              value={selectedItem}
              onValueChange={(staff) => {
                const nextLeadId = staff?.id ?? null;
                handleUpdate(item, { project_lead_id: nextLeadId });
                onChange(nextLeadId);
              }}
              getItemLabel={(staff) => `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || 'Unnamed'}
              getItemId={(staff) => staff.id}
              searchPlaceholder="Search staff..."
              emptyMessage="No staff found"
              allowClear
              clearLabel="No lead"
              trigger={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'h-8 border rounded-full bg-background group gap-1.5 hover:bg-brand-lightBlue/10 dark:hover:bg-brand-dark-card/70 dark:hover:text-white',
                    collapsed ? 'px-2 w-auto' : 'px-3 text-xs w-auto'
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium shrink-0',
                    lead ? 'text-foreground' : 'text-muted-foreground opacity-40 group-hover:opacity-100'
                  )}>
                    {initials}
                  </span>
                  {!collapsed && (
                    <span className={cn('truncate', !lead && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
                      {name}
                    </span>
                  )}
                </Button>
              }
            />
          );
        },
      },
      {
        key: 'member',
        label: 'Member',
        visibleByDefault: false,
        filterOnly: true,
        getValue: (p) => (p.members ?? []).map((member) => member.id),
        defaultValue: [],
        filterOptions: assigneeFilterOptions,
        groupable: false,
        sortable: false,
        filterable: true,
        filterSearchable: true,
        renderPill: () => null,
      },
    ],
    [assigneeFilterOptions, handleUpdate, staffList]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'dates', label: 'Dates' },
      { key: 'start_date', label: 'Start date' },
      { key: 'target_date', label: 'Due date' },
      { key: 'priority', label: 'Priority' },
      { key: 'project_lead', label: 'Project lead' },
    ],
    []
  );
  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'dates', label: 'Dates' },
      { key: 'start_date', label: 'Start date' },
      { key: 'target_date', label: 'Due date' },
      { key: 'priority', label: 'Priority' },
    ],
    []
  );

  const statusColumn: EntityListStatusColumn<ProjectWithLead, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (p) => p.status,
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
    onStatusChange: (project, value) => handleUpdate(project, { status: value as ProjectStatus }),
  };

  const handleOpenProject = useCallback((projectId: string) => {
    setSelectedProjectId(projectId);
    setIsEditDialogOpen(true);
  }, []);

  const renderCard = useCallback(
    (p: ProjectWithLead, visiblePillKeys: string[]) => (
      <ProjectCard
        project={p}
        visiblePillKeys={visiblePillKeys}
        rightPills={rightPills}
        onOpen={handleOpenProject}
      />
    ),
    [rightPills, handleOpenProject]
  );

  return (
    <>
      <KanbanBoard<ProjectWithLead>
        items={projects}
        getItemId={(p) => p.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey ?? 'status'}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={renderCard}
        statusColumn={statusColumn}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getProjectStatusLabel(valueKey as ProjectStatus);
          }
          if (columnKey === 'dates') {
            if (valueKey === '__null__') return 'No dates';
            return formatProjectDate(valueKey);
          }
          if (columnKey === 'start_date') {
            if (valueKey === '__null__') return 'No start date';
            return formatProjectDate(valueKey);
          }
          if (columnKey === 'target_date') {
            if (valueKey === '__null__') return 'No due date';
            return formatProjectDate(valueKey);
          }
          if (columnKey === 'priority') {
            if (valueKey === '__null__') return 'No priority';
            return getProjectPriorityLabel(Number(valueKey) as import('../types').ProjectPriority);
          }
          if (columnKey === 'project_lead') {
            if (valueKey === '__null__') return 'No lead';
            const staff = staffList.find((s) => s.id === valueKey);
            return staff ? `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || valueKey : valueKey;
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={handleAdd}
        isLoading={isLoading}
        emptyMessage="No projects found"
        filters={filters}
        onFiltersChange={setFilters}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search projects..."
        quickFilters={quickFilters}
        onApplyQuickFilter={(qf) => applyQuickFilter(qf, currentStaff?.id)}
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

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialStatus={createColumnValue}
        initialPriority={createDefaultPriority}
        initialProjectLeadId={createDefaultLeadId}
        onProjectCreated={(projectId) => {
          setSelectedProjectId(projectId);
          setIsEditDialogOpen(true);
        }}
      />
    </>
  );
}
