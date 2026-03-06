'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
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
import { Circle, Clock3, Flag, CheckCircle2 } from 'lucide-react';
import { getProjectStatusLabel, getProjectPriorityLabel, formatProjectDate } from '../utils/projectUtils';
import { formatShortDate } from '@/shared/utils/datetime';
import { getUserInitials } from '@/shared/utils';
import { useStaffSearch } from '@/features/tasks/hooks/useStaffSearch';

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'planned', label: 'Planned' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

const PROJECT_PRIORITY_OPTIONS = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

export function ProjectsBoard() {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] = useState<ProjectStatus>('backlog');
  const [createDefaultPriority, setCreateDefaultPriority] =
    useState<ProjectPriority | null>(null);
  const [createDefaultLeadId, setCreateDefaultLeadId] = useState<string | null>(null);

  const { data: projects = [], isLoading } = useProjects(filters as import('../types').ProjectFilters);
  const updateProject = useUpdateProject();
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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
      options: STATUS_OPTIONS,
      onValueChange: (p, v) => handleUpdate(p, { status: v as ProjectStatus }),
    },
    {
      key: 'priority',
      label: 'Priority',
      getValue: (p) => p.priority ?? 0,
      options: PROJECT_PRIORITY_OPTIONS,
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
        filterOptions: STATUS_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
        groupable: true,
        sortable: true,
        filterable: true,
        renderPill: (item, _onChange, collapsed) => (
          <span className={cn('text-xs', collapsed && 'truncate max-w-[80px]')}>
            {getProjectStatusLabel((item.status ?? 'backlog') as ProjectStatus)}
          </span>
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
        renderPill: (item, _onChange, collapsed) => {
          const hasStart = !!item.start_date;
          const hasTarget = !!item.target_date;
          const display = hasStart && hasTarget
            ? `${formatShortDate(item.start_date)} → ${formatShortDate(item.target_date)}`
            : formatProjectDate(item.target_date ?? item.start_date) || 'No dates';
          return <span className={cn('text-xs', collapsed && 'truncate max-w-[100px]')}>{display}</span>;
        },
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
        renderPill: (item, _onChange, collapsed) => (
          <span className={cn('text-xs', collapsed && 'truncate max-w-[80px]')}>
            {getProjectPriorityLabel((item.priority ?? 0) as import('../types').ProjectPriority)}
          </span>
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
        filterable: true,
        filterSearchable: true,
        renderPill: (item, _onChange, collapsed) => {
          const lead = item.project_lead;
          const name = lead ? `${lead.first_name ?? ''} ${lead.last_name ?? ''}`.trim() || 'Unnamed' : 'No lead';
          const initials = lead ? getUserInitials(lead.first_name, lead.last_name) : '?';
          return (
            <span className={cn('inline-flex items-center gap-1.5 text-xs', collapsed && 'truncate max-w-[80px]')}>
              <span className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium shrink-0">
                {initials}
              </span>
              {!collapsed && name}
            </span>
          );
        },
      },
    ],
    [assigneeFilterOptions]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'dates', label: 'Dates' },
      { key: 'priority', label: 'Priority' },
      { key: 'project_lead', label: 'Project lead' },
    ],
    []
  );
  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'dates', label: 'Dates' },
      { key: 'priority', label: 'Priority' },
    ],
    []
  );

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  const statusColumn: EntityListStatusColumn<ProjectWithLead, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (p) => p.status,
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
    onStatusChange: (project, value) => handleUpdate(project, { status: value as ProjectStatus }),
  };

  return (
    <>
      <KanbanBoard<ProjectWithLead>
        items={projects}
        getItemId={(p) => p.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={(p, visiblePillKeys) => (
          <ProjectCard
            project={p}
            visiblePillKeys={visiblePillKeys}
            onClick={() => {
              setSelectedProjectId(p.id);
              setIsEditDialogOpen(true);
            }}
          />
        )}
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
