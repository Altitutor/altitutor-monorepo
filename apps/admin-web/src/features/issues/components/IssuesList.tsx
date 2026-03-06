'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListStatusColumn,
  type EntityListPillColumn,
  RichTextEditor,
} from '@altitutor/ui';
import { useIssues } from '../api/queries';
import { useUpdateIssue } from '../api/mutations';
import { EditIssueDialog } from './EditIssueDialog';
import { CreateIssueDialog } from './CreateIssueDialog';
import { IssueDueDateEntityPill } from './IssueDueDateEntityPill';
import { cn } from '@/shared/utils';
import { Circle, Clock, CheckCircle } from 'lucide-react';
import type { IssueWithTags, IssueStatus } from '../types';
import { formatIssueDueDate, getIssueStatusLabel, getIssueStatusOrder } from '../utils/issueUtils';

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'awaiting_response', label: 'Awaiting Response' },
  { value: 'resolved', label: 'Resolved' },
];

export interface IssuesListProps {
  /** Initial filter values (e.g. dashboard: open only) */
  defaultFilters?: Record<string, unknown[]>;
}

export function IssuesList({ defaultFilters }: IssuesListProps = {}) {
  const [filters, setFilters] = useState<Record<string, unknown[]>>(defaultFilters ?? {});
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>('status');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: issues = [], isLoading } = useIssues(filters);
  const updateIssue = useUpdateIssue();

  const handleStatusChange = useCallback(
    (issue: IssueWithTags, value: IssueStatus) => {
      updateIssue.mutate({ id: issue.id, updates: { status: value } });
    },
    [updateIssue]
  );

  const handleAdd = useCallback(
    () => {
      setIsCreateDialogOpen(true);
    },
    []
  );

  const statusColumn: EntityListStatusColumn<IssueWithTags, unknown> = {
    key: 'status',
    label: 'Status',
    getValue: (i) => i.status as IssueStatus,
    defaultValue: 'open',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'open' ? Circle : opt.value === 'awaiting_response' ? Clock : CheckCircle
    })),
    renderBubble: (value: unknown, collapsed) => {
      const status = value as IssueStatus;
      const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[0];
      const Icon = status === 'open' ? Circle : status === 'awaiting_response' ? Clock : CheckCircle;
      const color = status === 'open' ? 'text-blue-500' : status === 'awaiting_response' ? 'text-yellow-500' : 'text-green-500';

      if (collapsed) return <Icon className={cn("h-3 w-3", color)} />;

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', color)}>
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (issue, value) => handleStatusChange(issue, value as IssueStatus),
  };

  const dueDateFilterOptions = useMemo(
    () =>
      Array.from(new Set(issues.map((issue) => issue.due_date).filter((date): date is string => !!date)))
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
        .map((date) => ({ value: date as unknown, label: formatIssueDueDate(date) })),
    [issues]
  );

  const rightPills: EntityListPillColumn<IssueWithTags, unknown>[] = useMemo(
    () => [
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
              updateIssue.mutate({ id: item.id, updates: { due_date: nextDueDate } });
              onChange(nextDueDate);
            }}
          />
        ),
      },
    ],
    [dueDateFilterOptions, updateIssue]
  );

  const groupByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due date' },
    ],
    []
  );

  const sortByOptions = useMemo(
    () => [
      { key: 'status', label: 'Status' },
      { key: 'due_date', label: 'Due date' },
    ],
    []
  );

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  return (
    <>
      <EntityList<IssueWithTags>
        items={issues}
        getItemId={(i) => i.id}
        renderName={(i) => i.name ?? ''}
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
          if (columnKey === 'status') {
            return getIssueStatusOrder(valueKey);
          }
          return 0;
        }}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getIssueStatusLabel(valueKey as IssueStatus);
          }
          if (columnKey === 'due_date') {
            if (valueKey === '__null__') return 'No due date';
            return formatIssueDueDate(valueKey);
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        onAdd={handleAdd}
        onRowClick={(i) => {
          setSelectedIssueId(i.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add issue"
        emptyMessage="No issues match your filters"
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
          placeholder: "Add issue description..."
        }}
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
      />
    </>
  );
}
