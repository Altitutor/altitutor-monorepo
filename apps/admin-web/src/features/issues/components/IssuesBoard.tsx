'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
  type KanbanColumnDef,
  type EntityListPillColumn,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useIssues } from '../api/queries';
import { useUpdateIssue } from '../api/mutations';
import { useCurrentStaff } from '@/shared/hooks';
import { IssueCard } from './IssueCard';
import { EditIssueDialog } from './EditIssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueDueDateEntityPill } from './IssueDueDateEntityPill';
import type { IssueWithTags, IssueStatus, IssueUpdate } from '../types';
import { cn } from '@/shared/utils';
import {
  formatIssueDueDate,
  getIssueStatusIcon,
  getIssueStatusIconColor,
  getIssueStatusLabel,
  ISSUE_STATUS_OPTIONS,
} from '../utils/issueUtils';

export function IssuesBoard() {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] = useState<IssueStatus>('open');
  const [createDefaultDueDate, setCreateDefaultDueDate] = useState<string | null>(null);

  const { data: issues = [], isLoading } = useIssues(filters);
  const updateIssue = useUpdateIssue();
  const { data: currentStaff } = useCurrentStaff();
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleUpdate = useCallback(
    (issue: IssueWithTags, updates: Partial<IssueUpdate>) => {
      const finalUpdates = { ...updates };
      if (updates.status === 'resolved') {
        finalUpdates.resolved_by = currentStaff?.id ?? null;
      }
      updateIssue.mutate({ id: issue.id, updates: finalUpdates });
    },
    [updateIssue, currentStaff?.id]
  );

  const handleAdd = useCallback((columnValue: unknown) => {
    if (activeColumnKey === 'status') {
      setCreateColumnValue(columnValue as IssueStatus);
      setCreateDefaultDueDate(null);
    } else if (activeColumnKey === 'due_date') {
      setCreateColumnValue('open');
      setCreateDefaultDueDate(columnValue === '__null__' ? null : (columnValue as string));
    }
    setIsCreateDialogOpen(true);
  }, [activeColumnKey]);

  const dueDateFilterOptions = useMemo(
    () =>
      Array.from(new Set(issues.map((issue) => issue.due_date).filter((date): date is string => !!date)))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((date) => ({ value: date as unknown, label: formatIssueDueDate(date) })),
    [issues]
  );

  const dueDateColumnOptions = useMemo(
    () => [
      { value: '__null__' as unknown, label: 'No due date' },
      ...dueDateFilterOptions,
    ],
    [dueDateFilterOptions]
  );

  const columnDefs: KanbanColumnDef<IssueWithTags, unknown>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        getValue: (i) => i.status,
        options: ISSUE_STATUS_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label })),
        onValueChange: (i, v) => handleUpdate(i, { status: v as IssueStatus }),
      },
      {
        key: 'due_date',
        label: 'Due date',
        getValue: (i) => i.due_date ?? '__null__',
        options: dueDateColumnOptions,
        onValueChange: (i, v) => handleUpdate(i, { due_date: v === '__null__' ? null : (v as string) }),
      },
    ],
    [handleUpdate, dueDateColumnOptions]
  );

  const rightPills: EntityListPillColumn<IssueWithTags, unknown>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        visibleByDefault: true,
        getValue: (issue) => issue.status ?? null,
        defaultValue: null,
        filterOptions: ISSUE_STATUS_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
        groupable: true,
        sortable: true,
        filterable: true,
        renderPill: (item, _onChange, collapsed) => (
          <span className={cn('text-xs', collapsed && 'truncate max-w-[80px]')}>
            {getIssueStatusLabel((item.status ?? 'open') as IssueStatus)}
          </span>
        ),
      },
      {
        key: 'due_date',
        label: 'Due date',
        visibleByDefault: true,
        getValue: (issue) => issue.due_date ?? null,
        defaultValue: null,
        filterOptions: dueDateFilterOptions,
        filterSearchable: true,
        groupable: true,
        sortable: true,
        filterable: true,
        compare: (a, b) => {
          const aTime = a ? new Date(String(a)).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b ? new Date(String(b)).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        },
        renderPill: (item, onChange, collapsed) => (
          <IssueDueDateEntityPill
            dueDate={item.due_date}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextDueDate = nextDate ? new Date(nextDate).toISOString() : null;
              handleUpdate(item, { due_date: nextDueDate });
              onChange(nextDueDate);
            }}
          />
        ),
      },
      {
        key: 'tags',
        label: 'Tags',
        visibleByDefault: true,
        getValue: (issue) => (issue.tags?.length ? issue.tags.length : null),
        defaultValue: null,
        groupable: false,
        sortable: true,
        filterable: false,
        compare: (a, b) => (Number(a) ?? 0) - (Number(b) ?? 0),
        renderPill: (item, _onChange, collapsed) => (
          <span className={cn('text-xs', collapsed && 'truncate max-w-[80px]')}>
            {item.tags?.length ? `${item.tags.length} tags` : 'No tags'}
          </span>
        ),
      },
    ],
    [dueDateFilterOptions, handleUpdate]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due date' },
      { key: 'tags', label: 'Tags' },
    ],
    []
  );

  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due date' },
      { key: 'tags', label: 'Tags' },
    ],
    []
  );

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  const statusColumn: EntityListStatusColumn<IssueWithTags, unknown> = useMemo(
    () => ({
      key: 'status',
      label: 'Status',
      getValue: (i) => i.status as IssueStatus,
      defaultValue: 'open',
      filterable: true,
      options: ISSUE_STATUS_OPTIONS.map((opt) => ({
        value: opt.value,
        label: opt.label,
        icon: getIssueStatusIcon(opt.value),
      })),
      renderBubble: (value: unknown, collapsed) => {
        const status = value as IssueStatus;
        const option = ISSUE_STATUS_OPTIONS.find((o) => o.value === status) ?? ISSUE_STATUS_OPTIONS[0];
        const Icon = getIssueStatusIcon(status);
        const iconColor = getIssueStatusIconColor(status);

        if (collapsed) return <Icon className={cn('h-3 w-3', iconColor)} />;

        return (
          <span className={cn('inline-flex items-center gap-1.5 text-xs', iconColor)}>
            <Icon className="h-3 w-3" />
            {option.label}
          </span>
        );
      },
      onStatusChange: (issue, value) => handleUpdate(issue, { status: value as IssueStatus }),
    }),
    [handleUpdate]
  );

  return (
    <>
      <KanbanBoard<IssueWithTags>
        items={issues}
        getItemId={(i) => i.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={(i, visiblePillKeys) => (
          <IssueCard
            issue={i}
            visiblePillKeys={visiblePillKeys}
            onClick={() => {
              setSelectedIssueId(i.id);
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
            return getIssueStatusLabel(valueKey as IssueStatus);
          }
          if (columnKey === 'due_date') {
            if (valueKey === '__null__') return 'No due date';
            return formatIssueDueDate(valueKey);
          }
          if (columnKey === 'tags') {
            if (valueKey === '__null__') return 'No tags';
            return `${valueKey} tag${Number(valueKey) !== 1 ? 's' : ''}`;
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={handleAdd}
        isLoading={isLoading}
        emptyMessage="No issues found"
        filters={filters}
        onFiltersChange={setFilters}
      />

      {selectedIssueId && (
        <EditIssueDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedIssueId(null);
          }}
          issueId={selectedIssueId}
        />
      )}

      <CreateIssueDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialStatus={createColumnValue}
        initialDueDate={createDefaultDueDate}
      />
    </>
  );
}
