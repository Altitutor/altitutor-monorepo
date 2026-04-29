'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  DataTableToolbar,
  ScrollArea,
} from '@altitutor/ui';
import { useQuery } from '@tanstack/react-query';
import { Loader2, X } from 'lucide-react';
import type { DataTableFilterDefinition } from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import { fetchTutorLogsForExport } from '../api/quickbooks-export';
import {
  processTutorLogsForExport,
  type ProcessTutorLogsForExportOptions,
} from '../utils/quickbooks-export.processor';
import { applyTutorLogsExportTableFilters } from '../utils/quickbooks-export.client-filters';
import { generateCsv, downloadCsv } from '../utils/quickbooks-export.utils';
import { getDefaultDateRange } from '../config/quickbooks-export.config';
import { useToast } from '@altitutor/ui';
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog';
import { cn } from '@/shared/utils';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { formatSessionType } from '@/shared/utils/index';
import { useStaffSearchForFilter } from '@/features/sessions/hooks/useStaffSearchForFilter';
import { useSubjectsSearchForFilter } from '@/features/classes/hooks/useSubjectsSearchForFilter';
import { useClassesSearchForFilter } from '@/features/classes/hooks/useClassesSearchForFilter';
import type { MinimalClass } from '@/features/classes/api/classes';

const SESSION_TYPES: Database['public']['Enums']['session_type'][] = [
  'CLASS',
  'DRAFTING',
  'EXAM_COURSE',
  'SUBSIDY_INTERVIEW',
  'TRIAL_SESSION',
  'STAFF_INTERVIEW',
  'ADMIN_SHIFT',
];

function formatClassOptionLabel(c: MinimalClass): string {
  const title = c.long_name || c.short_name || 'Class';
  const subj = c.subject?.long_name || c.subject?.name;
  return subj ? `${title} (${subj})` : title;
}

function getEmptyClassSessionsMode(
  showWithStudents: boolean,
  showEmptyClassSessions: boolean
): NonNullable<ProcessTutorLogsForExportOptions['emptyClassSessions']> {
  if (showWithStudents && showEmptyClassSessions) return 'include_all';
  if (showWithStudents && !showEmptyClassSessions) return 'exclude';
  if (!showWithStudents && showEmptyClassSessions) return 'only_empty';
  return 'include_all';
}

type QuickBooksExportModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function QuickBooksExportModal({
  isOpen,
  onClose,
}: QuickBooksExportModalProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [staffFilterSearch, setStaffFilterSearch] = useState('');
  const [subjectFilterSearch, setSubjectFilterSearch] = useState('');
  const [classFilterSearch, setClassFilterSearch] = useState('');
  const wasOpenRef = useRef(false);

  const defaultSort = useMemo(() => ({ field: 'created_at', direction: 'desc' as const }), []);

  const {
    state,
    setSearch,
    setFilters,
    setSort,
    setVisibleColumns,
    setGroupBy,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    skipUrlSync: true,
    defaultFilters: {},
    defaultSort,
    defaultVisibleColumns: [],
    filterKeys: ['type', 'subject', 'class', 'staff', 'empty_sessions', 'from', 'to'],
  });

  useEffect(() => {
    if (!isOpen) setExpanded(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const range = getDefaultDateRange();
      setFilters({
        from: [range.startDate],
        to: [range.endDate],
      });
      setSearch('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, setFilters, setSearch]);

  const fromVal = String((state.filters.from ?? [])[0] ?? '').trim();
  const toVal = String((state.filters.to ?? [])[0] ?? '').trim();

  const staffIdForRpc = useMemo(() => {
    const ids = (state.filters.staff as string[] | undefined) ?? [];
    return ids.length === 1 ? ids[0] : undefined;
  }, [state.filters.staff]);

  const { data: staffSearchData } = useStaffSearchForFilter(staffFilterSearch);
  const { data: subjectSearchData } = useSubjectsSearchForFilter(subjectFilterSearch);
  const { data: classSearchData } = useClassesSearchForFilter(classFilterSearch);

  const staffFilterOptions = useMemo(
    () =>
      (staffSearchData?.staff ?? []).map((s) => ({
        label: `${s.first_name} ${s.last_name}`,
        value: s.id,
      })),
    [staffSearchData?.staff]
  );

  const subjectFilterOptions = useMemo(
    () =>
      (subjectSearchData?.subjects ?? []).map((s) => ({
        label: s.long_name ?? s.name ?? s.id,
        value: s.id,
      })),
    [subjectSearchData?.subjects]
  );

  const classFilterOptions = useMemo(
    () =>
      (classSearchData?.classes ?? []).map((c) => ({
        label: formatClassOptionLabel(c),
        value: c.id,
      })),
    [classSearchData?.classes]
  );

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: 'type',
        label: 'Session type',
        options: SESSION_TYPES.map((t) => ({ label: formatSessionType(t), value: t })),
      },
      {
        key: 'subject',
        label: 'Subject',
        options: subjectFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search subjects...',
      },
      {
        key: 'class',
        label: 'Class',
        options: classFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search classes...',
      },
      {
        key: 'staff',
        label: 'Staff',
        options: staffFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search staff...',
      },
      {
        key: 'empty_sessions',
        label: 'Class sessions (no students)',
        options: [
          { label: 'With students', value: 'with_students' },
          { label: 'Empty (no students)', value: 'empty_class' },
        ],
      },
      {
        key: 'date',
        label: 'Date',
        type: 'date-range',
        fromKey: 'from',
        toKey: 'to',
      },
    ],
    [staffFilterOptions, subjectFilterOptions, classFilterOptions]
  );

  const { data: tutorLogsData, isLoading, error } = useQuery({
    queryKey: ['tutor-logs-export', fromVal, toVal, staffIdForRpc ?? ''],
    queryFn: () =>
      fetchTutorLogsForExport({
        startDate: fromVal,
        endDate: toVal,
        staffIdForRpc,
      }),
    enabled: isOpen && !!fromVal && !!toVal,
  });

  const processResult = useMemo(() => {
    if (!tutorLogsData) return { entries: [], excludedClasses: [] };
    const staffIds = (state.filters.staff as string[] | undefined) ?? [];
    const subjectIds = (state.filters.subject as string[] | undefined) ?? [];
    const classIds = (state.filters.class as string[] | undefined) ?? [];
    const sessionTypes = (state.filters.type as string[] | undefined) ?? [];
    const emptySessionFilters =
      (state.filters.empty_sessions as string[] | undefined) ?? [];
    const showWithStudents =
      emptySessionFilters.length === 0 || emptySessionFilters.includes('with_students');
    const showEmptyClassSessions =
      emptySessionFilters.length === 0 || emptySessionFilters.includes('empty_class');

    const narrowed = applyTutorLogsExportTableFilters(tutorLogsData, {
      staffIds,
      subjectIds,
      classIds,
      sessionTypes,
    });
    const emptyMode = getEmptyClassSessionsMode(showWithStudents, showEmptyClassSessions);
    return processTutorLogsForExport(narrowed, { emptyClassSessions: emptyMode });
  }, [tutorLogsData, state.filters]);

  const quickBooksEntries = processResult.entries;
  const excludedClasses = processResult.excludedClasses;

  const csvPreview = useMemo(() => {
    if (quickBooksEntries.length === 0) return '';
    return generateCsv(quickBooksEntries);
  }, [quickBooksEntries]);

  const filename = useMemo(() => {
    const formatDate = (dateStr: string) => dateStr.replace(/-/g, '');
    return `quickbooks-timesheet-${formatDate(fromVal)}-${formatDate(toVal)}.csv`;
  }, [fromVal, toVal]);

  const handleExport = () => {
    if (csvPreview) {
      downloadCsv(csvPreview, filename);

      if (excludedClasses.length > 0) {
        const classNames = excludedClasses
          .map((c) => {
            const date = new Date(c.sessionStartAt).toLocaleDateString('en-AU', {
              timeZone: 'Australia/Adelaide',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
            return `${c.subjectName || c.sessionType} (${date})`;
          })
          .join(', ');

        toast({
          title: 'Export successful',
          description: `Downloaded ${quickBooksEntries.length} timesheet entries. Excluded ${excludedClasses.length} class session(s) with no students: ${classNames}`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'Export successful',
          description: `Downloaded ${quickBooksEntries.length} timesheet entries`,
        });
      }

      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS
        )}
      >
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1 min-w-0">
                  <DialogTitle>Export to QuickBooks</DialogTitle>
                  <DialogDescription>
                    Export tutor logs as a QuickBooks-compatible timesheet CSV file
                  </DialogDescription>
                </div>
                <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
              <DataTableToolbar
                state={state}
                onSearchChange={setSearch}
                onFiltersChange={setFilters}
                onSortChange={setSort}
                onGroupByChange={setGroupBy}
                onVisibleColumnsChange={setVisibleColumns}
                onQuickFilterApply={applyQuickFilter}
                onReset={resetFilters}
                filterDefinitions={filterDefinitions}
                sortOptions={[]}
                columnDefinitions={[]}
                quickFilters={[]}
                hideSearch
                filterSearchValues={{
                  staff: staffFilterSearch,
                  subject: subjectFilterSearch,
                  class: classFilterSearch,
                }}
                onFilterSearchChange={(filterKey, value) => {
                  if (filterKey === 'staff') setStaffFilterSearch(value);
                  if (filterKey === 'subject') setSubjectFilterSearch(value);
                  if (filterKey === 'class') setClassFilterSearch(value);
                }}
                searchPlaceholder="Search…"
              />

              {isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading tutor logs…</span>
                </div>
              )}

              {error && (
                <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
                  Error loading tutor logs:{' '}
                  {error instanceof Error ? error.message : 'Unknown error'}
                </div>
              )}

              {!isLoading && !error && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">
                        Preview ({quickBooksEntries.length} entries)
                      </span>
                      {excludedClasses.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {excludedClasses.length} class session(s) with no students excluded from
                          export
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{filename}</span>
                  </div>
                  <ScrollArea className="min-h-0 flex-1 border rounded-md">
                    <pre className="p-4 text-xs font-mono whitespace-pre-wrap break-all">
                      {csvPreview || 'No data to export'}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 px-6 py-4 border-t bg-background">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            disabled={isLoading || !!error || quickBooksEntries.length === 0}
          >
            Export CSV
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
